"use client";

import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useId } from "react";
import type {
  AdminCollectionKind,
  AdminRecordStatus,
} from "../data/admin";
import { useT } from "../i18n/LanguageProvider";

/** Dəyərlər bazadakı vəziyyətlərdir (azərbaycanca); görünən ad lüğətdən gəlir. */
const statusOptions: Record<AdminCollectionKind, readonly AdminRecordStatus[]> = {
  users: ["Aktiv", "Gözləmədə", "Məhdudlaşdırılıb"],
  clubs: ["Aktiv", "Gözləmədə", "Məhdudlaşdırılıb"],
  events: ["Açıq", "Qaralama", "Tamamlanıb"],
};

export type AdminDataControlsProps = {
  kind: AdminCollectionKind;
  loading: boolean;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: AdminRecordStatus | "all") => void;
  page: number;
  pageSize: number;
  searchValue: string;
  status: AdminRecordStatus | "all";
  total: number;
};

export function AdminDataControls({
  kind,
  loading,
  onPageChange,
  onRefresh,
  onSearchChange,
  onStatusChange,
  page,
  pageSize,
  searchValue,
  status,
  total,
}: AdminDataControlsProps) {
  const t = useT();
  const searchId = useId();
  const statusId = useId();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, total);
  const label = t(`admin.tab.${kind}`);

  useEffect(() => {
    if (page > totalPages) onPageChange(totalPages);
  }, [onPageChange, page, totalPages]);

  return (
    <div className="admin-server-controls" aria-busy={loading}>
      <div className="admin-server-controls__query">
        <label className="admin-data-search" htmlFor={searchId}>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{t("admin.search.label", { label })}</span>
          <input
            id={searchId}
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            // Backend istifadəçini ad və e-poçtla, klub və tədbiri adla axtarır.
            placeholder={t(kind === "users" ? "admin.search.placeholder.users" : "admin.search.placeholder.other")}
            autoComplete="off"
          />
        </label>

        <label className="admin-status-filter" htmlFor={statusId}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          <span className="sr-only">{t("admin.filter.label")}</span>
          <select
            id={statusId}
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as AdminRecordStatus | "all")
            }
          >
            <option value="all">{t("admin.filter.all")}</option>
            {statusOptions[kind].map((value) => (
              <option key={value} value={value}>
                {t(`admin.status.${value}`)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="admin-data-refresh-button"
          onClick={onRefresh}
          disabled={loading}
          aria-label={t("admin.table.refresh")}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      <nav className="admin-pagination" aria-label={t("admin.pagination.label", { label })}>
        <p aria-live="polite">
          <strong>{rangeStart}–{rangeEnd}</strong>
          <span> {t("admin.pagination.results", { total })}</span>
        </p>
        <div>
          <button
            type="button"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1 || loading}
            aria-label={t("admin.pagination.prev")}
          >
            <ChevronLeft size={17} aria-hidden="true" />
          </button>
          <span aria-current="page">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages || loading}
            aria-label={t("admin.pagination.next")}
          >
            <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
}
