"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/refs -- remote chat hydration and external target synchronization are intentionally effect-driven; refs are read only inside event handlers */

import { AnimatePresence, motion, useDragControls, useReducedMotion } from "framer-motion";
import { ArrowLeft, Ban, BellOff, Check, CheckCheck, ChevronDown, Crown, Flag, MessageCircle, MessagesSquare, MoreVertical, Pencil, Plus, Reply, Send, SmilePlus, Trash2, UsersRound, Volume2, X } from "lucide-react";
import { useT } from "../i18n/LanguageProvider";
import { roleLabelKey } from "./PeerDirectory";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { io, type Socket } from "socket.io-client";
import type { Peer } from "../data/peers";
import { useAuth } from "./AuthProvider";
import type { ClubChatTarget } from "./PlatformProvider";
import { ReportDialog, type ReportTarget } from "./ReportDialog";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;
type ReactionEmoji = (typeof REACTIONS)[number];
type ApiReaction = { emoji: ReactionEmoji; count: number; mine?: boolean };
type ReplyPreview = { id: string; senderName: string; body: string; deleted: boolean };
type ApiMessage = { id: string; conversationId: string; senderId: string; senderName?: string; senderInitials?: string; senderAvatarUrl?: string; body: string; createdAt: string; deleted?: boolean; editedAt?: string; replyTo?: ReplyPreview; reactions?: ApiReaction[]; status?: "sent" | "read" };
type ApiConversation = { id: string; peer: { id: string; name: string; role: string; faculty: string; program: string; city: string; avatarUrl?: string }; lastMessage: string; updatedAt: string; unreadCount: number; muted: boolean };
type ApiGroup = { id: string; kind: "club"; club: { id: string; slug: string; name: string }; memberCount: number; isAdmin: boolean; lastMessage: string; updatedAt: string; unreadCount: number; muted: boolean };
type ApiContact = ApiConversation["peer"];
type ApiConnection = { id: string; requesterId: string; recipientId: string; status: "pending" | "accepted" | "blocked" };
type ActiveChat = { kind: "direct"; conversationId?: string; peer: Peer; muted: boolean } | { kind: "group"; conversationId: string; peer: Peer; group: ClubChatTarget; muted: boolean };
type Props = { peer?: Peer | null; group?: ClubChatTarget | null; open: boolean; onOpenChange: (open: boolean) => void };

