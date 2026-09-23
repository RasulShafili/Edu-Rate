"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LockKeyhole, MoreHorizontal, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import type { AdminRecordStatus } from "../data/admin";
import type { AdminUserRole } from "../data/admin";
import { useT } from "../i18n/LanguageProvider";
import { AdminDataControls } from "./AdminDataControls";
import { AdminSkeleton } from "./AdminSkeleton";

export type AdminTableKind = "users" | "clubs" | "events";

export type AdminTableRow = {
  id: string;
  name: string;
  detail: string;
  metric: string;
  status: string;
  statusTone: "positive" | "neutral" | "attention";
  updatedAt: string;
  role?: AdminUserRole;
};

type AdminDataTableProps = {
  activeKind: AdminTableKind;
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canEditRow?: (row: AdminTableRow) => boolean;
  error: Error | null;
  loading: boolean;
  mutationPending: boolean;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  onKindChange: (kind: AdminTableKind) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: AdminRecordStatus | "all") => void;
  page: number;
  pageSize: number;
  queryPending: boolean;
  restrictionMessage: string | null;
  rows: readonly AdminTableRow[];
  searchValue: string;
  status: AdminRecordStatus | "all";
  total: number;
};

const tableKinds: readonly AdminTableKind[] = ["users", "clubs", "events"];

