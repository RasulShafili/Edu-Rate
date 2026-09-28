"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  CalendarDays,
  Check,
  Eye,
  Megaphone,
  SlidersHorizontal,
  BookmarkCheck,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import type { AnnouncementItem, NetworkFilter, NetworkTone } from "../data/network";
import { networkFilters } from "../data/network";
import { bakuDateParts, formatDateWithMonths, isExpired } from "../lib/date";
import { EmptyState } from "./ui/Primitives";
import { useAuth } from "./AuthProvider";
import { AnnouncementSubmissionDialog } from "./AnnouncementSubmissionDialog";
import { AnnouncementComments } from "./AnnouncementComments";
import { fetchMine, MySubmissions } from "./MySubmissions";

type MyAnnouncement = { id: string; title: string; category: string; status: string; createdAt: string };
const ADMIN_ROLES = ["owner_admin", "admin", "assistant_admin"];
import { useT } from "../i18n/LanguageProvider";

/** Ay adlari lugetden gelir ki, tarix secilmis dilde yazilsin. */
function useMonthNames(){const t=useT();return Array.from({length:12},(_,index)=>t(`month.${index+1}`));}

type AnnouncementsBoardProps = {
  items: readonly AnnouncementItem[];
  activeFilter: NetworkFilter;
  onFilterChange: (filter: NetworkFilter) => void;
  reducedMotion: boolean;
};

const tones: Record<NetworkTone, { marker: string; date: string; initials: string }> = {
  lime: { marker: "bg-[#44766c]", date: "bg-[#d3e8bf] text-[#16423c]", initials: "bg-[#d3e8bf]" },
  lilac: { marker: "bg-[#7c6fc5]", date: "bg-[#ebe8ff] text-[#514394]", initials: "bg-[#ebe8ff]" },
  blue: { marker: "bg-[#4b8ca1]", date: "bg-[#caeaf1] text-[#16423c]", initials: "bg-[#caeaf1]" },
  coral: { marker: "bg-[#c8795d]", date: "bg-[#fee7df] text-[#8c452e]", initials: "bg-[#fee7df]" },
  mint: { marker: "bg-[#3f8d7f]", date: "bg-[#d7f1eb] text-[#176c5f]", initials: "bg-[#d7f1eb]" },
  gold: { marker: "bg-[#b38b24]", date: "bg-[#f8edc7] text-[#72580a]", initials: "bg-[#f8edc7]" },
};