export function ChatDock({ peer, group, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [groups, setGroups] = useState<ApiGroup[]>([]);
  const [tab, setTab] = useState<"direct" | "group">("direct");
  const [active, setActive] = useState<ActiveChat | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const t = useT();
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [contacts, setContacts] = useState<ApiContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [canDrag, setCanDrag] = useState(false);
  const [replyTo, setReplyTo] = useState<ApiMessage | null>(null);
  const [editing, setEditing] = useState<ApiMessage | null>(null);
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  // Toxunma ekranında əməliyyat düymələri hər mesajda həmişə açıq idi (hover yoxdur):
  // ekran dolurdu, qarşı tərəfin düymələri kənardan çıxırdı. İndi mesaja toxunanda açılır.
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const typingTimer = useRef<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();

  const refreshDirectory = useCallback(async () => {
    if (!user) return;
    const [directResponse, groupResponse] = await Promise.all([
      fetch("/api/community/conversations", { cache: "no-store" }),
      fetch("/api/community/groups", { cache: "no-store" }),
    ]);
    const directPayload = await directResponse.json() as { data?: ApiConversation[] };
    const groupPayload = await groupResponse.json() as { data?: ApiGroup[] };
    if (directResponse.ok) setConversations(directPayload.data ?? []);
    if (groupResponse.ok) setGroups(groupPayload.data ?? []);
  }, [user]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const update = () => setCanDrag(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => { void refreshDirectory(); }, [refreshDirectory]);
  useEffect(() => { if (open) void refreshDirectory(); }, [open, refreshDirectory]);

  useEffect(() => {
    if (!peer) return;
    if (group) {
      setTab("group");
      setActive({ kind: "group", conversationId: group.conversationId, peer, group, muted: false });
    } else {
      setTab("direct");
      setActive({ kind: "direct", peer, muted: false });
    }
  }, [group, peer]);

  useEffect(() => {
    setMenuOpen(false);
    setReplyTo(null);
    setEditing(null);
    setActionsFor(null);
    if (active || !open) setFeedback("");
  }, [active?.conversationId, open]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menuOpen]);

  useEffect(() => {
    if (!open || !active || !user) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setMessages([]);
    void (async () => {
      try {
        let id = active.conversationId ?? "";
        if (!id && active.kind === "direct") {
          const response = await fetch("/api/community/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ peerId: active.peer.id }) });
          const payload = await response.json() as { data?: { id: string }; error?: { message?: string } };
          if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? t("chat.loadFailed"));
          id = payload.data.id;
          if (!cancelled) setActive((current) => current?.kind === "direct" ? { ...current, conversationId: id } : current);
        }
        const [messageResponse, ticketResponse] = await Promise.all([
          fetch(`/api/community/conversations/${id}/messages`, { cache: "no-store" }),
          fetch("/api/realtime/ticket", { method: "POST" }),
        ]);
        const messagePayload = await messageResponse.json() as { data?: ApiMessage[]; error?: { message?: string } };
        const ticketPayload = await ticketResponse.json() as { data?: { ticket: string; socketUrl: string } };
        if (!messageResponse.ok) throw new Error(messagePayload.error?.message ?? t("chat.messagesFailed"));
        if (cancelled) return;
        setMessages(messagePayload.data ?? []);
        void fetch(`/api/community/conversations/${id}/read`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
        if (ticketResponse.ok && ticketPayload.data) {
          const socket = io(ticketPayload.data.socketUrl, { path: "/socket.io", auth: { ticket: ticketPayload.data.ticket }, transports: ["websocket", "polling"] });
          socketRef.current = socket;
          socket.emit("conversation:join", id);
          socket.on("message:new", (message: ApiMessage) => {
            if (message.conversationId !== id) return;
            setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
            if (message.senderId !== user.id) void fetch(`/api/community/conversations/${id}/read`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
          });
          socket.on("message:deleted", (payload: { conversationId: string; messageId: string }) => payload.conversationId === id && setMessages((current) => current.map((item) => item.id === payload.messageId ? { ...item, body: "Mesaj silindi", deleted: true, reactions: undefined } : item)));
          socket.on("message:edited", (payload: { conversationId: string; messageId: string; body: string; editedAt: string }) => payload.conversationId === id && setMessages((current) => current.map((item) => item.id === payload.messageId ? { ...item, body: payload.body, editedAt: payload.editedAt } : item)));
          socket.on("message:reaction", (payload: { conversationId: string; messageId: string; reactions: ApiReaction[] }) => payload.conversationId === id && setMessages((current) => current.map((item) => item.id === payload.messageId ? { ...item, reactions: mergeReactions(item.reactions, payload.reactions) } : item)));
          socket.on("message:read", (payload: { conversationId: string; userId: string }) => { if (payload.conversationId === id && payload.userId !== user.id) setMessages((current) => current.map((item) => item.senderId === user.id && item.status ? { ...item, status: "read" } : item)); });
          socket.on("typing", (payload: { conversationId: string; userId: string; active: boolean }) => payload.conversationId === id && payload.userId !== user.id && setTyping(payload.active));
        }
      } catch (value) {
        if (!cancelled) setError(value instanceof Error ? value.message : t("chat.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      socketRef.current = null;
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, [active?.conversationId, active?.kind, active?.peer.id, open, user]);

  const scrollToEnd = useCallback((behavior: ScrollBehavior) => {
    requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior }));
  }, []);

  useEffect(() => {
    if (!open) return;
    if (atBottom) scrollToEnd(reduceMotion ? "auto" : "smooth");
  }, [messages, typing, open, reduceMotion, atBottom, scrollToEnd]);

  function onListScroll() {
    const node = listRef.current;
    if (!node) return;
    setAtBottom(node.scrollHeight - node.scrollTop - node.clientHeight < 90);
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    const id = active?.conversationId;
    if (!body || !id) return;
    if (editing) { await saveEdit(body); return; }
    setDraft("");
    const pendingReply = replyTo;
    setReplyTo(null);
    socketRef.current?.emit("typing", { conversationId: id, active: false });
    const response = await fetch(`/api/community/conversations/${id}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body, ...(pendingReply ? { replyToId: pendingReply.id } : {}) }) });
    const payload = await response.json() as { data?: ApiMessage; error?: { message?: string } };
    if (!response.ok || !payload.data) { setDraft(body); setReplyTo(pendingReply); setError(payload.error?.message ?? t("chat.sendFailed")); return; }
    setMessages((current) => current.some((item) => item.id === payload.data!.id) ? current : [...current, payload.data!]);
    setAtBottom(true);
    void refreshDirectory();
  }

  async function saveEdit(body: string) {
    const id = active?.conversationId;
    const target = editing;
    if (!id || !target) return;
    setDraft("");
    setEditing(null);
    const response = await fetch(`/api/community/conversations/${id}/messages/${target.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ body }) });
    const payload = await response.json() as { data?: ApiMessage; error?: { message?: string } };
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? t("chat.editFailed")); return; }
    setMessages((current) => current.map((item) => item.id === target.id ? { ...item, body: payload.data!.body, editedAt: payload.data!.editedAt } : item));
  }

  async function removeMessage(messageId: string) {
    const id = active?.conversationId;
    if (!id) return;
    setActionsFor(null);
    const response = await fetch(`/api/community/conversations/${id}/messages/${messageId}`, { method: "DELETE" });
    if (!response.ok) { setError(t("chat.deleteFailed")); return; }
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, body: "Mesaj silindi", deleted: true, reactions: undefined } : message));
    void refreshDirectory();
  }

  async function toggleReaction(messageId: string, emoji: ReactionEmoji) {
    const id = active?.conversationId;
    if (!id) return;
    setActionsFor(null);
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, reactions: applyOwnReaction(item.reactions, emoji) } : item));
    const response = await fetch(`/api/community/conversations/${id}/messages/${messageId}/reactions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ emoji }) });
    const payload = await response.json() as { data?: { reactions: ApiReaction[] }; error?: { message?: string } };
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? t("chat.reactionFailed")); void refreshActiveMessages(); return; }
    setMessages((current) => current.map((item) => item.id === messageId ? { ...item, reactions: payload.data!.reactions.length ? payload.data!.reactions : undefined } : item));
  }

  async function refreshActiveMessages() {
    const id = active?.conversationId;
    if (!id) return;
    const response = await fetch(`/api/community/conversations/${id}/messages`, { cache: "no-store" });
    const payload = await response.json() as { data?: ApiMessage[] };
    if (response.ok) setMessages(payload.data ?? []);
  }

  function startReply(message: ApiMessage) {
    setEditing(null);
    setReplyTo(message);
    setActionsFor(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function startEdit(message: ApiMessage) {
    setReplyTo(null);
    setEditing(message);
    setDraft(message.body);
    setActionsFor(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function cancelComposerContext() {
    setReplyTo(null);
    if (editing) { setEditing(null); setDraft(""); }
  }

  // Əvvəl səbəb həmişə "abuse" göndərilirdi və istifadəçi heç nə yaza bilmirdi.
  function report(entityType: ReportTarget["entityType"], entityId: string, label: string) { setMenuOpen(false); setActionsFor(null); setReportTarget({ entityType, entityId, label }); }
  async function mute() { if (!active?.conversationId) return; setMenuOpen(false); setError(""); const muted = !active.muted; const response = await fetch(`/api/community/conversations/${active.conversationId}/mute`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ muted }) }); if (!response.ok) { setError(t("chat.muteFailed")); return; } setActive((current) => current ? { ...current, muted } : current); setConversations((items) => items.map((item) => item.id === active.conversationId ? { ...item, muted } : item)); setGroups((items) => items.map((item) => item.id === active.conversationId ? { ...item, muted } : item)); setFeedback(t(muted ? "chat.muted" : "chat.unmuted")); }
  async function block() { if (!active || active.kind !== "direct") return; setMenuOpen(false); setError(""); const blockedConversationId = active.conversationId; const response = await fetch("/api/community/blocks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: active.peer.id }) }); if (!response.ok) { setError(t("chat.blockFailed")); return; } if (blockedConversationId) setConversations((items) => items.filter((item) => item.id !== blockedConversationId)); setActive(null); setMessages([]); setFeedback(t("chat.blocked")); void refreshDirectory(); }

  async function openContacts() {
    setContactsOpen(true); setContactsLoading(true); setError("");
    try {
      const [usersResponse, connectionsResponse] = await Promise.all([fetch("/api/community/users", { cache: "no-store" }), fetch("/api/community/connections", { cache: "no-store" })]);
      const usersPayload = await usersResponse.json() as { data?: ApiContact[]; error?: { message?: string } };
      const connectionsPayload = await connectionsResponse.json() as { data?: ApiConnection[]; error?: { message?: string } };
      if (!usersResponse.ok || !connectionsResponse.ok) throw new Error(usersPayload.error?.message ?? connectionsPayload.error?.message ?? t("chat.contactsFailed"));
      const accepted = new Set((connectionsPayload.data ?? []).filter((item) => item.status === "accepted").map((item) => item.requesterId === user?.id ? item.recipientId : item.requesterId));
      setContacts((usersPayload.data ?? []).filter((item) => accepted.has(item.id)));
    } catch (value) { setError(value instanceof Error ? value.message : t("chat.contactsFailed")); setContacts([]); } finally { setContactsLoading(false); }
  }

  async function startContactChat(contact: ApiContact) {
    setError("");
    const response = await fetch("/api/community/conversations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ peerId: contact.id }) });
    const payload = await response.json() as { data?: { id: string }; error?: { message?: string } };
    if (!response.ok || !payload.data) { setError(payload.error?.message ?? t("chat.openFailed")); return; }
    setContactsOpen(false); setTab("direct"); setActive({ kind: "direct", conversationId: payload.data.id, peer: apiPeer(contact), muted: false });
  }

  function changeDraft(value: string) {
    setDraft(value);
    if (!active?.conversationId || editing) return;
    socketRef.current?.emit("typing", { conversationId: active.conversationId, active: Boolean(value.trim()) });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => socketRef.current?.emit("typing", { conversationId: active.conversationId, active: false }), 1200);
  }

  function keyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
    if (event.key === "Escape" && (replyTo || editing)) { event.preventDefault(); cancelComposerContext(); }
  }

  function insertEmoji(emoji: string) {
    setDraft((current) => `${current}${emoji}`);
    setEmojiOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function scrollToMessage(messageId: string) {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-message="${CSS.escape(messageId)}"]`) ?? null;
    if (!node) return;
    node.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    node.classList.add("message-flash");
    window.setTimeout(() => node.classList.remove("message-flash"), 1200);
  }

  const unreadCount = conversations.reduce((sum, item) => sum + item.unreadCount, 0) + groups.reduce((sum, item) => sum + item.unreadCount, 0);
  const accent = active?.peer.accent ?? "#8fc15f";
  const glow = active?.peer.glow ?? "rgba(143,193,95,.28)";
  const rendered = useMemo(() => buildTimeline(messages, (date) => dayLabel(date, t)), [messages, t]);

  return (
    <div className="chat-dock" style={{ "--peer-accent": accent, "--peer-glow": glow } as CSSProperties}>
      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
      <AnimatePresence>{!open ? <motion.button id="chat-launcher" type="button" className="chat-launcher" aria-label={t("chat.open")} onClick={() => onOpenChange(true)} initial={reduceMotion ? false : { opacity: 0, scale: .85, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .85 }}><span className="launcher-pulse" /><MessageCircle size={21} />{unreadCount ? <i>{Math.min(unreadCount, 9)}</i> : null}</motion.button> : null}</AnimatePresence>
      <AnimatePresence>{open ? (
        <motion.section className="chat-panel chat-center" data-view={active ? "thread" : "list"} role="dialog" aria-label={t("chat.center")} drag={canDrag} dragControls={dragControls} dragListener={false} dragMomentum={false} initial={reduceMotion ? false : { opacity: 0, y: 24, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 18, scale: .96 }}>
          <aside className="chat-center-sidebar">
            <header onPointerDown={(event) => canDrag && dragControls.start(event)}><span><MessagesSquare size={18} /></span><div><strong>{t("chat.title")}</strong><small>{t("chat.conversationCount", { count: conversations.length + groups.length })}</small></div><button type="button" className="chat-new-trigger" aria-label={t("chat.newChat")} aria-expanded={contactsOpen} onPointerDown={(event) => event.stopPropagation()} onClick={() => contactsOpen ? setContactsOpen(false) : void openContacts()}><Plus size={18} /></button><button type="button" className="chat-sidebar-close" aria-label={t("chat.close")} onPointerDown={(event) => event.stopPropagation()} onClick={() => onOpenChange(false)}><X size={18} /></button></header>
            <AnimatePresence>{contactsOpen ? <motion.div className="chat-contact-picker" initial={reduceMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}><header><div><strong>{t("chat.newChatTitle")}</strong><small>{t("chat.newChatBody")}</small></div><button type="button" onClick={() => setContactsOpen(false)} aria-label={t("chat.closeContacts")}><X size={16} /></button></header><div>{contactsLoading ? <p>{t("chat.contactsLoading")}</p> : contacts.length ? contacts.map((contact) => <button type="button" key={contact.id} onClick={() => void startContactChat(contact)}><span className={`chat-list-avatar${contact.avatarUrl ? " has-image" : ""}`} style={avatarStyle(contact.avatarUrl)}>{contact.avatarUrl ? null : initials(contact.name)}</span><span><strong>{contact.name}</strong><small>{contact.program || contact.role}</small></span><MessageCircle size={15} /></button>) : <p>{t("chat.noContacts")}</p>}</div></motion.div> : null}</AnimatePresence>
            <div className="chat-center-tabs"><button type="button" className={tab === "direct" ? "active" : ""} onClick={() => setTab("direct")}>{t("chat.conversations")}</button><button type="button" className={tab === "group" ? "active" : ""} onClick={() => setTab("group")}>{t("chat.groups")}</button></div>
            <div className="chat-center-list">
              {tab === "direct" ? conversations.map((conversation) => <button type="button" key={conversation.id} className={active?.conversationId === conversation.id ? "active" : ""} onClick={() => setActive({ kind: "direct", conversationId: conversation.id, peer: apiPeer(conversation.peer), muted: conversation.muted })}><span className={`chat-list-avatar${conversation.peer.avatarUrl ? " has-image" : ""}`} style={avatarStyle(conversation.peer.avatarUrl)}>{conversation.peer.avatarUrl ? null : initials(conversation.peer.name)}</span><span><strong>{conversation.peer.name}</strong><small>{conversation.lastMessage || conversation.peer.program}</small></span>{conversation.muted ? <BellOff className="chat-list-muted" size={13} /> : conversation.unreadCount ? <b>{conversation.unreadCount}</b> : null}</button>) : groups.map((item) => <button type="button" key={item.id} className={active?.conversationId === item.id ? "active" : ""} onClick={() => setActive({ kind: "group", conversationId: item.id, peer: groupPeer(item, t), group: groupTarget(item), muted: item.muted })}><span className="chat-list-avatar is-group"><UsersRound size={16} /></span><span><strong>{item.club.name}</strong><small>{item.lastMessage || t("chat.members", { count: item.memberCount })}</small></span>{item.muted ? <BellOff className="chat-list-muted" size={13} /> : item.isAdmin ? <Crown size={14} /> : item.unreadCount ? <b>{item.unreadCount}</b> : null}</button>)}
              {tab === "direct" && !conversations.length ? <p>{t("chat.noConversations")}</p> : null}
              {tab === "group" && !groups.length ? <p>{t("chat.noGroups")}</p> : null}
            </div>
          </aside>
          <main className="chat-center-main">
            <button type="button" className="chat-center-close" onClick={() => onOpenChange(false)} aria-label={t("chat.close")}><X size={19} /></button>
            {active ? <>
              <header className="chat-header" onPointerDown={(event) => canDrag && dragControls.start(event)}><button type="button" className="chat-back" aria-label={t("chat.back")} onPointerDown={(event) => event.stopPropagation()} onClick={() => setActive(null)}><ArrowLeft size={20} /></button><div className="chat-person"><span className={`chat-person-avatar${active.kind === "direct" && active.peer.avatarUrl ? " has-image" : ""}`} style={active.kind === "direct" ? avatarStyle(active.peer.avatarUrl) : undefined}>{active.kind === "group" ? <UsersRound size={17} /> : active.peer.avatarUrl ? null : active.peer.initials}</span><div><h2>{active.peer.name}</h2><p>{typing ? <span className="chat-status-typing">{t("chat.typing")}</span> : active.kind === "group" ? t("chat.groupMeta", { count: active.group.memberCount }) : t(active.peer.role)}{active.muted ? t("chat.mutedSuffix") : ""}</p></div></div><div ref={menuRef} className="chat-more" onPointerDown={(event) => event.stopPropagation()}><button type="button" className="chat-more-trigger" onClick={() => setMenuOpen((value) => !value)} aria-label={t("chat.options")} aria-haspopup="menu" aria-expanded={menuOpen}><MoreVertical size={18} /></button><AnimatePresence>{menuOpen ? <motion.div className="chat-more-menu" role="menu" initial={reduceMotion ? false : { opacity: 0, y: -6, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: .98 }}><button type="button" role="menuitem" onClick={() => void mute()}>{active.muted ? <Volume2 size={16} /> : <BellOff size={16} />}<span><strong>{t(active.muted ? "chat.unmute" : "chat.mute")}</strong><small>{t(active.muted ? "chat.unmuteHint" : "chat.muteHint")}</small></span></button><button type="button" role="menuitem" onClick={() => report(active.kind === "group" ? "club" : "profile", active.peer.id, active.peer.name)}><Flag size={16} /><span><strong>{t("chat.report")}</strong><small>{t("chat.reportHint")}</small></span></button>{active.kind === "direct" ? <button type="button" role="menuitem" className="is-danger" onClick={() => void block()}><Ban size={16} /><span><strong>{t("chat.block")}</strong><small>{t("chat.blockHint")}</small></span></button> : null}</motion.div> : null}</AnimatePresence></div></header>
              <div ref={listRef} className="message-list" data-pattern={conversationPattern(active.conversationId)} role="log" aria-live="polite" onScroll={onListScroll}>
                {loading ? <p className="chat-state">{t("chat.loadingShort")}</p> : null}
                {error ? <p className="form-error" role="alert">{error}</p> : null}
                {feedback ? <p className="chat-feedback" role="status">{feedback}</p> : null}
                {!loading && !error && !messages.length ? <p className="chat-state">{t("chat.firstMessage")}</p> : null}
                <AnimatePresence initial={false}>
                  {rendered.map((entry) => entry.type === "day"
                    ? <div key={entry.key} className="message-day"><span>{entry.label}</span></div>
                    : (() => {
                      const message = entry.message;
                      const own = message.senderId === user?.id;
                      const canDelete = !message.deleted && (own || (active.kind === "group" && active.group.isAdmin));
                      const canEdit = own && !message.deleted;
                      return (
                        <motion.div key={message.id} data-message={message.id} className={`message-row ${own ? "message-own" : "message-peer"}${entry.groupStart ? " group-start" : ""}${entry.groupEnd ? " group-end" : ""}${actionsFor === message.id ? " actions-open" : ""}${revealedFor === message.id ? " is-revealed" : ""}`} data-deleted={message.deleted ? "true" : undefined} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} layout={reduceMotion ? false : "position"}>
                          {!own ? (entry.groupEnd ? <span className={`message-avatar${message.senderAvatarUrl ? " has-image" : ""}`} style={avatarStyle(message.senderAvatarUrl)}>{message.senderAvatarUrl ? null : message.senderInitials || active.peer.initials}</span> : <span className="message-avatar message-avatar-spacer" aria-hidden="true" />) : null}
                          <div className="message-bubble-wrap">
                            {active.kind === "group" && !own && entry.groupStart ? <strong className="message-sender-name">{message.senderName || t("chat.clubMember")}</strong> : null}
                            <div className="message-bubble" onClick={(event) => { if ((event.target as HTMLElement).closest("button") || !window.matchMedia("(hover: none)").matches) return; setRevealedFor((current) => current === message.id ? null : message.id); }}>
                              {message.replyTo ? <button type="button" className="message-quote" onClick={() => scrollToMessage(message.replyTo!.id)}><span>{message.replyTo.senderName}</span><small>{message.replyTo.deleted ? t("chat.deletedMessage") : message.replyTo.body}</small></button> : null}
                              <p>{message.deleted ? t("chat.deletedMessage") : message.body}</p>
                              <span className="message-meta">{message.editedAt && !message.deleted ? <em className="message-edited">{t("chat.edited")}</em> : null}{new Intl.DateTimeFormat("az-AZ", { hour: "2-digit", minute: "2-digit" }).format(new Date(message.createdAt))}{own && message.status ? (message.status === "read" ? <CheckCheck className="tick tick-read" size={13} /> : <Check className="tick" size={12} />) : null}</span>
                              {!message.deleted ? <div className="message-actions"><button type="button" onClick={() => setActionsFor((current) => current === message.id ? null : message.id)} aria-label={t("chat.reaction")}><SmilePlus size={14} /></button><button type="button" onClick={() => startReply(message)} aria-label={t("chat.reply")}><Reply size={14} /></button>{canEdit ? <button type="button" onClick={() => startEdit(message)} aria-label={t("chat.edit")}><Pencil size={13} /></button> : null}{canDelete ? <button type="button" onClick={() => void removeMessage(message.id)} aria-label={t("chat.delete")}><Trash2 size={13} /></button> : null}{!own ? <button type="button" onClick={() => report("message", message.id, message.body.length > 60 ? `${message.body.slice(0, 60)}…` : message.body)} aria-label={t("chat.reportMessage")}><Flag size={13} /></button> : null}</div> : null}
                              <AnimatePresence>{actionsFor === message.id && !message.deleted ? <motion.div className="reaction-bar" initial={reduceMotion ? false : { opacity: 0, y: 6, scale: .9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .9 }}>{REACTIONS.map((emoji) => <button type="button" key={emoji} onClick={() => void toggleReaction(message.id, emoji)} aria-label={t("chat.reactWith", { emoji })}>{emoji}</button>)}</motion.div> : null}</AnimatePresence>
                            </div>
                            {message.reactions?.length ? <div className={`message-reactions${own ? " own" : ""}`}>{message.reactions.map((reaction) => <button type="button" key={reaction.emoji} className={reaction.mine ? "mine" : ""} onClick={() => void toggleReaction(message.id, reaction.emoji)}><span>{reaction.emoji}</span>{reaction.count > 1 ? <b>{reaction.count}</b> : null}</button>)}</div> : null}
                          </div>
                        </motion.div>
                      );
                    })())}
                  {typing ? <motion.div key="typing" className="typing-row" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><span className={`message-avatar${active.peer.avatarUrl ? " has-image" : ""}`} style={avatarStyle(active.peer.avatarUrl)}>{active.peer.avatarUrl ? null : active.peer.initials}</span><div className="typing-bubble"><i /><i /><i /></div></motion.div> : null}
                </AnimatePresence>
              </div>
              <AnimatePresence>{!atBottom ? <motion.button type="button" className="chat-scroll-bottom" onClick={() => { setAtBottom(true); scrollToEnd(reduceMotion ? "auto" : "smooth"); }} aria-label={t("chat.toLatest")} initial={reduceMotion ? false : { opacity: 0, scale: .8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .8 }}><ChevronDown size={18} /></motion.button> : null}</AnimatePresence>
              <form className="chat-composer" onSubmit={(event) => void send(event)}>
                <AnimatePresence>{replyTo || editing ? <motion.div className="composer-context" initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}><div className="composer-context-body"><span>{editing ? t("chat.editLabel") : t("chat.replyTo", { name: replyTo?.senderName ?? "" })}</span><small>{editing ? editing.body : replyTo?.deleted ? t("chat.deletedMessage") : replyTo?.body}</small></div><button type="button" onClick={cancelComposerContext} aria-label={t("chat.cancel")}><X size={15} /></button></motion.div> : null}</AnimatePresence>
                <div className="composer-row">
                  <div className="composer-emoji">
                    <button type="button" className="composer-emoji-trigger" onClick={() => setEmojiOpen((value) => !value)} aria-label={t("chat.addEmoji")} aria-expanded={emojiOpen}><SmilePlus size={19} /></button>
                    <AnimatePresence>{emojiOpen ? <motion.div className="composer-emoji-panel" initial={reduceMotion ? false : { opacity: 0, y: 8, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: .96 }}>{EMOJIS.map((emoji) => <button type="button" key={emoji} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</motion.div> : null}</AnimatePresence>
                  </div>
                  <label className="sr-only" htmlFor="chat-message">{t("chat.messageLabel")}</label>
                  <textarea ref={inputRef} id="chat-message" value={draft} onChange={(event) => changeDraft(event.target.value)} onKeyDown={keyDown} rows={1} maxLength={2000} placeholder={t(editing ? "chat.editPlaceholder" : "chat.placeholder")} />
                  <button type="submit" disabled={!draft.trim() || !active.conversationId}>{editing ? <Check size={18} /> : <Send size={17} />}</button>
                </div>
                <span className="composer-hint">{t("chat.sendHint")}</span>
              </form>
            </> : <div className="chat-center-empty">{feedback ? <p className="chat-feedback" role="status">{feedback}</p> : null}<MessagesSquare size={30} /><h2>{t("chat.pickTitle")}</h2><p>{t("chat.pickBody")}</p></div>}
          </main>
        </motion.section>
      ) : null}</AnimatePresence>
    </div>
  );
}

