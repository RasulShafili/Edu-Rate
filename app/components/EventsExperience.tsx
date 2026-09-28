"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import {
  categories,
  mapApiEvent,
  type ApiEvent,
  type Event,
  type EventFilter,
} from "../data/events";
import { useT } from "../i18n/LanguageProvider";
import { bakuDateParts, getTemporalStatus, sortByStartAt } from "../lib/date";
import { EventCard } from "./EventCard";
import { EventDrawer } from "./EventDrawer";
import { EmptyState, ErrorState, Skeleton } from "./ui/Primitives";
import { useAuth } from "./AuthProvider";
import { EventSubmissionDialog, type EditableEvent } from "./EventSubmissionDialog";
import { fetchMine, MySubmissions, type SubmissionItem } from "./MySubmissions";

type EventPeriod = "upcoming" | "past" | "registered";
type MyEvent = EditableEvent & { status: "Açıq" | "Qaralama" | "Tamamlanıb"; createdAt: string };

/** İstifadəçinin qeydiyyatları; uğursuzluq status kodu ilə atılır (401 ayrıca göstərilir). */
async function fetchRegistrations(): Promise<Set<string>> {
  const response = await fetch("/api/events/registrations", { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  const payload = (await response.json()) as { data?: Array<{ id: string }> };
  return new Set((payload.data ?? []).map((item) => item.id));
}

/** `?event=<id>` — tədbirə birbaşa link. */
function readLinkedEventId() {
  return new URLSearchParams(window.location.search).get("event");
}
function writeLinkedEventId(eventId: string | null) {
  const url = new URL(window.location.href);
  if (eventId) url.searchParams.set("event", eventId); else url.searchParams.delete("event");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

const MY_EVENT_STATUS: Record<MyEvent["status"], { key: string; tone: SubmissionItem["tone"] }> = {
  Qaralama: { key: "events.mine.status.review", tone: "pending" },
  "Açıq": { key: "events.mine.status.published", tone: "positive" },
  "Tamamlanıb": { key: "events.mine.status.completed", tone: "neutral" },
};

export function EventsExperience() {
  const t = useT();
  const {user}=useAuth();
  const [eventItems, setEventItems] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [activeFilter, setActiveFilter] = useState<EventFilter>("All");
  const [period, setPeriod] = useState<EventPeriod>("upcoming");
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [createOpen,setCreateOpen]=useState(false);
  const [editing, setEditing] = useState<MyEvent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState("");
  const [mineStatus, setMineStatus] = useState("");
  // Qeydiyyatlar səhifədə saxlanır: kart nişanı, "Qeydiyyatlarım" tabı və drawer
  // eyni mənbədən oxuyur. Əvvəl yalnız drawer bilirdi və kartdakı boş yer sayı
  // qeydiyyatdan sonra köhnə qalırdı.
  const registrations = useSWR(user ? ["event-registrations", user.id] : null, fetchRegistrations, { revalidateOnFocus: false });
  const registeredIds = registrations.data ?? null;
  const canCreate=Boolean(user?.accessRole&&["teacher","admin","assistant_admin","owner_admin"].includes(user.accessRole));
  const publishesDirectly=Boolean(user?.accessRole&&["admin","assistant_admin","owner_admin"].includes(user.accessRole));
  // Müəllimin tədbiri qaralama kimi yoxlanışa gedir; onun taleyini burada görür.
  const reviewsOwnEvents = canCreate && !publishesDirectly;
  const myEvents = useSWR(reviewsOwnEvents ? ["events-mine", user?.id] : null, () => fetchMine<MyEvent>("/api/events/mine"), { revalidateOnFocus: false });
  const reduceMotion = useReducedMotion();
  const visibleEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("az");
    return sortByStartAt(eventItems).filter((event) => {
      const temporal = getTemporalStatus(event.startAt, event.endAt);
      const matchesPeriod = period === "registered"
        ? Boolean(registeredIds?.has(event.id))
        : period === "upcoming" ? temporal !== "finished" : temporal === "finished";
      const matchesCategory = activeFilter === "All" || event.category === activeFilter;
      // Bakı günü ilə müqayisə: `startAt.slice(0, 10)` UTC günüdür və 00:00–04:00
      // arası başlayan tədbir öz günü seçiləndə tapılmırdı.
      const bakuDay = `${event.year}-${String(event.monthIndex).padStart(2, "0")}-${event.date}`;
      const matchesDate = !dateFilter || bakuDay === dateFilter;
      const matchesQuery = !normalizedQuery || `${event.title} ${event.location} ${event.organizer}`.toLocaleLowerCase("az").includes(normalizedQuery);
      return matchesPeriod && matchesCategory && matchesDate && matchesQuery;
    });
  }, [activeFilter, dateFilter, eventItems, period, query, registeredIds]);
  const selectEvent = useCallback((event: Event) => {
    setSelectedEvent(event);
    writeLinkedEventId(event.id);
  }, []);
  const closeDrawer = useCallback(() => {
    setSelectedEvent(null);
    writeLinkedEventId(null);
  }, []);

  const onRegistrationChange = useCallback((eventId: string, registered: boolean, availableSpots?: number) => {
    void registrations.mutate((current) => {
      const next = new Set(current ?? []);
      if (registered) next.add(eventId); else next.delete(eventId);
      return next;
    }, { revalidate: false });
    if (availableSpots === undefined) return;
    setEventItems((items) => items.map((item) => item.id === eventId ? { ...item, availableSpots } : item));
    setSelectedEvent((current) => current && current.id === eventId ? { ...current, availableSpots } : current);
  }, [registrations]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setLoadFailed(false);
    try {
      const response = await fetch("/api/catalog/events", { cache: "no-store" });
      const payload = await response.json() as { data?: ApiEvent[] };
      if (!response.ok || !Array.isArray(payload.data)) throw new Error("events");
      const items = payload.data.map(mapApiEvent);
      setEventItems(items);
      // Birbaşa link: /events?event=<id> həmin tədbirin drawer-ini açır.
      const linkedId = readLinkedEventId();
      const linked = linkedId ? items.find((item) => item.id === linkedId) : undefined;
      if (linked) setSelectedEvent(linked);
      else if (linkedId) writeLinkedEventId(null);
    } catch {
      // Mətn yox, vəziyyət saxlanır: backend-in azərbaycanca mesajı EN/RU-da da görünürdü.
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadEvents(), 0);
    return () => window.clearTimeout(timer);
  }, [loadEvents]);

  const mySubmissionItems: SubmissionItem[] = (myEvents.data ?? []).map((item) => {
    const status = MY_EVENT_STATUS[item.status] ?? MY_EVENT_STATUS["Açıq"];
    const start = bakuDateParts(item.startAt);
    const registered = typeof item.registered === "number" ? ` · ${t("events.mine.registered", { count: item.registered, capacity: item.capacity })}` : "";
    return {
      id: item.id,
      title: item.title,
      meta: `${start.day} ${t(`month.${start.month}`)} ${start.year} · ${start.time}${registered}`,
      statusLabel: t(status.key),
      tone: status.tone,
    };
  });

  /** Yaradan öz tədbirini silir; qeydiyyatlı iştirakçılar bildiriş alır (backend). */
  async function deleteMine(eventId: string) {
    if (deleteConfirm !== eventId) { setDeleteConfirm(eventId); return; }
    setDeleting(eventId);
    setMineStatus("");
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(response.status === 401 ? "admin.error.session" : "events.mine.deleteFailed");
      setMineStatus("events.mine.deleted");
      if (selectedEvent?.id === eventId) closeDrawer();
      void myEvents.mutate();
      void loadEvents();
    } catch (error) {
      setMineStatus(error instanceof Error ? error.message : "events.mine.deleteFailed");
    } finally {
      setDeleting("");
      setDeleteConfirm("");
    }
  }

  return (
    <>
      <section id="events" className="events-section route-module-section" aria-labelledby="events-title">
        <motion.div
          className="section-heading"
          initial={reduceMotion ? false : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <span className="section-kicker">{t("events.kicker")}</span>
            <h1 id="events-title" className="module-page-title">{t("nav.events")}</h1>
          </div>
          {canCreate?<button type="button" className="event-create-trigger" onClick={()=>setCreateOpen(true)}><Plus size={17} aria-hidden="true"/>{t("events.create")}</button>:null}
        </motion.div>

        {reviewsOwnEvents ? (
          <MySubmissions
            headingId="events-mine-title"
            title={t("events.mine.title")}
            body={t("events.mine.body")}
            items={mySubmissionItems}
            error={myEvents.error}
            onRetry={() => void myEvents.mutate()}
            status={mineStatus ? t(mineStatus) : ""}
            renderActions={(item) => {
              const own = myEvents.data?.find((entry) => entry.id === item.id);
              const confirming = deleteConfirm === item.id;
              return (
                <>
                  <button type="button" onClick={() => { if (own) { setMineStatus(""); setEditing(own); } }} aria-label={`${t("events.mine.edit")}: ${item.title}`}>
                    <Pencil size={13} aria-hidden="true" /> {t("events.mine.edit")}
                  </button>
                  <button type="button" className={confirming ? "is-danger" : undefined} disabled={deleting === item.id}
                    onClick={() => void deleteMine(item.id)} onBlur={() => { if (confirming) setDeleteConfirm(""); }}
                    aria-label={confirming ? t("events.mine.deleteConfirm") : `${t("events.mine.delete")}: ${item.title}`}>
                    <Trash2 size={13} aria-hidden="true" /> {t(confirming ? "events.mine.deleteConfirm" : "events.mine.delete")}
                  </button>
                </>
              );
            }}
          />
        ) : null}

        <motion.div
          className="filters-row"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
        >
          <div className="event-period-tabs" role="tablist" aria-label={t("events.periodLabel")}>
            {(user ? (["upcoming", "past", "registered"] as const) : (["upcoming", "past"] as const)).map((value) => (
              <button key={value} type="button" role="tab" aria-selected={period === value} className={period === value ? "active" : ""} onClick={() => setPeriod(value)}>
                {t(value === "upcoming" ? "events.upcoming" : value === "past" ? "events.past" : "events.registeredTab")}
                {value === "registered" && registeredIds?.size ? <b className="event-period-count">{registeredIds.size}</b> : null}
              </button>
            ))}
          </div>
          <label className="event-search-field"><Search size={16} aria-hidden="true" /><span className="sr-only">{t("events.search")}</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("events.searchPlaceholder")} /></label>
          <label className="event-date-field"><span className="sr-only">{t("events.dateFilter")}</span><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
        </motion.div>

        <div className="filters-row event-category-row">
          <div className="filters" role="group" aria-label={t("events.categoryFilter")}>
            {categories.map((category) => (
              <button
                type="button"
                key={category}
                className={activeFilter === category ? "active" : ""}
                onClick={() => setActiveFilter(category)}
                aria-pressed={activeFilter === category}
              >
                {activeFilter === category && <motion.span className="filter-pill" layoutId="active-event-filter" />}
                <span>{category === "All" ? t("category.all") : t(`eventCategory.${category}`)}</span>
              </button>
            ))}
          </div>
          <span className="event-count">{t("events.count", { count: visibleEvents.length })}</span>
        </div>

        {isLoading ? (
          <div className="events-grid event-skeleton-grid" aria-label={t("events.loading")}>
            {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="event-card-skeleton" />)}
          </div>
        ) : loadFailed ? (
          <ErrorState title={t("events.errorTitle")} description={t("events.errorText")} action={<button type="button" className="kuds-primary-button" onClick={() => void loadEvents()}>{t("common.retry")}</button>} />
        ) : visibleEvents.length ? (
          <motion.div layout className="events-grid">
            <AnimatePresence mode="popLayout">
              {visibleEvents.map((event, index) => (
                <EventCard key={event.id} event={event} index={index} onSelect={selectEvent} registered={Boolean(registeredIds?.has(event.id))} />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : period === "registered" && registrations.error ? (
          <ErrorState title={t("events.errorTitle")} description={t(registrations.error instanceof Error && registrations.error.message === "401" ? "admin.error.session" : "events.error.registrationsLoad")} action={<button type="button" className="kuds-primary-button" onClick={() => void registrations.mutate()}>{t("common.retry")}</button>} />
        ) : period === "registered" && !registeredIds?.size ? (
          <EmptyState title={t("events.registeredEmptyTitle")} description={t("events.registeredEmptyText")} action={<button type="button" className="kuds-primary-button" onClick={() => setPeriod("upcoming")}>{t("events.upcoming")}</button>} />
        ) : (
          <EmptyState title={t("events.emptyTitle")} description={t("events.emptyText")} action={<button type="button" className="kuds-primary-button" onClick={() => { setQuery(""); setDateFilter(""); setActiveFilter("All"); }}>{t("events.clearFilters")}</button>} />
        )}
      </section>
      <EventDrawer
        event={selectedEvent}
        onClose={closeDrawer}
        registered={Boolean(selectedEvent && registeredIds?.has(selectedEvent.id))}
        registrationLoading={Boolean(user) && !registrations.data && !registrations.error}
        registrationLoadError={registrations.error ? (registrations.error instanceof Error && registrations.error.message === "401" ? "admin.error.session" : "events.error.registrationsLoad") : ""}
        onRegistrationChange={onRegistrationChange}
      />
      <EventSubmissionDialog open={createOpen || Boolean(editing)} editing={editing} onClose={()=>{ setCreateOpen(false); setEditing(null); }} onCreated={()=>{ void loadEvents(); void myEvents.mutate(); }} organizerName={user?.name??""} publishesDirectly={publishesDirectly}/>
    </>
  );
}