export function AnnouncementsBoard({ items, activeFilter, onFilterChange, reducedMotion }: AnnouncementsBoardProps) {
  const {user}=useAuth();
  const t=useT();
  const [stateOverrides, setStateOverrides] = useState<Record<string, { read?: boolean; bookmarked?: boolean }>>({});
  const [compactLimit, setCompactLimit] = useState(4);
  const [submissionOpen,setSubmissionOpen]=useState(false);
  // Göndərilən elan qaralama kimi yoxlanışa gedir; lövhə yalnız dərc olunanı göstərir.
  // Adminlər öz elanlarını idarəetmə panelində görür.
  const showMine=Boolean(user&&!ADMIN_ROLES.includes(user.accessRole??""));
  const mine=useSWR(showMine?["announcements-mine",user?.id]:null,()=>fetchMine<MyAnnouncement>("/api/network/announcements/mine"),{revalidateOnFocus:false});
  /**
   * Yadda saxlama serverdə saxlanılırdı, amma saxlanmış elanları görmək üçün
   * interfeysdə heç bir yer yox idi — düymə heç nəyə aparmırdı. Bu görünüş
   * həmin boşluğu bağlayır; məlumat artıq API cavabındadır.
   */
  const [savedOnly, setSavedOnly] = useState(false);
  /** Oxundu/yadda saxla və reaksiya sorğuları səssizcə geri qayıdırdı. */
  const [stateError, setStateError] = useState("");
  const filtered = items.filter((item) => activeFilter === "all" || item.category === activeFilter);
  const readState=(item:AnnouncementItem)=>stateOverrides[item.id]?.read??Boolean(item.read);
  const bookmarkState=(item:AnnouncementItem)=>stateOverrides[item.id]?.bookmarked??Boolean(item.bookmarked);

  const savedCount = items.filter(bookmarkState).length;
  const scoped = savedOnly ? filtered.filter(bookmarkState) : filtered;
  const active = scoped.filter((item) => !isExpired(item.expiresAt));
  const archived = scoped.filter((item) => isExpired(item.expiresAt));
  const priority = active.filter((item) => item.priority).slice(0, 3);
  const rest = active.filter((item) => !priority.some((priorityItem) => priorityItem.id === item.id));

  async function updateState(kind:"read"|"bookmarked",id:string,current:boolean){
    if (!user) return;
    const nextValue=!current;
    setStateError("");
    setStateOverrides((values)=>({...values,[id]:{...values[id],[kind]:nextValue}}));
    try{
      const response=await fetch(`/api/network/announcements/${encodeURIComponent(id)}/state`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({[kind]:nextValue})});
      if(!response.ok){
        // Sessiya bitəndə sorğu 401 qaytarır, amma interfeys hələ də istifadəçini
        // daxil olmuş sayır — səbəbi yazmasaq düymə sonsuza qədər "işləmir".
        setStateError(t(response.status===401?"ann.sessionExpired":"ann.stateFailed"));
        throw new Error("STATE_NOT_SAVED");
      }
    }catch{
      setStateOverrides((values)=>({...values,[id]:{...values[id],[kind]:current}}));
      setStateError((current)=>current||t("ann.stateFailed"));
    }
  }

  return (
    <section className="announcements-board" aria-labelledby="announcements-title">
      <header className="announcements-board-heading">
        <div><span><Megaphone size={14} aria-hidden="true" /> {t("ann.eyebrow")}</span><h2 id="announcements-title">{t("ann.title")}</h2></div>
        {user?<button type="button" className="announcement-submit-trigger" onClick={()=>setSubmissionOpen(true)}><Plus size={16}/>{t("ann.submit")}</button>:null}
      </header>

      {showMine?<MySubmissions headingId="announcements-mine-title" title={t("ann.mine.title")} body={t("ann.mine.body")} error={mine.error} onRetry={()=>void mine.mutate()} items={(mine.data??[]).map((item)=>{const date=bakuDateParts(item.createdAt);return{id:item.id,title:item.title,meta:`${t(`category.${item.category}`)} · ${date.day} ${t(`month.${date.month}`)} ${date.year}`,statusLabel:t(item.status==="published"?"ann.mine.status.published":"ann.mine.status.draft"),tone:item.status==="published"?"positive":"pending"};})}/>:null}

      <div className="announcement-filter-bar">
        <span aria-hidden="true"><SlidersHorizontal size={15} /></span>
        <div className="announcement-filters" role="group" aria-label={t("ann.filterLabel")}>
          {networkFilters.map((filter) => {
            const selected = activeFilter === filter;
            return <button key={filter} type="button" aria-pressed={selected} onClick={() => onFilterChange(filter)}>{selected && <motion.i layoutId="active-network-filter" transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true" />}<span>{t(`category.${filter}`)}</span></button>;
          })}
        </div>
        {user ? (
          <button
            type="button"
            className={`announcement-saved-toggle${savedOnly ? " is-active" : ""}`}
            aria-pressed={savedOnly}
            onClick={() => { setSavedOnly((value) => !value); setCompactLimit(4); }}
          >
            <BookmarkCheck size={14} aria-hidden="true" /> {t("ann.saved")} <b>{savedCount}</b>
          </button>
        ) : null}
        <span className="announcement-count">{t("ann.active", { count: active.length })}</span>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{t("ann.srCount", { filter: t(`category.${activeFilter}`), count: active.length })}</p>

      <div aria-live="polite">
        {stateError ? (
          <p className="announcement-state-error" role="alert">
            <TriangleAlert size={14} aria-hidden="true" /> {stateError}
          </p>
        ) : null}
      </div>

      {active.length === 0 ? (
        <EmptyState
          title={t(savedOnly ? "ann.savedEmptyTitle" : "ann.emptyTitle")}
          description={t(savedOnly ? "ann.savedEmptyBody" : "ann.emptyBody")}
        />
      ) : (
        <>
          {priority.length > 0 && <div className="announcement-priority-grid"><AnimatePresence mode="popLayout">{priority.map((item, index) => <AnnouncementCard key={item.id} item={item} index={index} reducedMotion={reducedMotion} read={readState(item)} bookmarked={bookmarkState(item)} onRead={() => void updateState("read",item.id,readState(item))} onBookmark={() => void updateState("bookmarked",item.id,bookmarkState(item))} />)}</AnimatePresence></div>}
          {rest.length > 0 && <section className="announcement-compact-section" aria-labelledby="other-announcements-title"><h3 id="other-announcements-title">{t("ann.others")}</h3><div className="announcement-compact-list">{rest.slice(0, compactLimit).map((item) => <AnnouncementCompact key={item.id} item={item} read={readState(item)} bookmarked={bookmarkState(item)} onRead={() => void updateState("read",item.id,readState(item))} onBookmark={() => void updateState("bookmarked",item.id,bookmarkState(item))} />)}</div>{compactLimit < rest.length && <button type="button" className="announcement-load-more" onClick={() => setCompactLimit((current) => current + 4)}>{t("ann.loadMore")}</button>}</section>}
        </>
      )}

      {archived.length > 0 && <details className="announcement-archive"><summary>{t("ann.archive")} <span>{archived.length}</span></summary><div>{archived.map((item) => <AnnouncementCompact key={item.id} item={item} archived read={readState(item)} bookmarked={bookmarkState(item)} onRead={() => void updateState("read",item.id,readState(item))} onBookmark={() => void updateState("bookmarked",item.id,bookmarkState(item))} />)}</div></details>}
      <AnnouncementSubmissionDialog open={submissionOpen} onClose={()=>{setSubmissionOpen(false);void mine.mutate();}}/>
    </section>
  );
}

