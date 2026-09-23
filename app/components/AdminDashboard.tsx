"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Network,
  RefreshCw,
  ShieldCheck,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  AdminCollectionRecord,
  AdminMetric,
  AdminRecordStatus,
} from "../data/admin";
import {
  useAdminClubs,
  useAdminClubMutations,
  useAdminEvents,
  useAdminEventMutations,
  useAdminOverview,
  useAdminUserMutations,
  useAdminUsers,
} from "../hooks/useAdminData";
import { useAdminTableQuery } from "../hooks/useAdminTableQuery";
import {
  getAdminCapabilities,
  getAdminRoleLabel,
  canEditUserRole,
  isAssignableUserRole,
  type AdminAccessRole,
} from "../lib/auth/admin-role";
import { uploadSecureImage } from "../lib/media-upload";
import { AdminCharts } from "./AdminCharts";
import {
  AdminDataTable,
  type AdminTableKind,
  type AdminTableRow,
} from "./AdminDataTable";
import {
  AdminRecordFormSheet,
  type AdminRecordSheetMode,
  type AdminRecordSubmission,
} from "./AdminRecordFormSheet";
import { AdminSkeleton } from "./AdminSkeleton";
import { ReviewModerationPanel } from "./ReviewModerationPanel";
import { MentorApplicationPanel } from "./MentorApplicationPanel";
import { AdminOperationsPanel } from "./AdminOperationsPanel";

const metricIcons: Record<AdminMetric["id"], LucideIcon> = {
  users: UsersRound,
  clubs: Network,
  events: CalendarDays,
  engagement: Activity,
};

function statusTone(status: AdminRecordStatus): AdminTableRow["statusTone"] {
  if (status === "Aktiv" || status === "Açıq") return "positive";
  if (status === "Tamamlanıb") return "neutral";
  return "attention";
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const bakuDate = new Date(date.getTime() + 4 * 60 * 60 * 1000);
  const monthNames = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
  const day = String(bakuDate.getUTCDate()).padStart(2, "0");
  const hour = String(bakuDate.getUTCHours()).padStart(2, "0");
  const minute = String(bakuDate.getUTCMinutes()).padStart(2, "0");
  return `${day} ${monthNames[bakuDate.getUTCMonth()]} ${hour}:${minute}`;
}

function toTableRows(records: readonly AdminCollectionRecord[]): AdminTableRow[] {
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    detail: record.detail,
    metric: record.metric,
    status: record.status,
    statusTone: statusTone(record.status),
    updatedAt: formatUpdatedAt(record.updatedAt),
    role: record.kind === "users" ? record.role : undefined,
  }));
}

type MetricCardProps = {
  index: number;
  metric: AdminMetric;
};

function MetricCard({ index, metric }: MetricCardProps) {
  const reducedMotion = useReducedMotion();
  const Icon = metricIcons[metric.id];
  const TrendIcon =
    metric.trend === "up"
      ? ArrowUpRight
      : metric.trend === "down"
        ? ArrowDownRight
        : ArrowRight;

  return (
    <motion.article
      className={`admin-metric-card is-${metric.id}`}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reducedMotion ? undefined : { y: -5, scale: 1.012 }}
      transition={{
        duration: reducedMotion ? 0 : 0.46,
        delay: reducedMotion ? 0 : 0.06 + index * 0.055,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <header>
        <span>{metric.label}</span>
        <i aria-hidden="true">
          <Icon size={17} strokeWidth={1.8} />
        </i>
      </header>
      <strong>{metric.value}</strong>
      <footer className={`is-${metric.trend}`}>
        <TrendIcon size={14} aria-hidden="true" />
        <span>{metric.change}</span>
        <small>əvvəlki dövrlə müqayisə</small>
      </footer>
    </motion.article>
  );
}

type AdminDashboardProps = {
  administrator: {
    displayName: string;
    email: string;
    role: AdminAccessRole;
  };
  demoMode: boolean;
};

type EditorState = {
  mode: AdminRecordSheetMode;
  record: AdminCollectionRecord | null;
};

type CrudFeedback = {
  id: number;
  message: string;
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("az") ?? "")
    .join("") || "ER";
}

