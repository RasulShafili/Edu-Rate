"use client";

import { Menu, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useT } from "../i18n/LanguageProvider";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "./AuthProvider";
import { MotionLayer } from "./MotionLayer";
import { CookieConsent, openCookieSettings } from "./CookieConsent";
import { LegalConsentGate } from "./LegalConsentGate";
import { PwaLayer } from "./PwaLayer";
import { PlatformHeader } from "./PlatformHeader";
import { PlatformNavigationRail } from "./PlatformNavigationRail";
import { PlatformTabBar } from "./PlatformTabBar";
import { PlatformUtilityRail, type UtilityTab } from "./PlatformUtilityRail";
import { RouteTransition } from "./RouteTransition";

type PlatformShellProps = {
  children: ReactNode;
};

export function PlatformShell({ children }: PlatformShellProps) {
  const t = useT();
  const pathname = usePathname();
  const { isAdmin, user } = useAuth();
  const [navigationState, setNavigationState] = useState({ pathname, open: false });
  const [toolsState, setToolsState] = useState({ pathname, open: false });
  const [desktopToolsState, setDesktopToolsState] = useState({ pathname, open: false });
  const [requestedUtilityTab, setRequestedUtilityTab] = useState<UtilityTab>("search");
  const navigationButtonRef = useRef<HTMLButtonElement>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const navigationOpen = navigationState.pathname === pathname && navigationState.open;
  const toolsOpen = toolsState.pathname === pathname && toolsState.open;
  const desktopToolsOpen = desktopToolsState.pathname === pathname && desktopToolsState.open;

  const closeNavigation = useCallback(() => {
    setNavigationState({ pathname, open: false });
    window.requestAnimationFrame(() => navigationButtonRef.current?.focus());
  }, [pathname]);

  const closeTools = useCallback(() => {
    setToolsState({ pathname, open: false });
    window.requestAnimationFrame(() => toolsButtonRef.current?.focus());
  }, [pathname]);

  useEffect(() => {
    if (!navigationOpen && !toolsOpen) return;

    const dialog = document.getElementById(
      navigationOpen ? "platform-mobile-navigation" : "platform-mobile-utility-sheet",
    );
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusFrame = window.requestAnimationFrame(() => {
      const focusable = dialog?.querySelectorAll<HTMLElement>(focusableSelector);
      focusable?.[0]?.focus();
    });

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Tab" && dialog) {
        const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (event.key !== "Escape") return;

      if (toolsOpen) {
        setToolsState({ pathname, open: false });
        toolsButtonRef.current?.focus();
        return;
      }

      setNavigationState({ pathname, open: false });
      navigationButtonRef.current?.focus();
    }

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [navigationOpen, pathname, toolsOpen]);

  useEffect(() => {
    if (!navigationOpen && !toolsOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [navigationOpen, toolsOpen]);

  useEffect(() => {
    function handleQuickSearch(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLocaleLowerCase("az") !== "k") {
        return;
      }

      event.preventDefault();
      setRequestedUtilityTab("search");
      setNavigationState({ pathname, open: false });
      if (window.matchMedia("(max-width: 767px)").matches) {
        setToolsState((current) => ({
          pathname,
          open: current.pathname === pathname ? !current.open : true,
        }));
      } else {
        setDesktopToolsState((current) => ({
          pathname,
          open: current.pathname === pathname ? !current.open : true,
        }));
      }
    }

    window.addEventListener("keydown", handleQuickSearch);
    return () => window.removeEventListener("keydown", handleQuickSearch);
  }, [pathname]);

  function toggleNavigation() {
    setDesktopToolsState({ pathname, open: false });
    setToolsState({ pathname, open: false });
    setNavigationState((current) => ({
      pathname,
      open: current.pathname === pathname ? !current.open : true,
    }));
  }

  function toggleTools(tab: UtilityTab = "search") {
    const sameTab = requestedUtilityTab === tab;
    setRequestedUtilityTab(tab);
    setNavigationState({ pathname, open: false });
    if (window.matchMedia("(max-width: 767px)").matches) {
      setDesktopToolsState({ pathname, open: false });
      setToolsState((current) => ({
        pathname,
        open: current.pathname === pathname && sameTab ? !current.open : true,
      }));
      return;
    }

    setToolsState({ pathname, open: false });
    setDesktopToolsState((current) => ({
      pathname,
      open: current.pathname === pathname && sameTab ? !current.open : true,
    }));
  }

  return (
    <div className="site-shell kuds-shell">
      <MotionLayer />
      <PwaLayer />
      <CookieConsent />
      <LegalConsentGate />
      <a className="skip-link" href="#main-content">{t("nav.skipToContent")}</a>

      <button
        ref={navigationButtonRef}
        type="button"
        className="platform-mobile-nav-trigger"
        onClick={toggleNavigation}
        aria-expanded={navigationOpen}
        aria-controls="platform-mobile-navigation"
        aria-label={t(navigationOpen ? "shell.navClose" : "shell.navOpen")}
      >
        <Menu size={21} />
      </button>

      <button
        ref={toolsButtonRef}
        type="button"
        className="platform-mobile-tools-trigger"
        onClick={() => toggleTools("search")}
        aria-expanded={toolsOpen}
        aria-controls="platform-mobile-utility-sheet"
        aria-label={t(toolsOpen ? "shell.toolsClose" : "shell.toolsOpen")}
      >
        <SlidersHorizontal size={20} />
      </button>

      <PlatformNavigationRail
        pathname={pathname}
        authenticated={Boolean(user)}
        isAdmin={isAdmin}
        accountRole={user?.accessRole}
        mobileOpen={navigationOpen}
        onMobileClose={closeNavigation}
      />
      <div className="platform-workspace">
        <PlatformHeader
          searchOpen={desktopToolsOpen && requestedUtilityTab === "search"}
          updatesOpen={desktopToolsOpen && requestedUtilityTab === "updates"}
          onSearchToggle={() => toggleTools("search")}
          onUpdatesToggle={() => toggleTools("updates")}
        />

        <div className="platform-route-content">
          <RouteTransition>{children}</RouteTransition>

          <footer className="site-footer" data-home={pathname === "/" ? "true" : "false"}>
            <Link href="/" className="brand"><span className="brand-mark"><span /></span>EDURATE</Link>
            <div>
              <span>© 2026 EduRate</span>
              <LanguageSwitcher />
            </div>
            <nav className="site-footer__legal" aria-label={t("footer.legal")}>
              <Link href="/privacy">{t("legalNav.privacy")}</Link>
              <Link href="/terms">{t("legalNav.terms")}</Link>
              <Link href="/cookies">{t("legalNav.cookies")}</Link>
              <Link href="/community-guidelines">{t("legalNav.guidelines")}</Link>
              <button type="button" onClick={openCookieSettings}>{t("legalNav.cookieSettings")}</button>
              <Link href="/support?topic=privacy">{t("legalNav.privacyRequest")}</Link>
            </nav>
          </footer>
        </div>
      </div>
      <PlatformTabBar pathname={pathname} menuOpen={navigationOpen} onMenu={toggleNavigation} />
      <PlatformUtilityRail
        key={`${pathname}:${requestedUtilityTab}`}
        mobileOpen={toolsOpen}
        onMobileClose={closeTools}
        desktopOpen={desktopToolsOpen}
        onDesktopOpenChange={(open) => setDesktopToolsState({ pathname, open })}
        requestedTab={requestedUtilityTab}
      />
    </div>
  );
}
