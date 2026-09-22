"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  CalendarRange,
  CircleHelp,
  MessageCircleQuestion,
  Compass,
  GraduationCap,
  HeartHandshake,
  Home,
  LogIn,
  LayoutDashboard,
  Megaphone,
  Settings,
  ShieldCheck,
  UserPlus,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {
  platformRoutes,
  primaryNavigationGroups,
} from "../data/navigation";
import { isPlatformRouteCurrent } from "../data/platform-shell";
import { navGroupKeys, routeLabelKeys } from "../i18n/config";
import { useT } from "../i18n/LanguageProvider";

type PlatformNavigationRailProps = {
  pathname: string;
  authenticated: boolean;
  isAdmin: boolean;
  accountRole?: "student" | "mentor" | "teacher" | "admin" | "assistant_admin" | "owner_admin";
  mobileOpen: boolean;
  onMobileClose: () => void;
};

const routeIcons: Record<string, LucideIcon> = {
  "/schedule": CalendarRange,
  "/questions": MessageCircleQuestion,
  "/events": CalendarDays,
  "/community": UsersRound,
  "/teachers": GraduationCap,
  "/mentors": HeartHandshake,
  "/support": CircleHelp,
  "/feed": Megaphone,
  "/clubs": Compass,
};

export function PlatformNavigationRail(props: PlatformNavigationRailProps) {
  const reducedMotion = useReducedMotion();
  const t = useT();
  const navigation = (
    <>
      <NavigationLink href="/" label={t("nav.home")} pathname={props.pathname} icon={Home} reducedMotion={Boolean(reducedMotion)} />
      {primaryNavigationGroups.map((group) => (
        <div className="platform-nav-group" key={group.label}>
          <span className="platform-nav-group-label">{t(navGroupKeys[group.label] ?? group.label)}</span>
          {group.routes.map((href) => {
            const route = platformRoutes.find((item) => item.href === href);
            if (!route) return null;
            return <NavigationLink key={href} href={href} label={t(routeLabelKeys[href] ?? route.label)} pathname={props.pathname} icon={routeIcons[href]} reducedMotion={Boolean(reducedMotion)} />;
          })}
        </div>
      ))}
      {props.isAdmin && (
        <div className="platform-nav-group">
          <span className="platform-nav-group-label">{t("nav.group.account")}</span>
          <NavigationLink href="/admin" label={t("nav.admin")} pathname={props.pathname} icon={ShieldCheck} reducedMotion={Boolean(reducedMotion)} />
        </div>
      )}
      {props.authenticated ? (
        <div className="platform-nav-group">
          <span className="platform-nav-group-label">{t("nav.group.account")}</span>
          <NavigationLink href="/profile" label={t("nav.profile")} pathname={props.pathname} icon={UserRound} reducedMotion={Boolean(reducedMotion)} />
          {!props.isAdmin && <NavigationLink href="/workspace" label={t(props.accountRole === "teacher" ? "nav.workspace.teacher" : props.accountRole === "mentor" ? "nav.workspace.mentor" : "nav.workspace.student")} pathname={props.pathname} icon={LayoutDashboard} reducedMotion={Boolean(reducedMotion)} />}
          <NavigationLink href="/settings" label={t("nav.settings")} pathname={props.pathname} icon={Settings} reducedMotion={Boolean(reducedMotion)} />
        </div>
      ) : (
        <div className="platform-nav-group">
          <span className="platform-nav-group-label">{t("nav.group.account")}</span>
          <NavigationLink href="/auth" label={t("nav.signIn")} pathname={props.pathname} icon={LogIn} reducedMotion={Boolean(reducedMotion)} />
          <NavigationLink href="/auth?mode=register" label={t("nav.signUp")} pathname={props.pathname} icon={UserPlus} reducedMotion={Boolean(reducedMotion)} />
        </div>
      )}
    </>
  );

  return (
    <>
      <aside className="platform-left-rail" aria-label="Əsas naviqasiya">
        <Brand pathname={props.pathname} />
        <nav className="platform-rail-navigation" aria-label="Platforma bölmələri">{navigation}</nav>
      </aside>

      <AnimatePresence>
        {props.mobileOpen && (
          <motion.div className="platform-mobile-navigation-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" className="platform-mobile-navigation-backdrop" onClick={props.onMobileClose} aria-label="Naviqasiyanı bağla" />
            <motion.aside
              id="platform-mobile-navigation"
              className="platform-mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-label="Əsas naviqasiya"
              initial={reducedMotion ? false : { x: "-100%" }}
              animate={{ x: 0 }}
              exit={reducedMotion ? { opacity: 0 } : { x: "-100%" }}
              transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 360, damping: 36 }}
            >
              <header><Brand pathname={props.pathname} onClick={props.onMobileClose} /><button type="button" onClick={props.onMobileClose} aria-label="Naviqasiyanı bağla"><X size={19} /></button></header>
              <nav aria-label="Platforma bölmələri" onClick={props.onMobileClose}>{navigation}</nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Brand({ pathname, onClick }: { pathname: string; onClick?: () => void }) {
  return <Link href="/" className="platform-sidebar-brand" onClick={onClick} aria-label="EduRate ana səhifəsi" aria-current={pathname === "/" ? "page" : undefined}><span className="brand-mark" aria-hidden="true"><span /></span><strong>EDURATE</strong></Link>;
}

function NavigationLink({ href, label, pathname, icon: Icon, reducedMotion }: { href: string; label: string; pathname: string; icon?: LucideIcon; reducedMotion: boolean }) {
  const current = isPlatformRouteCurrent(pathname, href);
  const LinkIcon = Icon ?? Compass;
  return (
    <Link href={href} className={`platform-rail-link${current ? " is-active" : ""}`} aria-current={current ? "page" : undefined}>
      {current && <motion.span className="platform-rail-active" layoutId="platform-left-rail-active" transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true" />}
      <LinkIcon size={18} aria-hidden="true" /><span>{label}</span>
    </Link>
  );
}
