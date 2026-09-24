"use client";

import { ArrowLeft, KeyRound, ShieldAlert, Smartphone, WifiOff } from "lucide-react";
import Link from "next/link";
import { useT } from "../i18n/LanguageProvider";

export type AdminAccessDeniedState =
  | { status: "signed-out"; signInHref: string }
  | { status: "forbidden" }
  | { status: "two-factor-required" }
  | { status: "unavailable" };

type AdminAccessStateProps = {
  access: AdminAccessDeniedState;
};

const content = {
  "signed-out": { prefix: "admin.access.signedOut", action: "admin.access.signedOut.action", icon: KeyRound },
  forbidden: { prefix: "admin.access.forbidden", action: "admin.access.forbidden.action", icon: ShieldAlert },
  "two-factor-required": { prefix: "admin.access.twoFactor", action: "admin.access.twoFactor.action", icon: Smartphone },
  unavailable: { prefix: "admin.access.unavailable", action: "common.retry", icon: WifiOff },
} as const;

export function AdminAccessState({ access }: AdminAccessStateProps) {
  const t = useT();
  const state = content[access.status];
  const Icon = state.icon;
  const href =
    access.status === "signed-out"
      ? access.signInHref
      : access.status === "unavailable"
        ? "/admin"
        : access.status === "two-factor-required"
          ? "/settings#two-factor"
          : "/";

  return (
    <section
      className="profile-section profile-empty-section"
      aria-labelledby="admin-access-title"
    >
      <div
        className="profile-empty-card"
        role={access.status === "unavailable" ? "alert" : "status"}
        aria-live="polite"
      >
        <span className="profile-empty-mark" aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="profile-kicker">{t(`${state.prefix}.eyebrow`)}</span>
        <h1 id="admin-access-title">{t(`${state.prefix}.title`)}</h1>
        <p>{t(`${state.prefix}.text`)}</p>
        <Link href={href} className="profile-empty-action">
          {access.status !== "signed-out" && access.status !== "two-factor-required" && (
            <ArrowLeft size={16} aria-hidden="true" />
          )}
          {t(state.action)}
        </Link>
      </div>
    </section>
  );
}
