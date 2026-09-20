"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Clock3, ImagePlus, Plus, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Club } from "../data/clubs";
import { uploadSecureImage } from "../lib/media-upload";
import { useAuth } from "./AuthProvider";
import { useT } from "../i18n/LanguageProvider";
import { ClubCard } from "./ClubCard";

type ClubsExperienceProps = {
  clubs: readonly Club[];
  failed?:boolean;
  /** İstifadəçinin üzvü olduğu, amma hələ təsdiqlənməmiş klublar. */
  pendingClubs?: readonly Club[];
};

export function ClubsExperience({ clubs, failed=false, pendingClubs=[] }: ClubsExperienceProps) {
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const t = useT();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [createDraft,setCreateDraft]=useState({name:"",category:"",tagline:"",about:"",meetingDay:"",meetingTime:"",meetingPlace:""});
  const [coverFile,setCoverFile]=useState<File|null>(null);
  const [coverPreview,setCoverPreview]=useState("");
  const coverPreviewRef=useRef("");
  const coverInputRef=useRef<HTMLInputElement>(null);
  const canCreate = Boolean(user?.accessRole && ["teacher", "mentor", "assistant_admin", "admin", "owner_admin"].includes(user.accessRole));

  useEffect(()=>()=>{if(coverPreviewRef.current)URL.revokeObjectURL(coverPreviewRef.current);},[]);

  function selectCover(file?:File){
    setError("");
    if(coverPreviewRef.current)URL.revokeObjectURL(coverPreviewRef.current);
    coverPreviewRef.current="";
    setCoverFile(null);
    setCoverPreview("");
    if(!file&&coverInputRef.current)coverInputRef.current.value="";
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){setError(t("clubs.imageType"));return;}
    if(file.size>5*1024*1024){setError(t("clubs.imageSize"));return;}
    coverPreviewRef.current=URL.createObjectURL(file);
    setCoverFile(file);
    setCoverPreview(coverPreviewRef.current);
  }

  async function createClub(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    const form = event.currentTarget;
    const formData = new FormData(form);
    try {
      const response = await fetch("/api/clubs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(formData.get("name") ?? "").trim(),
          category: String(formData.get("category") ?? "").trim(),
          tagline: String(formData.get("tagline") ?? "").trim(),
          about: String(formData.get("about") ?? "").split(/\r?\n/).map((value)=>value.trim()).filter(Boolean),
          meeting: {
            cadence: "Həftəlik",
            day: String(formData.get("meetingDay") ?? "").trim(),
            time: String(formData.get("meetingTime") ?? "").trim(),
            place: String(formData.get("meetingPlace") ?? "").trim(),
          },
        }),
      });
      const payload = await response.json().catch(() => null) as { data?: { id?: string }; error?: { message?: string } } | null;
      if (!response.ok) throw new Error(payload?.error?.message || t("clubs.createFailed"));
      let imageWarning="";
      if(coverFile&&payload?.data?.id){
        try{await uploadSecureImage(coverFile,"club",payload.data.id);}catch(uploadError){imageWarning=uploadError instanceof Error?uploadError.message:"Şəkil yüklənmədi.";}
      }
      form.reset();
      setCreateDraft({name:"",category:"",tagline:"",about:"",meetingDay:"",meetingTime:"",meetingPlace:""});
      selectCover();
      setSuccess(imageWarning?t("clubs.createdNoImage",{reason:imageWarning}):t("clubs.created"));
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : t("clubs.createFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="clubs-experience">
      <section className="clubs-hero" aria-labelledby="clubs-directory-title">
        <motion.div
          className="clubs-hero-copy"
          initial={reducedMotion ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            reducedMotion
              ? { duration: 0 }
              : { duration: 0.72, ease: [0.22, 1, 0.36, 1] }
          }
        >
          <span className="clubs-hero-eyebrow">
            <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" />
            {t("clubs.eyebrow")}
          </span>
          <h1 id="clubs-directory-title" className="module-page-title">
            {t("clubs.title")}
          </h1>
        </motion.div>
      </section>

      {pendingClubs.length ? (
        <section className="clubs-pending" aria-labelledby="clubs-pending-title">
          <header>
            <h2 id="clubs-pending-title"><Clock3 size={16} aria-hidden="true" /> {t("clubs.pendingTitle")}</h2>
            <p>{t("clubs.pendingBody")}</p>
          </header>
          <ul>
            {pendingClubs.map((club) => (
              <li key={club.slug}>
                <span className="clubs-pending__mark" aria-hidden="true">{club.visualMark}</span>
                <div>
                  <strong>{club.name}</strong>
                  <small>{t(`clubCategory.${club.category}`)}{club.status ? ` · ${t(`clubStatus.${club.status}`)}` : ""}</small>
                </div>
                <Link href={`/clubs/${club.slug}`}>{t("clubs.pendingOpen")}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="clubs-directory" aria-labelledby="clubs-list-title">
        <header className="clubs-section-heading">
          <div>
            <span>{t("clubs.sectionEyebrow")}</span>
            <h2 id="clubs-list-title">{t("clubs.catalog")}</h2>
          </div>
          {canCreate ? (
            <button type="button" className="club-create-trigger" onClick={() => { setError(""); setSuccess(""); setCreateOpen(true); }}>
              <Plus size={18} aria-hidden="true" />
              {t("clubs.create")}
            </button>
          ) : null}
        </header>

        {failed ? <div className="clubs-catalog-state" role="alert"><strong>{t("clubs.loadFailedTitle")}</strong><p>{t("clubs.loadFailedBody")}</p></div>
        : clubs.length===0 ? <div className="clubs-catalog-state"><strong>{t("clubs.emptyTitle")}</strong><p>{t("clubs.emptyBody")}</p></div>
        : <div className="clubs-directory-grid">
          {clubs.map((club, index) => (
            <ClubCard key={club.slug} club={club} index={index} />
          ))}
        </div>}
      </section>

      <AnimatePresence>
        {createOpen ? (
          <motion.div className="club-create-backdrop" role="presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}>
            <motion.section
              className="club-create-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="club-create-title"
              initial={reducedMotion ? false : { opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
            >
              <header>
                <div><small>{t("clubs.dialogEyebrow")}</small><h2 id="club-create-title">{t("clubs.create")}</h2></div>
                <button type="button" onClick={() => setCreateOpen(false)} aria-label={t("clubs.dialogClose")}><X size={19} /></button>
              </header>
              <p className="club-create-intro">{t("clubs.dialogIntro")}</p>
              <div className={`club-create-preview${coverPreview?" has-cover":""}`} aria-label={t("clubs.previewLabel")}><div style={coverPreview?{backgroundImage:`linear-gradient(135deg,rgba(8,37,31,.12),rgba(8,37,31,.62)),url("${coverPreview}")`}:undefined}><span>{coverPreview?t("clubs.coverSelected"):t("clubs.coverEmpty")}</span></div><small>{createDraft.category?t(`clubCategory.${createDraft.category}`):t("clubs.previewCategory")}</small><h3>{createDraft.name||t("clubs.previewName")}</h3><p>{createDraft.tagline||createDraft.about||t("clubs.previewAbout")}</p></div>
              <form onSubmit={createClub} className="club-create-form">
                <label className="is-wide club-create-cover-picker"><span>{t("clubs.cover")}</span><span className="club-create-cover-actions"><span className="club-create-cover-action"><ImagePlus size={17}/>{coverPreview?t("clubs.coverChange"):t("clubs.coverPick")}<input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event)=>selectCover(event.target.files?.[0])}/></span>{coverPreview?<button type="button" className="club-create-cover-remove" onClick={()=>selectCover()}><Trash2 size={16}/>{t("clubs.coverRemove")}</button>:null}</span><small>{t("clubs.coverHint")}</small></label>
                <label><span>{t("clubs.fieldName")}</span><input name="name" value={createDraft.name} onChange={(e)=>setCreateDraft({...createDraft,name:e.target.value})} minLength={3} maxLength={100} required autoFocus placeholder={t("clubs.fieldNamePlaceholder")} /></label>
                <label><span>{t("clubs.fieldCategory")}</span><select name="category" required value={createDraft.category} onChange={(e)=>setCreateDraft({...createDraft,category:e.target.value})}><option value="" disabled>{t("clubs.fieldCategoryPick")}</option><option>Texnologiya</option><option>Akademik</option><option>Yaradıcılıq</option><option>Sosial təsir</option><option>Mədəniyyət</option><option>İdman</option></select></label>
                <label className="is-wide"><span>{t("clubs.fieldTagline")}</span><input name="tagline" value={createDraft.tagline} onChange={(e)=>setCreateDraft({...createDraft,tagline:e.target.value})} minLength={5} maxLength={220} required placeholder={t("clubs.fieldTaglinePlaceholder")} /></label>
                <label className="is-wide"><span>{t("clubs.fieldAbout")}</span><textarea name="about" value={createDraft.about} onChange={(e)=>setCreateDraft({...createDraft,about:e.target.value})} minLength={10} maxLength={3000} rows={4} required placeholder={t("clubs.fieldAboutPlaceholder")} /></label>
                <label><span>{t("clubs.fieldMeetingDay")}</span><input name="meetingDay" value={createDraft.meetingDay} onChange={(e)=>setCreateDraft({...createDraft,meetingDay:e.target.value})} required placeholder={t("clubs.fieldMeetingDayPlaceholder")}/></label>
                <label><span>{t("clubs.fieldMeetingTime")}</span><input name="meetingTime" type="time" value={createDraft.meetingTime} onChange={(e)=>setCreateDraft({...createDraft,meetingTime:e.target.value})} required/></label>
                <label className="is-wide"><span>{t("clubs.fieldMeetingPlace")}</span><input name="meetingPlace" value={createDraft.meetingPlace} onChange={(e)=>setCreateDraft({...createDraft,meetingPlace:e.target.value})} minLength={2} maxLength={180} required placeholder={t("clubs.fieldMeetingPlacePlaceholder")}/></label>
                {error ? <p className="club-create-message is-error" role="alert">{error}</p> : null}
                {success ? <p className="club-create-message is-success" role="status">{success}</p> : null}
                <footer><button type="button" onClick={() => setCreateOpen(false)}>{t("clubs.cancel")}</button><button type="submit" disabled={pending}>{pending ? t("clubs.submitting") : t("clubs.submit")}</button></footer>
              </form>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

    </div>
  );
}