function AnnouncementCard({ item, index, reducedMotion, read, bookmarked, onRead, onBookmark }: { item: AnnouncementItem; index: number; reducedMotion: boolean; read: boolean; bookmarked: boolean; onRead: () => void; onBookmark: () => void }) {
  const t = useT();
  const months = useMonthNames();
  const tone = tones[item.tone];
  return <motion.article layout className={`announcement-card${read ? " is-read" : ""}`} initial={reducedMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}><i className={tone.marker} aria-hidden="true" />{item.imageUrl ? <div className="announcement-card-image" style={{ backgroundImage: `url("${item.imageUrl}")` }} role="img" aria-label={t("ann.imageAlt", { title: item.title })} /> : null}<div className="announcement-card-meta"><span className={tone.date}><CalendarDays size={12} aria-hidden="true" />{formatDateWithMonths(item.startsAt, months)}</span>{!read && <b>{t("ann.new")}</b>}</div><h3>{item.title}</h3><p>{item.summary}</p><AnnouncementEngagement item={item}/><footer><span className={tone.initials}>{item.sourceInitials}</span><span>{item.source}</span><AnnouncementActions read={read} bookmarked={bookmarked} onRead={onRead} onBookmark={onBookmark} /></footer></motion.article>;
}

function AnnouncementCompact({ item, archived = false, read, bookmarked, onRead, onBookmark }: { item: AnnouncementItem; archived?: boolean; read: boolean; bookmarked: boolean; onRead: () => void; onBookmark: () => void }) {
  const t = useT();
  const months = useMonthNames();
  return <article className={`announcement-compact${archived || read ? " is-muted" : ""}`}>{item.imageUrl ? <span className="announcement-compact-image" style={{ backgroundImage: `url("${item.imageUrl}")` }} aria-hidden="true" /> : null}<div><span>{t(`category.${item.category}`)}</span>{archived && <b>{t("ann.archived")}</b>}<h4>{item.title}</h4><p>{item.summary}</p><AnnouncementEngagement item={item}/></div><time dateTime={item.startsAt}>{formatDateWithMonths(item.startsAt, months)}</time><AnnouncementActions read={read} bookmarked={bookmarked} onRead={onRead} onBookmark={onBookmark} /></article>;
}

