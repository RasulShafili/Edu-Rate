"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  CalendarDays,
  CheckCircle2,
  Circle,
  LockKeyhole,
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
import { useT } from "../i18n/LanguageProvider";
import { AdminInputError, adminErrorKey } from "../lib/admin-errors";
import {
  getAdminCapabilities,
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

type Translate = ReturnType<typeof useT>;

const metricIcons: Record<AdminMetric["id"], LucideIcon> = {
  users: UsersRound,
  clubs: Network,
  events: CalendarDays,
  engagement: Activity,
};

const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageBytes = 5 * 1024 * 1024;

function statusTone(status: AdminRecordStatus): AdminTableRow["statusTone"] {
  if (status === "Aktiv" || status === "Açıq") return "positive";
  if (status === "Tamamlanıb") return "neutral";
  return "attention";
}

/** Tərcümə yoxdursa (bazada naməlum dəyər) xam dəyəri göstər, açarın özünü yox. */
function labelOr(t: Translate, key: string, raw: string): string {
  const value = t(key);
  return value === key ? raw : value;
}

/** Bakı vaxtı (UTC+4), ay adı lüğətdən: "23 sen 14:05". */
function formatBakuDateTime(value: string, t: Translate): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const bakuDate = new Date(date.getTime() + 4 * 60 * 60 * 1000);
  const day = String(bakuDate.getUTCDate()).padStart(2, "0");
  const hour = String(bakuDate.getUTCHours()).padStart(2, "0");
  const minute = String(bakuDate.getUTCMinutes()).padStart(2, "0");
  return `${day} ${t(`monthShort.${bakuDate.getUTCMonth() + 1}`)} ${hour}:${minute}`;
}

/**
 * Cədvəlin "detal" və "göstərici" sütunları xam sahələrdən qurulur. Əvvəl backend-in
 * hazır azərbaycanca mətni göstərilirdi — istifadəçi sətrində hətta xam `student`
 * rolu və fakültə yazılırdı, e-poçt isə heç görünmürdü.
 */
function describeRecord(
  record: AdminCollectionRecord,
  t: Translate,
): Pick<AdminTableRow, "detail" | "metric"> {
  if (record.kind === "users") {
    return {
      detail: `${record.email} · ${labelOr(t, `role.${record.role}`, record.role)}`,
      metric:
        record.emailVerified === undefined
          ? record.metric
          : t(record.emailVerified ? "admin.user.emailVerified" : "admin.user.emailUnverified"),
    };
  }
  if (record.kind === "clubs") {
    return {
      detail: `${labelOr(t, `clubCategory.${record.category}`, record.category)} · ${t("admin.club.members", { count: record.memberCount })}`,
      metric: t("admin.club.events", { count: record.eventCount }),
    };
  }
  return {
    detail: `${formatBakuDateTime(record.startAt, t)} · ${record.place}`,
    metric: `${record.attendeeCount} / ${record.capacity}`,
  };
}

function toTableRows(records: readonly AdminCollectionRecord[], t: Translate): AdminTableRow[] {
  return records.map((record) => ({
    id: record.id,
    name: record.name,
    ...describeRecord(record, t),
    status: labelOr(t, `admin.status.${record.status}`, record.status),
    statusTone: statusTone(record.status),
    updatedAt: formatBakuDateTime(record.updatedAt, t),
    role: record.kind === "users" ? record.role : undefined,
  }));
}

function metricSummary(metric: AdminMetric, t: Translate): string {
  const counts = metric.counts;
  if (!counts) return metric.change;
  const total = t("admin.metric.total", { count: counts.total ?? 0 });
  if (metric.id === "users") return total;
  if (metric.id === "clubs") return `${total} · ${t("admin.metric.pendingClubs", { count: counts.pending ?? 0 })}`;
  if (metric.id === "events") return `${total} · ${t("admin.metric.drafts", { count: counts.pending ?? 0 })}`;
  return `${t("admin.metric.memberships", { count: counts.memberships ?? 0 })} · ${t("admin.metric.reviews", { count: counts.reviews ?? 0 })}`;
}