const EMOJIS = ["😀", "😄", "😁", "😊", "🙂", "😉", "😍", "😘", "😎", "🤩", "🥳", "😜", "🤔", "😐", "😴", "😢", "😭", "😡", "👍", "👎", "👏", "🙏", "💪", "🔥", "✨", "🎉", "❤️", "💚", "💙", "💜", "☕", "📚", "🎓", "⚽", "🎵", "✅"] as const;

type TimelineEntry =
  | { type: "day"; key: string; label: string }
  | { type: "message"; key: string; message: ApiMessage; groupStart: boolean; groupEnd: boolean };

function buildTimeline(messages: ApiMessage[], labelFor: (date: Date) => string): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let lastDay = "";
  messages.forEach((message, index) => {
    const date = new Date(message.createdAt);
    const dayKey = date.toDateString();
    if (dayKey !== lastDay) {
      entries.push({ type: "day", key: `day-${dayKey}`, label: labelFor(date) });
      lastDay = dayKey;
    }
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const sameAsPrevious = Boolean(previous) && previous.senderId === message.senderId && new Date(previous.createdAt).toDateString() === dayKey && Math.abs(date.getTime() - new Date(previous.createdAt).getTime()) < 4 * 60 * 1000;
    const sameAsNext = Boolean(next) && next.senderId === message.senderId && new Date(next.createdAt).toDateString() === dayKey && Math.abs(new Date(next.createdAt).getTime() - date.getTime()) < 4 * 60 * 1000;
    entries.push({ type: "message", key: message.id, message, groupStart: !sameAsPrevious, groupEnd: !sameAsNext });
  });
  return entries;
}