const reactionOptions=["👍","❤️","😂","😮","😢","👏","🎉","🤔","👎","🙏"] as const;
type AnnouncementReactionPerson={userId:string;name:string;avatarUrl:string|null;emoji:string;reactedAt:string};
type AnnouncementReactionState={reactions:Record<string,number>;myReaction:string|null;people:AnnouncementReactionPerson[]};
function AnnouncementEngagement({item}:{item:AnnouncementItem}){
  const {user}=useAuth();const t=useT();const [views,setViews]=useState(item.viewCount??0);const [selected,setSelected]=useState(item.myReaction??null);const [counts,setCounts]=useState<Record<string,number>>(item.reactions??{});const [open,setOpen]=useState(false);const [people,setPeople]=useState<AnnouncementReactionPerson[]>([]);const [detailsOpen,setDetailsOpen]=useState(false);const [detailsFilter,setDetailsFilter]=useState<string|null>(null);const [detailsBusy,setDetailsBusy]=useState(false);const [detailsError,setDetailsError]=useState("");const [reactError,setReactError]=useState("");
  useEffect(()=>{if(!user)return;void fetch(`/api/network/announcements/${encodeURIComponent(item.id)}/view`,{method:"POST"}).then(async(response)=>{if(response.ok){const payload=await response.json() as {data:{viewCount:number}};setViews(payload.data.viewCount);}});},[item.id,user]);
  useEffect(()=>{if(!user)return;const controller=new AbortController();void fetch(`/api/network/announcements/${encodeURIComponent(item.id)}/reactions`,{signal:controller.signal,cache:"no-store"}).then(async(response)=>{if(!response.ok)return;const payload=await response.json() as {data:AnnouncementReactionState};setCounts(payload.data.reactions);setSelected(payload.data.myReaction);setPeople(payload.data.people);}).catch(()=>undefined);return()=>controller.abort();},[item.id,user]);
  async function loadDetails(filter:string|null){if(!user)return;setDetailsFilter(filter);setDetailsOpen(true);setDetailsBusy(true);setDetailsError("");try{const response=await fetch(`/api/network/announcements/${encodeURIComponent(item.id)}/reactions`,{cache:"no-store"});const payload=await response.json() as {data?:AnnouncementReactionState;error?:{message?:string}};if(!response.ok||!payload.data)throw new Error(payload.error?.message??t("ann.reactionsFailed"));setCounts(payload.data.reactions);setSelected(payload.data.myReaction);setPeople(payload.data.people);}catch(error){setDetailsError(error instanceof Error?error.message:t("ann.reactionsFailed"));}finally{setDetailsBusy(false);}}
  async function react(emoji:string){if(!user)return;setReactError("");const next=selected===emoji?null:emoji;const previous=selected;const previousCounts=counts;setSelected(next);setCounts((current)=>{const value={...current};if(previous)value[previous]=Math.max(0,(value[previous]??1)-1);if(next)value[next]=(value[next]??0)+1;return value});setOpen(false);try{const response=await fetch(`/api/network/announcements/${encodeURIComponent(item.id)}/reaction`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({emoji:next})});const payload=await response.json() as {data?:AnnouncementReactionState;error?:{message?:string}};if(!response.ok||!payload.data)throw new Error(payload.error?.message??t("ann.reactFailed"));setSelected(payload.data.myReaction);setCounts(payload.data.reactions);setPeople(payload.data.people);}catch{setSelected(previous);setCounts(previousCounts);setReactError(t("ann.reactFailed"));}}
  const visiblePeople=detailsFilter?people.filter((person)=>person.emoji===detailsFilter):people;
  return <><div className="announcement-engagement"><span><Eye size={13}/>{t("ann.views", { count: views })}</span><div className="announcement-reaction-summary">{Object.entries(counts).filter(([,count])=>count>0).slice(0,4).map(([emoji,count])=><button key={emoji} type="button" className={selected===emoji?"is-selected":""} onClick={()=>void loadDetails(emoji)} disabled={!user} aria-label={t("ann.showReactors", { emoji, count })}>{emoji} <b>{count}</b></button>)}</div><div className="announcement-reaction-picker"><button type="button" onClick={()=>setOpen((value)=>!value)} disabled={!user} title={t(user?"ann.react":"ann.reactSignIn")}>☺+</button>{open?<div>{reactionOptions.map((emoji)=><button key={emoji} type="button" onClick={()=>void react(emoji)} aria-label={t("ann.reactionAria", { emoji })}>{emoji}</button>)}</div>:null}</div></div>{reactError?<p className="announcement-state-error" role="alert">{reactError}</p>:null}<AnnouncementComments announcementId={item.id} initialCount={item.commentCount??0}/>{detailsOpen&&typeof document!=="undefined"?createPortal(<div className="announcement-reaction-details-backdrop" role="presentation" onMouseDown={(event)=>{if(event.target===event.currentTarget)setDetailsOpen(false);}}><section className="announcement-reaction-details" role="dialog" aria-modal="true" aria-label={t("ann.reactionsDialog")}><header><div><small>{t("ann.reactionsEyebrow")}</small><h3>{t("ann.peopleCount", { count: people.length })}</h3></div><button type="button" onClick={()=>setDetailsOpen(false)} aria-label={t("ann.close")}><X size={18}/></button></header><nav aria-label={t("ann.filterByReaction")}><button type="button" className={detailsFilter===null?"is-active":""} onClick={()=>setDetailsFilter(null)}>{t("category.all")} <b>{people.length}</b></button>{Object.entries(counts).filter(([,count])=>count>0).map(([emoji,count])=><button key={emoji} type="button" className={detailsFilter===emoji?"is-active":""} onClick={()=>setDetailsFilter(emoji)}>{emoji} <b>{count}</b></button>)}</nav><div className="announcement-reaction-people">{detailsBusy?<p>{t("ann.loadingShort")}</p>:detailsError?<p role="alert">{detailsError}</p>:visiblePeople.length?visiblePeople.map((person)=><div key={person.userId}><span className="announcement-reactor-avatar" style={person.avatarUrl?{backgroundImage:`url("${person.avatarUrl}")`}:undefined}>{person.avatarUrl?null:person.name.split(/\s+/).slice(0,2).map((part)=>part[0]?.toLocaleUpperCase("az")).join("")}</span><strong>{person.name}</strong><i>{person.emoji}</i></div>):<p>{t("ann.noReactors")}</p>}</div></section></div>,document.body):null}</>;
}

function AnnouncementActions({ read, bookmarked, onRead, onBookmark }: { read: boolean; bookmarked: boolean; onRead: () => void; onBookmark: () => void }) {
  const {user}=useAuth();const t=useT();
  return <div className="announcement-actions"><button type="button" onClick={onRead} disabled={!user} title={user?undefined:t("ann.signInHint")} aria-pressed={read} aria-label={t(read ? "ann.markUnread" : "ann.markRead")}><Check size={15} aria-hidden="true" /></button><button type="button" onClick={onBookmark} disabled={!user} title={user?undefined:t("ann.signInHint")} aria-pressed={bookmarked} aria-label={t(bookmarked ? "ann.unbookmark" : "ann.bookmark")}><Bookmark size={15} fill={bookmarked ? "currentColor" : "none"} aria-hidden="true" /></button></div>;
}
