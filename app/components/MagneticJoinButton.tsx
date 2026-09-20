"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, MessageCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { useT } from "../i18n/LanguageProvider";
import { usePlatform, type ClubChatTarget } from "./PlatformProvider";

type MagneticJoinButtonProps = {
  clubId: string;
  clubName: string;
  onJoin?: () => void;
};

export function MagneticJoinButton({ clubId, clubName, onJoin }: MagneticJoinButtonProps) {
  const { user } = useAuth();
  const t = useT();
  const { openClubConversation } = usePlatform();
  const [joined, setJoined] = useState(false);
  const [loadedMembershipKey, setLoadedMembershipKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [clubGroup, setClubGroup] = useState<ClubChatTarget | null>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const isJoined = Boolean(user && joined);
  const membershipKey = user ? `${user.id}:${clubId}` : null;
  const membershipLoading = Boolean(membershipKey && loadedMembershipKey !== membershipKey);

  useEffect(() => {
    if (!user || !membershipKey) return;
    let cancelled = false;
    const controller = new AbortController();
    void fetch("/api/clubs/memberships", { cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error(t("club.membershipFailed"))))
      .then((payload: { data?: Array<{ slug?: string }> } | null) => {
        if (!cancelled && payload?.data) setJoined(payload.data.some((club) => club.slug === clubId));
      })
      .catch((cause) => { if (!cancelled && cause instanceof Error && cause.name !== "AbortError") setError(cause.message); })
      .finally(() => { if (!cancelled) setLoadedMembershipKey(membershipKey); });
    return () => { cancelled = true; controller.abort(); };
  }, [clubId, membershipKey, user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void fetch("/api/community/groups", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error("Qrup söhbəti açılmadı.")))
      .then((payload: { data?: Array<{ id: string; club: { id: string; slug: string; name: string }; memberCount: number; isAdmin: boolean }> }) => {
        const group = payload.data?.find((item) => item.club.slug === clubId);
        if (cancelled) return;
        setClubGroup(group ? { conversationId: group.id, clubId: group.club.id, name: group.club.name, initials: group.club.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join(""), memberCount: group.memberCount, isAdmin: group.isAdmin } : null);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [clubId, isJoined, user]);

  // Maqnit hərəkət ləğv edilib: düymə kursorun ardınca sürüşmür.
  async function handleJoin() {
    setError("");
    if (!user) {
      window.location.assign(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (membershipLoading) return;
    setPending(true);
    try {
      const response = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/memberships`, { method: isJoined ? "DELETE" : "POST" });
      const payload = await response.json() as { data?: { joined?: boolean }; error?: { code?: string; message?: string } };
      if (!response.ok) {
        if (payload.error?.code === "ALREADY_MEMBER") { setJoined(true); return; }
        throw new Error(payload.error?.message ?? t("club.joinFailed"));
      }
      setJoined(payload.data?.joined ?? !isJoined);
      if (!isJoined) onJoin?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("club.joinFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="club-join-action">
      <motion.button
      type="button"
      className={`magnetic-join-button${isJoined ? " is-joined" : ""}`}
      aria-label={t(isJoined ? "club.joinedAria" : "club.joinAria", { name: clubName })}
      aria-pressed={isJoined}
      aria-busy={pending}
      aria-describedby={error ? "club-join-error" : undefined}
      disabled={pending || membershipLoading}
      onClick={() => void handleJoin()}
      whileTap={reduceMotion || isJoined ? undefined : { scale: 0.97 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <span className="magnetic-join-button__glow" aria-hidden="true" />
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={isJoined ? "joined" : "join"}
          className="magnetic-join-button__content"
          initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.9 }}
          animate={
            reduceMotion
              ? { opacity: 1 }
              : { opacity: 1, y: 0, scale: 1 }
          }
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.9 }}
          transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
          aria-live="polite"
        >
          {isJoined ? <Check size={17} strokeWidth={2.4} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
          {membershipLoading ? t("club.joinChecking") : pending ? t("club.joinWait") : t(isJoined ? "club.joined" : "club.join")}
        </motion.span>
      </AnimatePresence>

      <AnimatePresence>
        {null}
      </AnimatePresence>
      </motion.button>
      {isJoined ? <small className="club-join-action__status" role="status">{t("club.joinedStatus")}</small> : null}
      {clubGroup ? <button type="button" className="club-group-shortcut" onClick={() => openClubConversation(clubGroup)}><MessageCircle size={15} /> {t("club.groupChat")}</button> : null}
      <AnimatePresence>
        {error && (
          <motion.small
            id="club-join-error"
            className="club-join-action__error"
            role="alert"
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
          >
            {error}
          </motion.small>
        )}
      </AnimatePresence>
    </div>
  );
}