export function AdminDashboard({ administrator, demoMode }: AdminDashboardProps) {
  const reducedMotion = useReducedMotion();
  const [activeTable, setActiveTable] = useState<AdminTableKind>("users");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<CrudFeedback | null>(null);
  const tableQuery = useAdminTableQuery(activeTable);
  const capabilities = getAdminCapabilities(administrator.role);
  const activeQuery = tableQuery.query;

  const overview = useAdminOverview();
  const users = useAdminUsers(activeTable === "users" ? activeQuery : {});
  const clubs = useAdminClubs(activeTable === "clubs" ? activeQuery : {});
  const events = useAdminEvents(activeTable === "events" ? activeQuery : {});
  const userMutations = useAdminUserMutations(activeTable === "users" ? activeQuery : {});
  const clubMutations = useAdminClubMutations(activeTable === "clubs" ? activeQuery : {});
  const eventMutations = useAdminEventMutations(activeTable === "events" ? activeQuery : {});

  const activeCollection =
    activeTable === "users" ? users : activeTable === "clubs" ? clubs : events;
  const collectionItems = (activeCollection.data?.items ?? []) as readonly AdminCollectionRecord[];
  const rows = toTableRows(collectionItems);
  const hasConnectionError = Boolean(
    overview.error || users.error || clubs.error || events.error,
  );
  const isRefreshing =
    overview.isValidating || users.isValidating || clubs.isValidating || events.isValidating;
  const mutationPending =
    userMutations.isMutating || clubMutations.isMutating || eventMutations.isMutating;

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 4_000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  function selectTable(kind: AdminTableKind) {
    setEditor(null);
    setFormError(null);
    setActiveTable(kind);
  }

  function openEditor(mode: AdminRecordSheetMode, id?: string) {
    const record = id
      ? collectionItems.find((item) => item.id === id) ?? null
      : null;
    if (activeTable === "users" && mode === "create" && !capabilities.canCreateUsers) {
      setFeedback({
        id: Date.now(),
        message: "Yeni istifadəçi hesabını yalnız əsas administrator yarada bilər.",
      });
      return;
    }
    if (
      activeTable === "users" &&
      mode === "edit" &&
      record?.kind === "users" &&
      !canEditUserRole(administrator.role, record.role)
    ) {
      setFeedback({
        id: Date.now(),
        message: "Administrator hesablarını (öz hesabın daxil) yalnız platforma sahibi dəyişə bilər.",
      });
      return;
    }
    if (mode !== "create" && !record) return;
    setFormError(null);
    setEditor({ mode, record });
  }

  async function submitRecord(submission: AdminRecordSubmission) {
    if (!editor || editor.mode === "delete") return;
    setFormError(null);
    let completionNote = "";

    try {
      if (submission.kind === "users") {
        if (editor.mode === "edit" && editor.record?.kind === "users") {
          if (administrator.role === "assistant_admin") {
            const role = submission.input.role;
            if (!isAssignableUserRole(role) || !canEditUserRole(administrator.role, editor.record.role)) {
              throw new Error("Bu rolu vermək üçün əsas administrator səlahiyyəti tələb olunur.");
            }
            await userMutations.update(editor.record.id, { role });
          } else {
            await userMutations.update(editor.record.id, submission.input);
          }
        } else {
          if (!capabilities.canCreateUsers) {
            throw new Error("Yeni istifadəçi hesabını yalnız əsas administrator yarada bilər.");
          }
          await userMutations.create(submission.input);
        }
      } else if (submission.kind === "clubs") {
        if (editor.mode === "edit" && editor.record?.kind === "clubs") {
          await clubMutations.update(editor.record.id, submission.input);
        } else {
          if (submission.coverFile && !["image/jpeg", "image/png", "image/webp"].includes(submission.coverFile.type)) {
            throw new Error("Yalnız JPG, PNG və WebP şəkilləri qəbul olunur.");
          }
          if (submission.coverFile && submission.coverFile.size > 5 * 1024 * 1024) {
            throw new Error("Klub şəkli 5 MB-dan böyük ola bilməz.");
          }
          const club = await clubMutations.create(submission.input);
          if (submission.coverFile) {
            try {
              await uploadSecureImage(submission.coverFile, "club", club.id);
            } catch {
              completionNote = " Klub yaradıldı, lakin şəkil yüklənmədi; onu redaktə ekranından yenidən seçə bilərsiniz.";
            }
          }
        }
      } else if (editor.mode === "edit" && editor.record?.kind === "events") {
        await eventMutations.update(editor.record.id, submission.input);
      } else {
        if(submission.imageFile&&!["image/jpeg","image/png","image/webp"].includes(submission.imageFile.type))throw new Error("Yalnız JPG, PNG və WebP şəkilləri qəbul olunur.");
        if(submission.imageFile&&submission.imageFile.size>5*1024*1024)throw new Error("Tədbir şəkli 5 MB-dan böyük ola bilməz.");
        const created=await eventMutations.create(submission.input);
        if(submission.imageFile){try{await uploadSecureImage(submission.imageFile,"event",created.id);}catch{completionNote=" Tədbir yaradıldı, lakin şəkil yüklənmədi; redaktə ekranından yenidən seçə bilərsiniz.";}}
      }

      const action = editor.mode === "create" ? "yaradıldı" : "yeniləndi";
      const name = submission.input.name || editor.record?.name || "Qeyd";
      setEditor(null);
      setFeedback({ id: Date.now(), message: `${name} uğurla ${action}.${completionNote}` });
    } catch (error) {
      setFormError(getMutationErrorMessage(error));
    }
  }

  async function deleteRecord() {
    const record = editor?.record;
    if (!record || editor?.mode !== "delete") return;
    setFormError(null);

    try {
      if (record.kind === "users") {
        if (!capabilities.canDeleteUsers) {
          throw new Error("İstifadəçi silmək yalnız əsas administratora açıqdır.");
        }
        await userMutations.remove(record.id);
      }
      if (record.kind === "clubs") await clubMutations.remove(record.id);
      if (record.kind === "events") await eventMutations.remove(record.id);
      setEditor(null);
      setFeedback({ id: Date.now(), message: `${record.name} siyahıdan silindi.` });
    } catch (error) {
      setFormError(getMutationErrorMessage(error));
    }
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-main">
        <motion.header
          className="admin-header"
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.52, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="admin-header__copy">
            <span>
              <ShieldCheck size={14} strokeWidth={1.8} aria-hidden="true" />
              İdarəetmə mərkəzi
            </span>
            <h1 className="module-page-title">İdarəetmə</h1>
          </div>

          <div className="admin-header__utilities">
            <p
              className={`admin-connection-state${hasConnectionError ? " has-error" : ""}${isRefreshing ? " is-refreshing" : ""}`}
              aria-live="polite"
            >
              <Circle size={8} fill="currentColor" aria-hidden="true" />
              {hasConnectionError
                ? "Bağlantını yoxla"
                : isRefreshing
                  ? "Məlumat yenilənir"
                  : demoMode
                    ? "Nümayiş rejimi · nümunə məlumat"
                    : "REST API-yə təhlükəsiz qoşulub"}
            </p>
            <div
              className="admin-account-chip"
              aria-label={demoMode ? "Nümayiş administrator hesabı" : "Aktiv administrator hesabı"}
            >
              <span aria-hidden="true">{getInitials(administrator.displayName)}</span>
              <div>
                <strong>{administrator.displayName}</strong>
                <em>{getAdminRoleLabel(administrator.role)}</em>
                <small>{demoMode ? "Yalnız təqdimat rejimi" : administrator.email}</small>
              </div>
            </div>
          </div>
        </motion.header>

        <section
          id="admin-overview"
          className="admin-overview"
          aria-labelledby="admin-overview-title"
          aria-busy={overview.isLoading || overview.isValidating}
        >
          <header className="admin-overview__heading">
            <div>
              <span>Canlı icmal</span>
              <h2 id="admin-overview-title">Bu gün platformada nə baş verir?</h2>
            </div>
            <div>
              {overview.data && (
                <time dateTime={overview.data.updatedAt}>
                  {formatUpdatedAt(overview.data.updatedAt)} yenilənib
                </time>
              )}
              <button
                type="button"
                onClick={() => void overview.refetch()}
                disabled={overview.isValidating}
                aria-label="Analitik məlumatları yenilə"
              >
                <RefreshCw size={15} aria-hidden="true" />
                <span>Yenilə</span>
              </button>
            </div>
          </header>

          {overview.isLoading ? (
            <AdminSkeleton scope="overview" />
          ) : overview.error || !overview.data ? (
            <div className="admin-error-state" role="alert">
              <span>Analitika əlçatan deyil</span>
              <h3>İcmalı hazırda göstərə bilmirik.</h3>
              <p>Digər idarəetmə bölmələri açıqdır. Bir az sonra yenidən yoxla.</p>
              <button type="button" onClick={() => void overview.refetch()}>
                <RefreshCw size={15} aria-hidden="true" />
                Yenidən yoxla
              </button>
            </div>
          ) : (
            <>
              <div className="admin-metrics-grid">
                {overview.data.metrics.map((metric, index) => (
                  <MetricCard key={metric.id} metric={metric} index={index} />
                ))}
              </div>
              <AdminCharts
                activity={overview.data.activity}
                distribution={overview.data.distribution.map((item) => ({
                  label: item.name,
                  value: item.value,
                }))}
              />
            </>
          )}
        </section>

        <AdminDataTable
          key={activeTable}
          activeKind={activeTable}
          rows={rows}
          loading={activeCollection.isLoading}
          error={activeCollection.error ?? null}
          mutationPending={mutationPending}
          canCreate={activeTable !== "users" || capabilities.canCreateUsers}
          canEdit
          canEditRow={(row) =>
            activeTable !== "users" || canEditUserRole(administrator.role, row.role ?? "")
          }
          canDelete={activeTable !== "users" || capabilities.canDeleteUsers}
          restrictionMessage={
            activeTable === "users" && administrator.role === "assistant_admin"
              ? "Admin köməkçisi yalnız tələbə, mentor və müəllim rollarını dəyişə bilər; administrator hesabları qorunur."
              : null
          }
          onCreate={() => openEditor("create")}
          onDelete={(id) => openEditor("delete", id)}
          onEdit={(id) => openEditor("edit", id)}
          onKindChange={selectTable}
          onPageChange={tableQuery.setPage}
          onRetry={() => void activeCollection.refetch()}
          onSearchChange={tableQuery.setDraftSearch}
          onStatusChange={tableQuery.setStatus}
          page={activeCollection.data?.page ?? tableQuery.page}
          pageSize={activeCollection.data?.pageSize ?? tableQuery.pageSize}
          queryPending={tableQuery.isDebouncing || activeCollection.isValidating}
          searchValue={tableQuery.draftSearch}
          status={tableQuery.status}
          total={activeCollection.data?.total ?? 0}
        />
        <ReviewModerationPanel />
        <MentorApplicationPanel />
        <AdminOperationsPanel />
      </div>

      <AdminRecordFormSheet
        open={Boolean(editor)}
        kind={editor?.record?.kind ?? activeTable}
        mode={editor?.mode ?? "create"}
        record={editor?.record ?? null}
        pending={mutationPending}
        error={formError}
        canAssignElevatedRoles={capabilities.canAssignElevatedRoles}
        userRoleOnly={
          administrator.role === "assistant_admin" &&
          editor?.mode === "edit" &&
          editor?.record?.kind === "users"
        }
        onClose={() => {
          if (mutationPending) return;
          setEditor(null);
          setFormError(null);
        }}
        onSubmit={submitRecord}
        onDelete={deleteRecord}
      />

      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.id}
            className="admin-crud-toast"
            role="status"
            initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <CheckCircle2 size={18} aria-hidden="true" />
            <span>{feedback.message}</span>
            <button type="button" onClick={() => setFeedback(null)} aria-label="Bildirişi bağla">
              <X size={15} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function getMutationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Əməliyyat tamamlanmadı. Məlumatları yoxlayıb yenidən cəhd et.";
}
