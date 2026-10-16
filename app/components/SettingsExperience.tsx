"use client";

import Link from "next/link";
import { ArrowRight, LifeBuoy } from "lucide-react";
import { useT } from "../i18n/LanguageProvider";
import { PageHeader } from "./ui/Primitives";
import { PushToggle } from "./PushToggle";
import { DeleteAccountPanel } from "./DeleteAccountPanel";
import { PrivacyDataPanel } from "./PrivacyDataPanel";
import { TwoFactorPanel } from "./TwoFactorPanel";
import { useAuth } from "./AuthProvider";

/**
 * Əvvəl burada üç bildiriş açarı var idi ("Vacib elanlar", "Tədbir
 * xatırlatmaları", "İcma mesajları"). Seçim yalnız `localStorage`-ə yazılırdı
 * və kodda heç yerdə oxunmurdu; üstəlik tədbir və mesaj bildirişləri
 * ümumiyyətlə mövcud deyil. Push qurulmayan serverdə (production) səhifədəki
 * yeganə bildiriş idarəsi bu işləməyən açarlar idi. İndi yalnız həqiqətən
 * işləyən seçim göstərilir və nəyin olmadığı açıq deyilir.
 */
export function SettingsExperience() {
  const t = useT();
  const { user } = useAuth();
  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <PageHeader id="settings-title" eyebrow={t("settings.eyebrow")} title={t("settings.title")} />
      <div className="settings-card">
        <div className="settings-intro">
          <h2>{t("settings.notificationsTitle")}</h2>
          <p>{t("settings.notificationsBody")}</p>
        </div>
        <PushToggle />
      </div>

      <div className="settings-card settings-support-card">
        <div className="settings-intro">
          <h2>{t("settings.supportTitle")}</h2>
          <p>{t("settings.supportBody")}</p>
        </div>
        <div style={{ marginTop: "16px" }}>
          <Link
            href="/support"
            className="kuds-primary-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              minHeight: "44px",
              padding: "0 20px",
              borderRadius: "12px",
              textDecoration: "none",
              color: "#fff",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            <LifeBuoy size={17} aria-hidden="true" />
            <span>{t("settings.openSupport")}</span>
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* 2FA hələlik yığışdırılıb: yeni quraşdırma yoxdur. Artıq aktiv edən hesab
          paneli görür ki, onu söndürə bilsin (yoxsa girişdə kod soruşulmağa davam edir). */}
      {user?.twoFactorEnabled ? <TwoFactorPanel /> : null}
      <PrivacyDataPanel />
      <DeleteAccountPanel />
    </section>
  );
}
