"use client";

import { useT } from "../i18n/LanguageProvider";

type AdminSkeletonProps = {
  scope?: "page" | "overview" | "table";
};

const metricSkeletons = ["metric-one", "metric-two", "metric-three", "metric-four"];
const tableSkeletons = ["row-one", "row-two", "row-three", "row-four", "row-five"];

function OverviewSkeleton() {
  return (
    <div className="admin-skeleton__overview" aria-hidden="true">
      <div className="admin-metrics-grid">
        {metricSkeletons.map((id) => (
          <div key={id} className="admin-skeleton admin-skeleton--metric">
            <span />
            <strong />
            <i />
          </div>
        ))}
      </div>
      <div className="admin-charts-grid">
        <div className="admin-skeleton admin-skeleton--chart">
          <span />
          <i />
        </div>
        <div className="admin-skeleton admin-skeleton--chart">
          <span />
          <i />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="admin-skeleton admin-skeleton--table" aria-hidden="true">
      <div className="admin-skeleton__table-tabs">
        <span />
        <span />
        <span />
      </div>
      <div className="admin-skeleton__table-head" />
      {tableSkeletons.map((id) => (
        <div key={id} className="admin-skeleton__table-row">
          <span />
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}

export function AdminSkeleton({
  scope = "page",
}: AdminSkeletonProps) {
  const t = useT();

  if (scope === "overview") {
    return (
      <div className="admin-skeleton-region" role="status" aria-live="polite">
        <span className="sr-only">{t("admin.skeleton.overview")}</span>
        <OverviewSkeleton />
      </div>
    );
  }

  if (scope === "table") {
    return (
      <div className="admin-skeleton-region" role="status" aria-live="polite">
        <span className="sr-only">{t("admin.skeleton.table")}</span>
        <TableSkeleton />
      </div>
    );
  }

  // Yüklənmə placeholder-i landmark/id daşımır (bax: app/loading.tsx qeydi) —
  // əks halda əsl səhifə ilə birlikdə iki <main> və təkrar id yaranır.
  return (
    <div
      className="route-page admin-dashboard admin-dashboard--loading"
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        {t("admin.skeleton.page")}
      </span>
      <div
        className="admin-main admin-skeleton__main"
        style={{ gridColumn: "1 / -1" }}
      >
        <header className="admin-header admin-skeleton__header" aria-hidden="true">
          <div>
            <span className="admin-skeleton admin-skeleton--eyebrow" />
            <span className="admin-skeleton admin-skeleton--title" />
          </div>
          <span className="admin-skeleton admin-skeleton--account" />
        </header>
        <OverviewSkeleton />
        <section className="admin-data-section">
          <TableSkeleton />
        </section>
      </div>
    </div>
  );
}