type MetricCardProps = {
  index: number;
  metric: AdminMetric;
};

/**
 * Göstərici kartı yalnız real rəqəmləri göstərir. Əvvəl hər kartda yaşıl "artım"
 * oxu və "əvvəlki dövrlə müqayisə" yazısı vardı; backend isə `trend`-i sabit
 * "up" göndərirdi — heç bir müqayisə aparılmırdı.
 */
function MetricCard({ index, metric }: MetricCardProps) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const Icon = metricIcons[metric.id];

  return (
    <motion.article
      className={`admin-metric-card is-${metric.id}`}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reducedMotion ? 0 : 0.46,
        delay: reducedMotion ? 0 : 0.06 + index * 0.055,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <header>
        <span>{metric.counts ? t(`admin.metric.${metric.id}`) : metric.label}</span>
        <i aria-hidden="true">
          <Icon size={17} strokeWidth={1.8} />
        </i>
      </header>
      <strong>{metric.counts ? metric.counts.value : metric.value}</strong>
      <footer>
        <span>{metricSummary(metric, t)}</span>
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
};

type EditorState = {
  mode: AdminRecordSheetMode;
  record: AdminCollectionRecord | null;
};

/** Bildiriş mətn yox, açar daşıyır ki, dil dəyişəndə də düzgün göstərilsin. */
type CrudFeedback = {
  id: number;
  key: string;
  name?: string;
  noteKey?: string;
  /** İcazə rəddi uğur işarəsi ilə göstərilməsin. */
  denied?: boolean;
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("az") ?? "")
    .join("") || "ER";
}

function assertImage(file: File | undefined) {
  if (!file) return;
  if (!allowedImageTypes.includes(file.type)) throw new AdminInputError("admin.error.imageType");
  if (file.size > maxImageBytes) throw new AdminInputError("admin.error.imageSize");
}