/**
 * Söhbətdə gün ayırıcısı. Əvvəl "Bu gün"/"Dünən" sərt yazılmışdı və tarix
 * `Intl("az-AZ", { month: "long" })` ilə qurulurdu — dil nəzərə alınmırdı, bəzi
 * Chromium-larda isə ay adı əvəzinə "M09" çıxırdı. Ay adı lüğətdən gəlir.
 */
function dayLabel(date: Date, t: (key: string) => string): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return t("chat.today");
  if (date.toDateString() === yesterday.toDateString()) return t("chat.yesterday");
  const month = t(`month.${date.getMonth() + 1}`);
  return date.getFullYear() === today.getFullYear() ? `${date.getDate()} ${month}` : `${date.getDate()} ${month} ${date.getFullYear()}`;
}

function applyOwnReaction(reactions: ApiReaction[] | undefined, emoji: ReactionEmoji): ApiReaction[] {
  const list = (reactions ?? []).map((reaction) => ({ ...reaction }));
  const mineIndex = list.findIndex((reaction) => reaction.mine);
  if (mineIndex >= 0 && list[mineIndex].emoji === emoji) {
    list[mineIndex].count -= 1;
    list[mineIndex].mine = false;
    return list.filter((reaction) => reaction.count > 0);
  }
  if (mineIndex >= 0) { list[mineIndex].count -= 1; list[mineIndex].mine = false; }
  const target = list.find((reaction) => reaction.emoji === emoji);
  if (target) { target.count += 1; target.mine = true; } else list.push({ emoji, count: 1, mine: true });
  return list.filter((reaction) => reaction.count > 0);
}

