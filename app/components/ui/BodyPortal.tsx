"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribeNoop = () => () => undefined;

/**
 * Modal pəncərəni `body`-yə çıxarır. Səhifə keçid animasiyası (`transform`)
 * `position: fixed` elementi öz qatına bağlayırdı: dialoq ekranın deyil, məzmun
 * sahəsinin mərkəzində açılır, sol menyu isə onun üstünə düşürdü.
 * Serverdə və ilk hidrasiyada heç nə render etmir (uyğunsuzluq olmasın).
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  return mounted ? createPortal(children, document.body) : null;
}
