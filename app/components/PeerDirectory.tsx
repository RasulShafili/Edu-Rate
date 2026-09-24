"use client";
/* eslint-disable react-hooks/set-state-in-effect -- the authenticated directory refresh is effect-driven */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Ban, Check, Flag, MapPin, MessageCircle, RefreshCw, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { Peer } from "../data/peers";
import { useT } from "../i18n/LanguageProvider";
import { ReportDialog, type ReportTarget } from "./ReportDialog";

type Props = { canInteract: boolean; currentUserId?: string; onMessage: (peer: Peer) => void; onRequireAuth: () => void };
type ApiUser = { id: string; name: string; role: string; faculty: string; program: string; city: string; avatarUrl?:string };
type Connection = { id: string; requesterId: string; recipientId: string; status: "pending" | "accepted" | "blocked" };

const colors = [
  ["#b9a7ff", "rgba(185,167,255,.34)"],
  ["#c8ff4d", "rgba(200,255,77,.3)"],
  ["#77b8ff", "rgba(119,184,255,.32)"],
  ["#7de5d1", "rgba(125,229,209,.3)"],
];

function PeerSkeleton() {
  return <div className="peer-skeleton" aria-hidden="true"><div className="skeleton-topline" /><div className="skeleton-avatar" /><div className="skeleton-line skeleton-line-wide" /><div className="skeleton-line skeleton-line-short" /><div className="skeleton-copy" /><div className="skeleton-tags"><span /><span /></div></div>;
}

function toPeer(user: ApiUser, index: number): Peer {
  const [accent, glow] = colors[index % colors.length];
  return {
    id: user.id,
    name: user.name,
    initials: user.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join(""),
    role: roleLabelKey(user.role),
    focus: user.program,
    bio: user.faculty,
    city: user.city,
    // Serverdə iştirak məlumatı yoxdur; `Peer` tipi sahəni tələb etdiyi üçün
    // saxlanılır, amma interfeysdə GÖSTƏRİLMİR — əks halda uydurma olardı.
    status: "online",
    accent,
    glow,
    mutuals: 0,
    tags: [],
    openingMessage: "",
    reply: "",
    avatarUrl:user.avatarUrl,
  };
}

