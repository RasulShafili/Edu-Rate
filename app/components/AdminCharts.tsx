"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CSSProperties } from "react";
import { useT } from "../i18n/LanguageProvider";

export type AdminActivityPoint = {
  label: string;
  users: number;
  clubs: number;
  events: number;
};

export type AdminDistributionPoint = {
  label: string;
  value: number;
};

type AdminChartsProps = {
  activity: readonly AdminActivityPoint[];
  distribution: readonly AdminDistributionPoint[];
};

const tooltipStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.98)",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  boxShadow: "0 18px 50px rgba(15, 23, 42, 0.14)",
  color: "#1e293b",
  fontSize: 12,
};

const cursorStyle = { stroke: "rgba(68, 118, 108, 0.34)", strokeWidth: 1 };
const barCursorStyle = { fill: "rgba(68, 118, 108, 0.06)" };
const distributionColors = ["#44766c", "#4f8fa3", "#7c68c5", "#c96d4e"];

/**
 * Birinci qrafik hər ayın SONUNA qədər yaradılmış qeydlərin cəmini göstərir
 * (backend `createdAt < ay sonu` sayır). Əvvəl "Platforma aktivliyi" adlanırdı —
 * halbuki xətt heç vaxt enə bilmir və aktivliyi yox, böyüməni ölçür.
 * İkincisi "kontent bölgüsü" deyil, klubların kateqoriyalar üzrə sayıdır.
 */
export function AdminCharts({ activity, distribution }: AdminChartsProps) {
  const t = useT();
  const reducedMotion = useReducedMotion();
  const animationDuration = reducedMotion ? 0 : 1050;

  return (
    <section className="admin-charts-grid" aria-label={t("admin.charts.label")}>
      <motion.figure
        className="admin-chart-card admin-chart-card--activity"
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.24 }}
        transition={{ duration: reducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="admin-chart-card__header">
          <div>
            <span>{t("admin.charts.growth.eyebrow")}</span>
            <h2>{t("admin.charts.growth.title")}</h2>
          </div>
          <div className="admin-chart-legend" aria-hidden="true">
            <span className="is-users">{t("admin.tab.users")}</span>
            <span className="is-clubs">{t("admin.tab.clubs")}</span>
            <span className="is-events">{t("admin.tab.events")}</span>
          </div>
        </header>

        <div
          className="admin-chart-card__canvas"
          role="img"
          aria-label={t("admin.charts.growth.aria")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[...activity]} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="admin-users-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#44766c" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#44766c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(30,41,59,0.1)" strokeDasharray="4 7" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
                width={44}
                allowDecimals={false}
              />
              <Tooltip contentStyle={tooltipStyle} cursor={cursorStyle} />
              <Area
                type="monotone"
                dataKey="users"
                name={t("admin.tab.users")}
                stroke="#44766c"
                strokeWidth={2.4}
                fill="url(#admin-users-fill)"
                isAnimationActive={!reducedMotion}
                animationDuration={animationDuration}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="clubs"
                name={t("admin.tab.clubs")}
                stroke="#4f8fa3"
                strokeWidth={1.8}
                fill="transparent"
                isAnimationActive={!reducedMotion}
                animationBegin={reducedMotion ? 0 : 130}
                animationDuration={animationDuration}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="events"
                name={t("admin.tab.events")}
                stroke="#7c68c5"
                strokeWidth={1.8}
                fill="transparent"
                isAnimationActive={!reducedMotion}
                animationBegin={reducedMotion ? 0 : 240}
                animationDuration={animationDuration}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.figure>

      <motion.figure
        className="admin-chart-card admin-chart-card--distribution"
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.24 }}
        transition={{
          duration: reducedMotion ? 0 : 0.55,
          delay: reducedMotion ? 0 : 0.08,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <header className="admin-chart-card__header">
          <div>
            <span>{t("admin.charts.clubs.eyebrow")}</span>
            <h2>{t("admin.charts.clubs.title")}</h2>
          </div>
        </header>

        {distribution.length === 0 ? (
          <p className="admin-chart-card__empty">{t("admin.charts.clubs.empty")}</p>
        ) : (
          <div
            className="admin-chart-card__canvas"
            role="img"
            aria-label={t("admin.charts.clubs.aria")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[...distribution]} margin={{ top: 14, right: 2, left: -30, bottom: 0 }}>
                <CartesianGrid stroke="rgba(30,41,59,0.1)" strokeDasharray="4 7" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={barCursorStyle} />
                <Bar
                  dataKey="value"
                  name={t("admin.charts.count")}
                  radius={[8, 8, 2, 2]}
                  maxBarSize={42}
                  isAnimationActive={!reducedMotion}
                  animationDuration={animationDuration}
                  animationEasing="ease-out"
                >
                  {distribution.map((entry, index) => (
                    <Cell
                      key={entry.label}
                      fill={distributionColors[index % distributionColors.length]}
                      fillOpacity={0.88}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.figure>
    </section>
  );
}