export function AdminDashboard({ administrator }: AdminDashboardProps) {
  const t = useT();
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
  const rows = toTableRows(collectionItems, t);
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
      setFeedback({ id: Date.now(), key: "admin.feedback.createOwnerOnly", denied: true });
      return;
    }
    if (
      activeTable === "users" &&
      mode === "edit" &&
      record?.kind === "users" &&
      !canEditUserRole(administrator.role, record.role)
    ) {
      setFeedback({ id: Date.now(), key: "admin.feedback.adminAccountsOwnerOnly", denied: true });
      return;
    }
    if (mode !== "create" && !record) return;
    setFormError(null);
    setEditor({ mode, record });
  }

  async function submitRecord(submission: AdminRecordSubmission) {
    if (!editor || editor.mode === "delete") return;
    setFormError(null);
    let imageFailed = false;

    try {
      if (submission.kind === "users") {
        if (editor.mode === "edit" && editor.record?.kind === "users") {
          if (administrator.role === "assistant_admin") {
            const role = submission.input.role;
            if (!isAssignableUserRole(role) || !canEditUserRole(administrator.role, editor.record.role)) {
              throw new AdminInputError("admin.error.roleNotAllowed");
            }
            await userMutations.update(editor.record.id, { role });
          } else {
            await userMutations.update(editor.record.id, submission.input);
          }
        } else {
          if (!capabilities.canCreateUsers) {
            throw new AdminInputError("admin.feedback.createOwnerOnly");
          }
          await userMutations.create(submission.input);
        }
      } else if (submission.kind === "clubs") {
        if (editor.mode === "edit" && editor.record?.kind === "clubs") {
          await clubMutations.update(editor.record.id, submission.input);
        } else {
          assertImage(submission.coverFile);
          const club = await clubMutations.create(submission.input);
          if (submission.coverFile) {
            try {
              await uploadSecureImage(submission.coverFile, "club", club.id);
            } catch {
              imageFailed = true;
            }
          }
        }
      } else if (editor.mode === "edit" && editor.record?.kind === "events") {
        await eventMutations.update(editor.record.id, submission.input);
      } else {
        assertImage(submission.imageFile);
        const created = await eventMutations.create(submission.input);
        if (submission.imageFile) {
          try {
            await uploadSecureImage(submission.imageFile, "event", created.id);
          } catch {
            imageFailed = true;
          }
        }
      }

      setEditor(null);
      setFeedback({
        id: Date.now(),
        key: editor.mode === "create" ? "admin.feedback.created" : "admin.feedback.updated",
        name: submission.input.name || editor.record?.name || "",
        noteKey: imageFailed ? "admin.feedback.imageNotUploaded" : undefined,
      });
    } catch (error) {
      setFormError(adminErrorKey(error));
    }
  }

  async function deleteRecord() {
    const record = editor?.record;
    if (!record || editor?.mode !== "delete") return;
    setFormError(null);

    try {
      if (record.kind === "users") {
        if (!capabilities.canDeleteUsers) {
          throw new AdminInputError("admin.feedback.deleteOwnerOnly");
        }
        await userMutations.remove(record.id);
      }
      if (record.kind === "clubs") await clubMutations.remove(record.id);
      if (record.kind === "events") await eventMutations.remove(record.id);
      setEditor(null);
      setFeedback({ id: Date.now(), key: "admin.feedback.deleted", name: record.name });
    } catch (error) {
      setFormError(adminErrorKey(error));
    }
  }

  const connectionLabel = hasConnectionError
    ? t("admin.connection.error")
    : isRefreshing
      ? t("admin.connection.refreshing")
      : t("admin.connection.live");

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
              {t("admin.header.eyebrow")}
            </span>
            <h1 className="module-page-title">{t("admin.header.title")}</h1>
          </div>

          <div className="admin-header__utilities">
            <p
              className={`admin-connection-state${hasConnectionError ? " has-error" : ""}${isRefreshing ? " is-refreshing" : ""}`}
              aria-live="polite"
            >
              <Circle size={8} fill="currentColor" aria-hidden="true" />
              {connectionLabel}
            </p>
            <div className="admin-account-chip" aria-label={t("admin.account.label")}>
              <span aria-hidden="true">{getInitials(administrator.displayName)}</span>
              <div>
                <strong>{administrator.displayName}</strong>
                <em>{t(`role.${administrator.role}`)}</em>
                <small>{administrator.email}</small>
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
              <span>{t("admin.overview.eyebrow")}</span>
              <h2 id="admin-overview-title">{t("admin.overview.title")}</h2>
            </div>
            <div>
              {overview.data && (
                <time dateTime={overview.data.updatedAt}>
                  {t("admin.overview.updatedAt", { time: formatBakuDateTime(overview.data.updatedAt, t) })}
                </time>
              )}
              <button
                type="button"
                onClick={() => void overview.refetch()}
                disabled={overview.isValidating}
                aria-label={t("admin.overview.refreshLabel")}
              >
                <RefreshCw size={15} aria-hidden="true" />
                <span>{t("admin.refresh")}</span>
              </button>
            </div>
          </header>

          {overview.isLoading ? (
            <AdminSkeleton scope="overview" />
          ) : overview.error || !overview.data ? (
            <div className="admin-error-state" role="alert">
              <span>{t("admin.overview.errorEyebrow")}</span>
              <h3>{t("admin.overview.errorTitle")}</h3>
              <p>{t("admin.overview.errorText")}</p>
              <button type="button" onClick={() => void overview.refetch()}>
                <RefreshCw size={15} aria-hidden="true" />
                {t("common.retry")}
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
                activity={overview.data.activity.map((point) => ({
                  ...point,
                  label: point.month ? t(`monthShort.${Number(point.month.slice(5))}`) : point.label,
                }))}
                distribution={overview.data.distribution.map((item) => ({
                  label: labelOr(t, `clubCategory.${item.name}`, item.name),
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
              ? t("admin.restriction.assistant")
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
        error={formError ? t(formError) : null}
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
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 10 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {feedback.denied ? <LockKeyhole size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
            <span>
              {t(feedback.key, { name: feedback.name ?? "" })}
              {feedback.noteKey ? ` ${t(feedback.noteKey)}` : ""}
            </span>
            <button type="button" onClick={() => setFeedback(null)} aria-label={t("admin.feedback.close")}>
              <X size={15} aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