export function PeerDirectory({ canInteract, currentUserId, onMessage, onRequireAuth }: Props) {
  // Əvvəl profildən yalnız söhbətin içindən şikayət etmək olurdu — yəni əvvəlcə əlaqə qurmaq lazım idi.
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const t = useT();
  const [loading, setLoading] = useState(true);
  const [directory, setDirectory] = useState<Peer[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [actionPeerId, setActionPeerId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!canInteract) {
        setDirectory([]);
        setConnections([]);
        return;
      }
      const [usersResponse, connectionsResponse] = await Promise.all([
        fetch("/api/community/users", { cache: "no-store" }),
        fetch("/api/community/connections", { cache: "no-store" }),
      ]);
      const users = await usersResponse.json() as { data?: ApiUser[]; error?: { message?: string } };
      const links = await connectionsResponse.json() as { data?: Connection[]; error?: { message?: string } };
      if (!usersResponse.ok || !connectionsResponse.ok) {
        throw new Error(users.error?.message || links.error?.message || t("peers.loadFailed"));
      }
      setDirectory((users.data ?? []).map(toPeer));
      setConnections(links.data ?? []);
    } catch (value) {
      setError(value instanceof Error ? value.message : t("peers.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [canInteract]);

  useEffect(() => { void load(); }, [load]);


  async function updateConnection(peerId: string) {
    if (!canInteract) { onRequireAuth(); return; }
    const current = connections.find((item) => item.requesterId === peerId || item.recipientId === peerId);
    if (current?.status === "accepted") return;
    const blockedByMe = current?.status === "blocked" && current.requesterId === currentUserId;
    if (current?.status === "blocked" && !blockedByMe) return;
    const outgoing = current?.status === "pending" && current.requesterId === currentUserId;
    const method = blockedByMe || outgoing ? "DELETE" : current ? "PATCH" : "POST";
    const path = blockedByMe ? `/api/community/blocks/${peerId}` : current ? `/api/community/connections/${current.id}` : "/api/community/connections";
    const hasBody = method === "POST" || method === "PATCH";
    setActionPeerId(peerId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(path, {
        method,
        headers: hasBody ? { "content-type": "application/json" } : undefined,
        body: method === "POST" ? JSON.stringify({ userId: peerId }) : method === "PATCH" ? JSON.stringify({}) : undefined,
      });
      if (!response.ok) {
        const failed = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(failed?.error?.message ?? t("peers.connectionFailed"));
      }
      if (method === "DELETE") {
        setConnections((items) => items.filter((item) => item.id !== current?.id));
        setNotice(t(blockedByMe ? "peers.unblocked" : "peers.requestWithdrawn"));
        window.dispatchEvent(new CustomEvent("edurate:connections-changed"));
        return;
      }
      const payload = await response.json() as { data: Connection };
      setConnections((items) => [...items.filter((item) => item.id !== payload.data.id), payload.data]);
      window.dispatchEvent(new CustomEvent("edurate:connections-changed"));
    } catch (value) {
      setError(value instanceof Error ? value.message : t("peers.connectionFailed"));
    } finally {
      setActionPeerId(null);
    }
  }

  return (
    <section id="peers" className="peers-section route-module-section" aria-labelledby="peers-title">
      <motion.div className="peers-heading" initial={reduceMotion ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}>
        <div><span className="section-kicker section-kicker-dark">{t("peers.eyebrow")}</span><h1 id="peers-title" className="module-page-title">{t("peers.title")}</h1></div>
        <div className="peers-heading-aside"><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14} className={loading ? "is-spinning" : ""} /> {t("peers.refresh")}</button></div>
      </motion.div>

      <div className="directory-meta"><span><i />{t("peers.activeUsers", { count: directory.length })}</span></div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p className="form-success" role="status">{notice}</p> : null}
      {!canInteract && !loading ? <div className="empty-state"><h2>{t("peers.joinTitle")}</h2><p>{t("peers.joinBody")}</p><button type="button" className="kuds-primary-button" onClick={onRequireAuth}>{t("peers.signIn")}</button></div> : null}
      <div className="peers-grid" aria-busy={loading}>
        <AnimatePresence mode="popLayout">
          {loading ? Array.from({ length: 4 }, (_, index) => <PeerSkeleton key={index} />) : directory.map((peer, index) => {
            const connection = connections.find((item) => item.requesterId === peer.id || item.recipientId === peer.id);
            const accepted = connection?.status === "accepted";
            const blocked = connection?.status === "blocked";
            const blockedByMe = blocked && connection?.requesterId === currentUserId;
            const incoming = connection?.status === "pending" && connection.recipientId === currentUserId;
            const outgoing = connection?.status === "pending" && connection.requesterId === currentUserId;
            const actionPending = actionPeerId === peer.id;
            return (
              <motion.article layout key={peer.id} className="peer-card" style={{ "--peer-accent": peer.accent, "--peer-glow": peer.glow } as CSSProperties} initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.42, delay: index * 0.03 }}>
                <div className={`peer-avatar${peer.avatarUrl?" has-image":""}`} style={peer.avatarUrl?{"--avatar-image":`url("${peer.avatarUrl}")`} as CSSProperties:undefined} aria-hidden="true"><span>{peer.avatarUrl?null:peer.initials}</span><i className="peer-avatar-orbit" /></div>
                <div className="peer-identity"><h3>{peer.name}</h3><p>{t(peer.role)} · {peer.focus}</p></div>
                <p className="peer-bio">{peer.bio}</p>
                <div className="peer-location"><MapPin size={12} />{peer.city}</div>
                <div className="peer-actions">
                  <button type="button" className={accepted || outgoing ? "is-connected" : blockedByMe ? "is-unblock" : ""} disabled={accepted || (blocked && !blockedByMe) || actionPending} aria-busy={actionPending} title={outgoing ? t("peers.withdraw") : blockedByMe ? t("peers.unblockTitle") : undefined} onClick={() => void updateConnection(peer.id)}>
                    {blockedByMe ? <Ban size={14} /> : accepted ? <Check size={14} /> : <UserPlus size={14} />}{t(actionPending ? blockedByMe ? "peers.unblocking" : outgoing ? "peers.withdrawing" : "peers.sending" : accepted ? "peers.connected" : blockedByMe ? "peers.unblock" : blocked ? "peers.blockedYou" : incoming ? "peers.accept" : outgoing ? "peers.withdraw" : "peers.connect")}
                  </button>
                  <button type="button" className="peer-message" disabled={!accepted} title={!accepted ? t("peers.needAccepted") : undefined} onClick={() => onMessage(peer)}><MessageCircle size={14} />{t("peers.message")}</button>
                </div>
                {canInteract ? <button type="button" className="peer-report" onClick={() => setReportTarget({ entityType: "profile", entityId: peer.id, label: peer.name })}><Flag size={12} aria-hidden="true" />{t("chat.report")}</button> : null}
              </motion.article>
            );
          })}
        </AnimatePresence>
      </div>
      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </section>
  );
}

/** Rol adı tərcümə açarı kimi saxlanılır; göstərilən yerdə `t()` ilə açılır. */
export function roleLabelKey(role: string) {
  return ["student", "teacher", "mentor", "assistant_admin", "admin", "owner_admin"].includes(role)
    ? `role.${role}`
    : role;
}