function mergeReactions(current: ApiReaction[] | undefined, incoming: ApiReaction[]): ApiReaction[] | undefined {
  const mineEmoji = current?.find((reaction) => reaction.mine)?.emoji;
  const merged = incoming.map((reaction) => ({ ...reaction, mine: reaction.emoji === mineEmoji }));
  return merged.length ? merged : undefined;
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase("az")).join(""); }
function apiPeer(peer: ApiConversation["peer"]): Peer { return { id: peer.id, name: peer.name, initials: initials(peer.name), role: roleLabelKey(peer.role), focus: peer.program, bio: "", city: peer.city, status: "online", accent: "#8fc15f", glow: "rgba(143,193,95,.28)", mutuals: 0, tags: [], openingMessage: "", reply: "", avatarUrl: peer.avatarUrl }; }
function groupTarget(item: ApiGroup): ClubChatTarget { return { conversationId: item.id, clubId: item.club.id, name: item.club.name, initials: initials(item.club.name), memberCount: item.memberCount, isAdmin: item.isAdmin }; }
/** `t` kenardan verilir: modul seviyyesinde hook cagirmaq olmaz. */
function groupPeer(item: ApiGroup, t: (key: string, values?: Record<string, string | number>) => string): Peer { return { id: item.club.id, name: item.club.name, initials: initials(item.club.name), role: "chat.clubGroup", focus: t("chat.members", { count: item.memberCount }), bio: "", city: "", status: "online", accent: "#44766c", glow: "rgba(68,118,108,.28)", mutuals: 0, tags: [], openingMessage: "", reply: "" }; }
function conversationPattern(id?: string) { return String([...(id ?? "edurate")].reduce((total, character) => total + character.charCodeAt(0), 0) % 3); }
function avatarStyle(url?: string): CSSProperties | undefined { return url ? { backgroundImage: `url("${url}")`, "--avatar-image": `url("${url}")` } as CSSProperties : undefined; }
