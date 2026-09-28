"use client";

import { Clock3, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "../i18n/LanguageProvider";

/** "Mənimkilər" sorğusu; uğursuzluq SWR xətası kimi bloka çatır. */
export async function fetchMine<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  const payload = (await response.json()) as { data?: T[] };
  return payload.data ?? [];
}

export type SubmissionItem = {
  id: string;
  title: string;
  meta: string;
  statusLabel: string;
  tone: "pending" | "positive" | "negative" | "neutral";
};

type MySubmissionsProps = {
  headingId: string;
  title: string;
  body: string;
  items: readonly SubmissionItem[];
  /** SWR xətası; `fetchMine` statusu mesaj kimi atır. */
  error: unknown;
  onRetry: () => void;
  /** Hər sətir üçün əlavə əməliyyatlar (məs. redaktə / sil). */
  renderActions?: (item: SubmissionItem) => ReactNode;
  /** Siyahının altında göstərilən vəziyyət mesajı. */
  status?: string;
};

/**
 * Göndərənin öz tədbir/elan/paylaşımlarının vəziyyəti. Əvvəl hər dialoq
 * "yoxlanışa göndərildi" deyirdi, sonra isə təsdiqlənib-təsdiqlənmədiyini
 * göstərən heç bir yer yox idi — ictimai siyahılar yalnız dərc olunanı qaytarır.
 */
export function MySubmissions({ headingId, title, body, items, error, onRetry, renderActions, status }: MySubmissionsProps) {
  const t = useT();
  if (!error && items.length === 0) return null;
  // Vaxtı bitmiş sessiya "yüklənmədi" deyil — istifadəçi yenidən daxil olmalıdır.
  const expired = error instanceof Error && error.message === "401";

  return (
    <section className="my-submissions" aria-labelledby={headingId}>
      <header>
        <h2 id={headingId}><Clock3 size={16} aria-hidden="true" /> {title}</h2>
        <p>{body}</p>
      </header>
      {error ? (
        <p className="my-submissions__error" role="alert">
          {t(expired ? "admin.error.session" : "submissions.loadFailed")}
          <button type="button" onClick={onRetry}><RefreshCw size={13} aria-hidden="true" /> {t("common.retry")}</button>
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.meta}</small>
              </div>
              <span className={`my-submissions__status is-${item.tone}`}>{item.statusLabel}</span>
              {renderActions ? <div className="my-submissions__actions">{renderActions(item)}</div> : null}
            </li>
          ))}
        </ul>
      )}
      {status ? <p className="my-submissions__feedback" role="status">{status}</p> : null}
    </section>
  );
}
