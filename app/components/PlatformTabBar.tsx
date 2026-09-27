"use client";

import {
  CalendarDays,
  Compass,
  Home,
  Megaphone,
  Menu,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { isPlatformRouteCurrent } from "../data/platform-shell";
import { useT } from "../i18n/LanguageProvider";

type PlatformTabBarProps = {
  pathname: string;
  menuOpen: boolean;
  onMenu: () => void;
};

// Klaviatura açan elementlər — bunlara fokus olanda alt panel gizlədilir ki,
// yazı sahəsini örtməsin və klaviatura ilə "vuruşmasın".
function isTextEntry(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["checkbox", "radio", "range", "button", "submit", "reset", "file", "color"].includes(type);
  }
  return false;
}

const tabs: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "nav.home", icon: Home },
  { href: "/feed", label: "nav.feed", icon: Megaphone },
  { href: "/events", label: "nav.events", icon: CalendarDays },
  { href: "/clubs", label: "nav.clubs", icon: Compass },
];

/**
 * Mobil tətbiq üslubunda alt naviqasiya paneli.
 *
 * Yalnız telefon ölçülərində görünür (CSS ilə). Əsas bölmələrə bir toxunuşla
 * çıxış verir; beşinci düymə tam menyunu (yan paneli) açır. Masaüstündə tamamilə
 * gizlidir — orada sol naviqasiya reyi işləyir.
 */
export function PlatformTabBar({ pathname, menuOpen, onMenu }: PlatformTabBarProps) {
  const t = useT();
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (isTextEntry(event.target)) setTyping(true);
    };
    const onFocusOut = () => setTyping(false);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  return (
    <nav className={`platform-tabbar${typing ? " is-typing" : ""}`} aria-label={t("home.quickLinks")} aria-hidden={typing || undefined}>
      {tabs.map(({ href, label, icon: Icon }) => {
        const current = href === "/" ? pathname === "/" : isPlatformRouteCurrent(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`platform-tabbar-item${current ? " is-active" : ""}`}
            aria-current={current ? "page" : undefined}
          >
            <span className="platform-tabbar-icon"><Icon size={22} aria-hidden="true" /></span>
            <span className="platform-tabbar-label">{t(label)}</span>
          </Link>
        );
      })}
      <button
        type="button"
        className={`platform-tabbar-item${menuOpen ? " is-active" : ""}`}
        onClick={onMenu}
        aria-expanded={menuOpen}
        aria-controls="platform-mobile-navigation"
        aria-label={t(menuOpen ? "shell.menuClose" : "shell.menuOpen")}
      >
        <span className="platform-tabbar-icon"><Menu size={22} aria-hidden="true" /></span>
        <span className="platform-tabbar-label">{t("nav.menu")}</span>
      </button>
    </nav>
  );
}