export function AdminDataTable({
  activeKind,
  canCreate,
  canDelete,
  canEdit,
  canEditRow,
  error,
  loading,
  mutationPending,
  onCreate,
  onDelete,
  onEdit,
  onKindChange,
  onPageChange,
  onRetry,
  onSearchChange,
  onStatusChange,
  page,
  pageSize,
  queryPending,
  restrictionMessage,
  rows,
  searchValue,
  status,
  total,
}: AdminDataTableProps) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  // Sətrin surəti yox, id saxlanır: dil dəyişəndə və ya siyahı yenilənəndə
  // inspektor köhnə mətni göstərməsin.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const label = t(`admin.tab.${activeKind}`);
  const metricLabel = t(`admin.table.metric.${activeKind}`);

  function selectKind(kind: AdminTableKind) {
    setSelectedId(null);
    onKindChange(kind);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentKind: AdminTableKind,
  ) {
    const currentIndex = tableKinds.indexOf(currentKind);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tableKinds.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + tableKinds.length) % tableKinds.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tableKinds.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextKind = tableKinds[nextIndex];
    selectKind(nextKind);
    document.getElementById(`admin-${nextKind}-tab`)?.focus();
  }

  return (
    <section id="admin-data" className="admin-data-section" aria-labelledby="admin-data-title">
      <header className="admin-data-section__heading">
        <div>
          <span>{t("admin.data.eyebrow")}</span>
          <h2 id="admin-data-title">{t("admin.data.title")}</h2>
        </div>
        <p>{t("admin.data.text")}</p>
      </header>

      <div className="admin-data-toolbar">
        <div className="admin-data-tabs" role="tablist" aria-label={t("admin.data.tablist")}>
          {tableKinds.map((kind) => (
            <button
              key={kind}
              id={`admin-${kind}-tab`}
              type="button"
              role="tab"
              aria-selected={activeKind === kind}
              aria-controls="admin-data-panel"
              tabIndex={activeKind === kind ? 0 : -1}
              onClick={() => selectKind(kind)}
              onKeyDown={(event) => handleTabKeyDown(event, kind)}
            >
              <span>{t(`admin.tab.${kind}`)}</span>
              {activeKind === kind && (
                <motion.span
                  className="admin-data-tabs__active"
                  layoutId="admin-data-active-tab"
                  transition={{ type: "spring", stiffness: 410, damping: 35 }}
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>

        {canCreate ? (
          <button
            type="button"
            className="admin-crud-create-button"
            onClick={onCreate}
            disabled={mutationPending}
          >
            <Plus size={16} aria-hidden="true" />
            {t(`admin.table.create.${activeKind}`)}
          </button>
        ) : (
          <span className="admin-permission-badge">
            <LockKeyhole size={14} aria-hidden="true" />
            {t("admin.data.restricted")}
          </span>
        )}
      </div>

      {restrictionMessage && (
        <p className="admin-permission-note" role="note">
          <LockKeyhole size={15} aria-hidden="true" />
          {restrictionMessage}
        </p>
      )}

      <AdminDataControls
        kind={activeKind}
        loading={queryPending}
        onPageChange={onPageChange}
        onRefresh={onRetry}
        onSearchChange={onSearchChange}
        onStatusChange={onStatusChange}
        page={page}
        pageSize={pageSize}
        searchValue={searchValue}
        status={status}
        total={total}
      />

      <div
        id="admin-data-panel"
        className="admin-data-panel"
        role="tabpanel"
        aria-labelledby={`admin-${activeKind}-tab`}
        aria-busy={loading || queryPending}
      >
        {loading ? (
          <AdminSkeleton scope="table" />
        ) : error ? (
          <div className="admin-error-state" role="alert">
            <span>{t("admin.data.errorEyebrow")}</span>
            <h3>{t("admin.data.errorTitle")}</h3>
            <p>{t("admin.data.errorText")}</p>
            <button type="button" onClick={onRetry}>
              <RefreshCw size={15} aria-hidden="true" />
              {t("common.retry")}
            </button>
          </div>
        ) : (
          <div className="admin-table-shell">
            <table className="admin-data-table">
              <caption className="sr-only">
                {t("admin.table.caption", { label, shown: rows.length, total })}
              </caption>
              <thead className="admin-data-table__header">
                <tr>
                  <th scope="col">{label}</th>
                  <th scope="col">{t(`admin.table.detail.${activeKind}`)}</th>
                  <th scope="col">{metricLabel}</th>
                  <th scope="col">{t("admin.table.status")}</th>
                  <th scope="col">{t("admin.table.updated")}</th>
                  <th scope="col">
                    <span className="sr-only">{t("admin.table.actions")}</span>
                  </th>
                </tr>
              </thead>
              <motion.tbody layout>
                <AnimatePresence mode="popLayout" initial={!reducedMotion}>
                  {rows.map((row, index) => (
                    <motion.tr
                      key={`${activeKind}-${row.id}`}
                      layout
                      initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, y: -6 }}
                      transition={{
                        duration: reducedMotion ? 0 : 0.34,
                        delay: reducedMotion ? 0 : Math.min(index * 0.045, 0.28),
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <th scope="row">
                        <span className="admin-table-row-index" aria-hidden="true">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="admin-table-primary">
                          <strong>{row.name}</strong>
                          <small>ID · {row.id}</small>
                        </span>
                      </th>
                      <td>{row.detail}</td>
                      <td>{row.metric}</td>
                      <td>
                        <span className={`admin-table-status is-${row.statusTone}`}>
                          <i aria-hidden="true" />
                          {row.status}
                        </span>
                      </td>
                      <td>{row.updatedAt}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-table-action"
                          onClick={() =>
                            setSelectedId((current) => (current === row.id ? null : row.id))
                          }
                          aria-expanded={selectedRow?.id === row.id}
                          aria-controls="admin-row-inspector"
                          aria-label={t("admin.table.details", { name: row.name })}
                          disabled={mutationPending}
                        >
                          <MoreHorizontal size={18} aria-hidden="true" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </motion.tbody>
            </table>

            {rows.length === 0 && (
              <div className="admin-table-empty" role="status">
                <Search size={20} aria-hidden="true" />
                <strong>{t("admin.table.empty")}</strong>
                <span>{t("admin.table.emptyHint")}</span>
              </div>
            )}

            <AnimatePresence>
              {selectedRow && (
                <motion.aside
                  id="admin-row-inspector"
                  className="admin-row-inspector"
                  aria-live="polite"
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? undefined : { opacity: 0, y: 8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.24 }}
                >
                  <div>
                    <span>{t("admin.inspector.eyebrow")}</span>
                    <strong>{selectedRow.name}</strong>
                    <small>{selectedRow.detail}</small>
                  </div>
                  <dl>
                    <div>
                      <dt>{metricLabel}</dt>
                      <dd>{selectedRow.metric}</dd>
                    </div>
                    <div>
                      <dt>{t("admin.table.status")}</dt>
                      <dd>{selectedRow.status}</dd>
                    </div>
                    <div>
                      <dt>{t("admin.table.updated")}</dt>
                      <dd>{selectedRow.updatedAt}</dd>
                    </div>
                  </dl>
                  <div className="admin-row-inspector__actions">
                    {canEdit && (canEditRow?.(selectedRow) ?? true) && (
                    <button
                      type="button"
                      onClick={() => {
                        onEdit(selectedRow.id);
                        setSelectedId(null);
                      }}
                      disabled={mutationPending}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      {t("admin.inspector.edit")}
                    </button>
                    )}
                    {canDelete && (
                    <button
                      type="button"
                      className="is-danger"
                      onClick={() => {
                        onDelete(selectedRow.id);
                        setSelectedId(null);
                      }}
                      disabled={mutationPending}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      {t("common.delete")}
                    </button>
                    )}
                    {(!canEdit || !(canEditRow?.(selectedRow) ?? true)) && !canDelete && (
                      <span className="admin-row-inspector__read-only">
                        <LockKeyhole size={14} aria-hidden="true" />
                        {t("admin.inspector.readOnly")}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    aria-label={t("admin.inspector.close")}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </section>
  );
}
