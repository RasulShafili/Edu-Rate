"use client";

import { useT } from "../i18n/LanguageProvider";
import { PageHeader } from "./ui/Primitives";
import { PushToggle } from "./PushToggle";
import { DeleteAccountPanel } from "./DeleteAccountPanel";

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
      <DeleteAccountPanel />
    </section>
  );
}
