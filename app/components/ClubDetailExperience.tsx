"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, CalendarDays, Clock3, Crown, Flag, MapPin, Save, Settings2, ShieldAlert, Sparkles, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Club, ClubTabId } from "../data/clubs";
import { clubTabIds } from "../data/clubs";
import { MagneticJoinButton } from "./MagneticJoinButton";
import { SecureImagePicker } from "./SecureImagePicker";
import { useAuth } from "./AuthProvider";
import { useT } from "../i18n/LanguageProvider";
import { ReportDialog } from "./ReportDialog";

const ease = [0.22, 1, 0.36, 1] as const;

type ClubDetailExperienceProps = {
  club: Club;
};

type ManagedMember={id:string;name:string;role:"leader"|"member";isCreator:boolean;avatarUrl?:string};
type ClubManagement={members:ManagedMember[];canManage:boolean;canDelete:boolean};

export function ClubDetailExperience({ club }: ClubDetailExperienceProps) {
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const t = useT();
  const [activeTab, setActiveTab] = useState<ClubTabId>("about");
  const [editable, setEditable] = useState(club);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [management,setManagement]=useState<ClubManagement|null>(null);
  const [memberBusy,setMemberBusy]=useState("");
  const [deleteConfirm,setDeleteConfirm]=useState(false);
  const [deleting,setDeleting]=useState(false);
  /**
   * Yoxlanışdakı klub: kataloqda görünmür və üzv qəbul etmir. Səhifə yalnız
   * yaradan, klub liderləri və rəhbərlik üçün açılır, ona görə vəziyyəti açıq
   * yazmaq lazımdır — əks halda istifadəçi klubunun niyə tapılmadığını bilmir.
   */
  const isPending = Boolean(club.status && club.status !== "Aktiv");
  const initialManage = Boolean(user && (user.id === club.createdBy || user.accessRole === "owner_admin" || user.accessRole === "admin" || user.accessRole === "assistant_admin"));
  const canManage=management?.canManage??initialManage;
  const reduceMotion = Boolean(useReducedMotion());
  const heroRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<ClubTabId, HTMLButtonElement | null>>({
    about: null,
    events: null,
    members: null,
    history: null,
  });
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const visualY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 124]);
  const visualScale = useTransform(scrollYProgress, [0, 1], [1, reduceMotion ? 1 : 1.08]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 42]);

  useEffect(()=>{
    if(!user||!club.id)return;
    const controller=new AbortController();
    fetch(`/api/clubs/${encodeURIComponent(club.id)}/members`,{cache:"no-store",signal:controller.signal}).then(async(response)=>{
      const payload=await response.json() as {data?:ClubManagement};if(response.ok&&payload.data)setManagement(payload.data);
    }).catch(()=>undefined);
    return()=>controller.abort();
  },[club.id,user]);

  async function changeLeader(member:ManagedMember){
    if(!club.id)return;setMemberBusy(member.id);setSaveMessage("");
    try{const response=await fetch(`/api/clubs/${encodeURIComponent(club.id)}/leaders/${encodeURIComponent(member.id)}`,{method:member.role==="leader"?"DELETE":"PATCH"});
      const payload=await response.json().catch(()=>null) as {data?:ManagedMember;error?:{message?:string}}|null;if(!response.ok||!payload?.data)throw new Error(payload?.error?.message||t("club.leaderFailed"));
      setManagement((current)=>current?{...current,members:current.members.map((item)=>item.id===member.id?payload.data!:item)}:current);
      setSaveMessage(t(member.role==="leader"?"club.leaderRemoved":"club.leaderChanged"));
    }catch(error){setSaveMessage(error instanceof Error?error.message:t("club.leaderFailed"));}finally{setMemberBusy("");}
  }

  async function removeClub(){
    if(!club.id)return;setDeleting(true);setSaveMessage("");
    try{const response=await fetch(`/api/clubs/${encodeURIComponent(club.id)}`,{method:"DELETE"});if(!response.ok){const payload=await response.json().catch(()=>null) as {error?:{message?:string}}|null;throw new Error(payload?.error?.message||t("club.deleteFailed"));}
      window.location.assign("/clubs");
    }catch(error){setSaveMessage(error instanceof Error?error.message:t("club.deleteFailed"));setDeleting(false);setDeleteConfirm(false);}
  }

  async function saveClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!club.id) return;
    setSaving(true);setSaveMessage("");
    try {
      const response = await fetch(`/api/clubs/${encodeURIComponent(club.id)}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({
        name:editable.name,category:editable.category,tagline:editable.tagline,description:editable.description,
        about:editable.about,focusTags:editable.focusTags,meeting:editable.meeting,
      }) });
      const payload=await response.json().catch(()=>null) as {error?:{message?:string}}|null;
      if(!response.ok)throw new Error(payload?.error?.message||t("club.saveFailed"));
      setSaveMessage(t("club.saved"));
    } catch(error) { setSaveMessage(error instanceof Error?error.message:t("club.saveFailed")); }
    finally { setSaving(false); }
  }

  function selectTab(tab: ClubTabId, moveFocus = false) {
    setActiveTab(tab);
    if (moveFocus) tabRefs.current[tab]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: ClubTabId) {
    const currentIndex = clubTabIds.indexOf(currentTab);
    let nextTab: ClubTabId | undefined;

    if (event.key === "ArrowRight") {
      nextTab = clubTabIds[(currentIndex + 1) % clubTabIds.length];
    } else if (event.key === "ArrowLeft") {
      nextTab = clubTabIds[(currentIndex - 1 + clubTabIds.length) % clubTabIds.length];
    } else if (event.key === "Home") {
      nextTab = clubTabIds[0];
    } else if (event.key === "End") {
      nextTab = clubTabIds[clubTabIds.length - 1];
    }

    if (!nextTab) return;

    event.preventDefault();
    selectTab(nextTab, true);
  }

  const activeTabId = `club-${club.slug}-tab-${activeTab}`;
  const activePanelId = `club-${club.slug}-panel-${activeTab}`;

  return (
    <section className={`club-detail club-tone-${club.tone}`} aria-labelledby="club-detail-title">
      <header ref={heroRef} className="club-detail-hero">
        <motion.div
          className={`club-detail-hero__visual${editable.coverUrl ? " has-cover" : ""}`}
          style={{ y: visualY, scale: visualScale, ...(editable.coverUrl ? { backgroundImage: `url("${editable.coverUrl}")` } : {}) }}
          aria-hidden="true"
        >
          <span className="club-detail-hero__orb club-detail-hero__orb--one" />
          <span className="club-detail-hero__orb club-detail-hero__orb--two" />
          <span className="club-detail-hero__mesh" />
          <span className="club-detail-hero__mark"><UsersRound size={44} strokeWidth={1.25} /></span>
        </motion.div>

        <div className="club-detail-hero__topline">
          <Link href="/clubs" className="club-detail-back-link">
            <ArrowLeft size={16} aria-hidden="true" />
            {t("club.back")}
          </Link>
          <ReportDialog target={reportOpen?{entityType:"club",entityId:club.id??club.slug,label:club.name}:null} onClose={()=>setReportOpen(false)}/><div className="club-detail-owner-actions"><span className="club-detail-category">{t(`clubCategory.${editable.category}`)}</span>{canManage?<button type="button" onClick={()=>setSettingsOpen((value)=>!value)}><Settings2 size={15}/>{t(settingsOpen?"club.settingsClose":"club.settingsOpen")}</button>:null}{user&&!canManage?<button type="button" className="club-report" onClick={()=>setReportOpen(true)}><Flag size={14} aria-hidden="true"/>{t("club.report")}</button>:null}</div>
        </div>

        <motion.div className="club-detail-hero__content" style={{ y: copyY }}>
          <span className="club-detail-eyebrow">{t("club.network")}</span>
          <h1 id="club-detail-title">{editable.name}</h1>
          <p className="club-detail-tagline">{editable.tagline}</p>
          <p className="club-detail-description">{editable.description}</p>

          <div className="club-detail-hero__footer">
            <dl className="club-detail-stats" aria-label={t("club.stats")}>
              {club.stats.map((stat) => (
                <div key={stat.label}>
                  <dt>{t(stat.label)}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
            {isPending ? (
              <p className="club-pending-note">
                <ShieldAlert size={15} aria-hidden="true" />
                {t("club.pendingJoin")}
              </p>
            ) : (
              <MagneticJoinButton clubId={club.slug} clubName={editable.name} />
            )}
          </div>
        </motion.div>
      </header>

      <div className="club-detail-body">
        {isPending ? (
          <p className="club-pending-banner" role="status">
            <ShieldAlert size={17} aria-hidden="true" />
            <span>
              <strong>{t("club.pendingTitle")}</strong>
              {t("club.pendingBody")}
            </span>
          </p>
        ) : null}
        <AnimatePresence>
          {settingsOpen ? <motion.form className="club-owner-editor" onSubmit={saveClub} initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
            <header><div><small>{t("club.editorEyebrow")}</small><h2>{t("club.editorTitle")}</h2><p>{t("club.editorBody")}</p></div><button type="button" onClick={()=>setSettingsOpen(false)} aria-label={t("club.close")}><X size={18}/></button></header>
            {club.id?<div className="club-owner-cover"><span>{t("clubs.cover")}</span><SecureImagePicker kind="club" ownerId={club.id} currentUrl={editable.coverUrl} onChange={(asset)=>setEditable((current)=>({...current,coverUrl:asset?.secureUrl}))}/></div>:null}
            <div className="club-owner-fields">
              <label><span>{t("clubs.fieldName")}</span><input value={editable.name} onChange={(e)=>setEditable({...editable,name:e.target.value})} minLength={3} maxLength={140} required/></label>
              <label><span>{t("clubs.fieldCategory")}</span><select value={editable.category} onChange={(e)=>setEditable({...editable,category:e.target.value as Club["category"]})}>{(["Texnologiya","Akademik","Yaradıcılıq","Sosial təsir","Mədəniyyət"] as const).map((item)=><option key={item} value={item}>{t(`clubCategory.${item}`)}</option>)}</select></label>
              <label className="is-wide"><span>{t("clubs.fieldTagline")}</span><input value={editable.tagline} onChange={(e)=>setEditable({...editable,tagline:e.target.value})} minLength={5} maxLength={220} required/></label>
              <label className="is-wide"><span>{t("club.fieldDescription")}</span><textarea value={editable.description} onChange={(e)=>setEditable({...editable,description:e.target.value})} minLength={10} maxLength={800} rows={3} required/></label>
              <label className="is-wide"><span>{t("clubs.fieldAbout")}</span><textarea value={editable.about.join("\n")} onChange={(e)=>setEditable({...editable,about:e.target.value.split(/\n/).filter(Boolean)})} minLength={10} maxLength={3000} rows={4} required/></label>
              <label><span>{t("clubs.fieldMeetingDay")}</span><input value={editable.meeting.day} onChange={(e)=>setEditable({...editable,meeting:{...editable.meeting,day:e.target.value}})} required/></label>
              <label><span>{t("clubs.fieldMeetingTime")}</span><input value={editable.meeting.time} onChange={(e)=>setEditable({...editable,meeting:{...editable.meeting,time:e.target.value}})} required/></label>
              <label className="is-wide"><span>{t("clubs.fieldMeetingPlace")}</span><input value={editable.meeting.place} onChange={(e)=>setEditable({...editable,meeting:{...editable.meeting,place:e.target.value}})} required/></label>
            </div>
            {canManage?<section className="club-leader-manager"><header><div><small>{t("club.leadersEyebrow")}</small><h3>{t("club.leadersTitle")}</h3><p>{t("club.leadersBody")}</p></div><Crown size={22}/></header><div>{management?management.members.length?management.members.map((member)=><article key={member.id}><span className={`club-leader-avatar${member.avatarUrl?" has-image":""}`} style={member.avatarUrl?{backgroundImage:`url("${member.avatarUrl}")`}:undefined}>{member.avatarUrl?null:member.name.split(/\s+/).slice(0,2).map((part)=>part[0]).join("")}</span><div><strong>{member.name}</strong><small>{t(member.isCreator?"club.roleCreator":member.role==="leader"?"club.roleLeader":"club.roleMember")}</small></div>{!member.isCreator?<button type="button" disabled={memberBusy===member.id} onClick={()=>void changeLeader(member)}>{member.role==="leader"?<><Trash2 size={14}/>{t("club.demote")}</>:<><UserPlus size={14}/>{t("club.promote")}</>}</button>:<Crown size={17} aria-label={t("club.roleLeader")}/>}</article>):<p className="club-leader-empty">{t("club.membersNone")}</p>:<p className="club-leader-empty">{t("club.membersLoading")}</p>}</div></section>:null}
            {management?.canDelete?<section className="club-danger-zone"><div><strong>{t("club.dangerTitle")}</strong><p>{t("club.dangerBody")}</p></div>{deleteConfirm?<div className="club-delete-confirm"><span>{t("club.dangerWarning")}</span><button type="button" onClick={()=>setDeleteConfirm(false)}>{t("club.dangerCancel")}</button><button type="button" disabled={deleting} onClick={()=>void removeClub()}><Trash2 size={14}/>{deleting?t("club.deleting"):t("club.dangerConfirm")}</button></div>:<button type="button" onClick={()=>setDeleteConfirm(true)}><Trash2 size={15}/>{t("club.dangerTitle")}</button>}</section>:null}
            <footer>{saveMessage?<p role="status">{saveMessage}</p>:<span/>}<button type="submit" disabled={saving}><Save size={15}/>{saving?t("club.saving"):t("club.save")}</button></footer>
          </motion.form>:null}
        </AnimatePresence>
        <div
          className="club-detail-tabs"
          role="tablist"
          aria-label={t("club.tabsLabel", { name: club.shortName })}
        >
          {clubTabIds.map((tab) => {
            const selected = activeTab === tab;
            const tabId = `club-${club.slug}-tab-${tab}`;
            const panelId = `club-${club.slug}-panel-${tab}`;

            return (
              <button
                key={tab}
                ref={(node) => {
                  tabRefs.current[tab] = node;
                }}
                id={tabId}
                type="button"
                className={`club-detail-tab${selected ? " is-active" : ""}`}
                role="tab"
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(tab)}
                onKeyDown={(event) => handleTabKeyDown(event, tab)}
              >
                <span>{t(`club.tab.${tab}`)}</span>
                {selected && (
                  <motion.i
                    className="club-detail-tab__indicator"
                    layoutId={`club-detail-tab-indicator-${club.slug}`}
                    transition={{ duration: reduceMotion ? 0 : 0.42, ease }}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>

        <AnimatePresence initial={false} mode="popLayout">
          <motion.section
            key={activeTab}
            id={activePanelId}
            className={`club-detail-panel club-detail-panel--${activeTab}`}
            role="tabpanel"
            aria-labelledby={activeTabId}
            tabIndex={0}
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.992 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.992 }}
            transition={{ duration: reduceMotion ? 0 : 0.46, ease }}
          >
            {activeTab === "about" && (
              <div className="club-about-layout">
                <article className="club-about-copy">
                  <span className="club-panel-kicker">{t("club.aboutKicker")}</span>
                  <h2>{t("club.aboutTitle")}</h2>
                  {editable.about.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  <ul className="club-focus-list" aria-label={t("club.focusLabel")}>
                    {editable.focusTags.map((tag) => <li key={tag}>{tag}</li>)}
                  </ul>
                </article>

                <aside className="club-meeting-card" aria-labelledby="club-meeting-title">
                  <span className="club-meeting-icon" aria-hidden="true"><Sparkles size={18} /></span>
                  <span className="club-panel-kicker">{t("club.meetingKicker")}</span>
                  <h2 id="club-meeting-title">{t("club.meetingTitle")}</h2>
                  <dl>
                    <div><dt><CalendarDays size={15} aria-hidden="true" /> {t("club.meetingCadence")}</dt><dd>{editable.meeting.cadence}</dd></div>
                    <div><dt><Clock3 size={15} aria-hidden="true" /> {t("club.meetingTime")}</dt><dd>{editable.meeting.day} · {editable.meeting.time}</dd></div>
                    <div><dt><MapPin size={15} aria-hidden="true" /> {t("club.meetingPlace")}</dt><dd>{editable.meeting.place}</dd></div>
                  </dl>
                </aside>
              </div>
            )}

            {activeTab === "events" && (
              <div className="club-events-section">
                <div className="club-panel-heading">
                  <div><span className="club-panel-kicker">{t("club.eventsKicker")}</span><h2>{t("club.eventsTitle")}</h2></div>
                  <p>{t("club.eventsBody")}</p>
                </div>
                <ol className="club-event-list">
                  {club.events.map((event) => (
                    <li key={event.id} className="club-event-item">
                      <time dateTime={event.date} className="club-event-date">
                        <strong>{event.dateLabel}</strong><span>{event.timeLabel}</span>
                      </time>
                      <div className="club-event-copy">
                        <span>{event.format}</span>
                        <h3>{event.title}</h3>
                        <p>{event.summary}</p>
                      </div>
                      <span className="club-event-place"><MapPin size={14} aria-hidden="true" /> {event.place}</span>
                    </li>
                  ))}
                </ol>
                {club.events.length === 0 && (
                  <div className="club-tab-empty">
                    <CalendarDays size={22} aria-hidden="true" />
                    <div><h3>{t("club.eventsEmptyTitle")}</h3><p>{t("club.eventsEmptyBody")}</p></div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "members" && (
              <div className="club-members-section">
                <div className="club-panel-heading">
                  <div><span className="club-panel-kicker">{t("club.membersKicker")}</span><h2>{t("club.membersTitle")}</h2></div>
                  <p><UsersRound size={15} aria-hidden="true" /> {t("club.membersPrivacy")}</p>
                </div>
                <ul className="club-member-grid">
                  {club.members.map((member) => (
                    <li key={member.id} className="club-member-card">
                      <span className="club-member-avatar" aria-hidden="true">{member.initials}</span>
                      <div><h3>{member.role}</h3><p>{member.focus}</p></div>
                    </li>
                  ))}
                </ul>
                {club.members.length === 0 && (
                  <div className="club-tab-empty">
                    <UsersRound size={22} aria-hidden="true" />
                    <div><h3>{t("club.membersEmptyTitle")}</h3><p>{t("club.membersEmptyBody")}</p></div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "history" && (
              <div className="club-history-section">
                <div className="club-panel-heading">
                  <div><span className="club-panel-kicker">{t("club.historyKicker")}</span><h2>{t("club.historyTitle")}</h2></div>
                  <p>{t("club.historyBody")}</p>
                </div>
                <ol className="club-history-list">
                  {club.history.map((milestone) => (
                    <li key={`${milestone.year}-${milestone.title}`}>
                      <time dateTime={milestone.year}>{milestone.year}</time>
                      <span className="club-history-dot" aria-hidden="true" />
                      <div><h3>{milestone.title}</h3><p>{milestone.description}</p></div>
                    </li>
                  ))}
                </ol>
                {club.history.length === 0 && (
                  <div className="club-tab-empty">
                    <Clock3 size={22} aria-hidden="true" />
                    <div><h3>{t("club.historyEmptyTitle")}</h3><p>{t("club.historyEmptyBody")}</p></div>
                  </div>
                )}
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </section>
  );
}
