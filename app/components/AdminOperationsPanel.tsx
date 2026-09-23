"use client";

import { Check, FileText, Flag, Inbox, Megaphone, Plus, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { uploadSecureImage } from "../lib/media-upload";
import { ImageDraftPicker } from "./ImageDraftPicker";

type Tab = "announcements" | "feed" | "support-tickets" | "reports";
type Item = {
  id: string;
  title?: string;
  topic?: string;
  summary?: string;
  message?: string;
  source?: string;
  name?: string;
  email?: string;
  reference?: string;
  reason?: string;
  details?: string;
  entityType?: string;
  status: string;
  imageUrl?: string;
};

const tabs: Array<{ id: Tab; label: string; icon: typeof Megaphone }> = [
  { id: "announcements", label: "Elanlar", icon: Megaphone },
  { id: "feed", label: "Lent moderasiyası", icon: FileText },
  { id: "support-tickets", label: "Dəstək", icon: Inbox },
  { id: "reports", label: "Şikayətlər", icon: Flag },
];

export function AdminOperationsPanel() {
  const [tab, setTab] = useState<Tab>("announcements");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", summary: "", source: "", category: "official" });
  const [announcementImage, setAnnouncementImage] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/${tab}`, { cache: "no-store" });
      const payload = await response.json() as { data?: Item[]; error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Məlumatlar yüklənmədi.");
      setItems(payload.data ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Məlumatlar yüklənmədi.");
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/${tab}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: Item[]; error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? "Məlumatlar yüklənmədi.");
        if (active) setItems(payload.data ?? []);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Məlumatlar yüklənmədi.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab]);

  async function changeStatus(item: Item, status: string) {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/${tab}/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(tab === "reports" ? { status, resolutionNote: status === "resolved" ? "Moderator məzmunu yoxladı və şikayəti həll etdi." : "Moderator şikayəti əsassız hesab etdi." } : { status }),
      });
      const payload = await response.json() as { data?: Item; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Status dəyişmədi.");
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...payload.data } : entry));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Status dəyişmədi.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(item: Item) {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/${tab}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json() as { error?: { message?: string } };
        throw new Error(payload.error?.message ?? "Qeyd silinmədi.");
      }
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Qeyd silinmədi.");
    } finally {
      setBusyId("");
    }
  }

  async function createAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyId("new");
    setError("");
    try {
      // Əvvəl başlama vaxtı "indidən 24 saat sonra" idi — bu gün dərc olunan elanın
      // kartında sabahın tarixi yazılırdı.
      const startsAt=new Date().toISOString();
      const expiresAt=new Date(Date.now()+30*24*60*60*1000).toISOString();
      const response=await fetch("/api/admin/announcements",{
        method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({
          ...draft,sourceInitials:draft.source.split(/\s+/).slice(0,2).map((part)=>part[0]?.toLocaleUpperCase("az")).join(""),
          tone:"lime",startsAt,expiresAt,priority:false,status:"draft",
        }),
      });
      const payload=await response.json() as {data?:Item;error?:{message?:string}};
      if(!response.ok||!payload.data)throw new Error(payload.error?.message??"Elan yaradılmadı.");
      let created=payload.data;
      if(announcementImage){
        try{const asset=await uploadSecureImage(announcementImage,"announcement",created.id);created={...created,imageUrl:asset.secureUrl};}
        catch(uploadError){setError(`Elan yaradıldı, lakin şəkil əlavə edilmədi: ${uploadError instanceof Error?uploadError.message:"yükləmə xətası"}`);}
      }
      setItems((current)=>[created,...current]);
      setDraft({title:"",summary:"",source:"",category:"official"});
      setAnnouncementImage(null);
      setCreating(false);
    } catch(caught) { setError(caught instanceof Error?caught.message:"Elan yaradılmadı."); }
    finally { setBusyId(""); }
  }

  return (
    <section className="admin-operations" aria-labelledby="admin-operations-title">
      <header className="admin-operations__header">
        <div>
          <span>Əməliyyat mərkəzi</span>
          <h2 id="admin-operations-title">Məzmun və müraciətlər</h2>
        </div>
        <div className="admin-operations__actions">
          {tab === "announcements" && <button type="button" onClick={()=>setCreating((value)=>!value)}><Plus size={16} /> Yeni elan</button>}
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="Siyahını yenilə"><RefreshCw size={16} className={loading ? "is-spinning" : ""} /></button>
        </div>
      </header>

      <div className="admin-operations__tabs" role="tablist" aria-label="İdarəetmə bölmələri">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => { setLoading(true); setError(""); setTab(id); }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "announcements" && creating && (
        <form className="admin-announcement-form" onSubmit={createAnnouncement}>
          <input value={draft.title} onChange={(event)=>setDraft((current)=>({...current,title:event.target.value}))} placeholder="Elanın başlığı" minLength={3} maxLength={180} required />
          <input value={draft.source} onChange={(event)=>setDraft((current)=>({...current,source:event.target.value}))} placeholder="Mənbə" minLength={2} maxLength={140} required />
          <select value={draft.category} onChange={(event)=>setDraft((current)=>({...current,category:event.target.value}))} aria-label="Elan kateqoriyası">
            <option value="official">Rəsmi</option><option value="faculties">Fakültələr</option><option value="clubs">Klublar</option><option value="scholarship">Təqaüd</option><option value="events">Tədbirlər</option>
          </select>
          <textarea value={draft.summary} onChange={(event)=>setDraft((current)=>({...current,summary:event.target.value}))} placeholder="Qısa və aydın elan mətni" minLength={10} maxLength={800} rows={3} required />
          <ImageDraftPicker file={announcementImage} onChange={setAnnouncementImage} label="Elan şəkli (istəyə bağlı)" compact/>
          <footer><button type="button" onClick={()=>setCreating(false)}>Ləğv et</button><button type="submit" disabled={busyId==="new"}>Qaralama yarat</button></footer>
        </form>
      )}

      {error && <p className="admin-operations__error" role="alert">{error}</p>}
      {loading ? (
        <div className="admin-operations__loading" aria-label="Məlumatlar yüklənir">{[1,2,3].map((key)=><i key={key} />)}</div>
      ) : items.length === 0 ? (
        <div className="admin-operations__empty"><Inbox size={22} /><strong>Hazırda açıq qeyd yoxdur.</strong></div>
      ) : (
        <div className="admin-operations__list">
          {items.map((item) => (
            <article key={item.id}>
              {item.imageUrl ? <span className="admin-operation-image" style={{backgroundImage:`url("${item.imageUrl}")`}} aria-hidden="true" /> : null}
              <div>
                <small>{item.reference ?? item.source ?? item.name ?? item.entityType ?? "EduRate"}</small>
                <h3>{item.title ?? item.topic ?? item.reason ?? "Müraciət"}</h3>
                <p>{item.summary ?? item.message ?? item.details ?? "Əlavə məlumat yoxdur."}</p>
                {tab === "support-tickets" && item.email ? (
                  <small className="admin-ticket-contact">{item.name} · <a href={`mailto:${item.email}?subject=${encodeURIComponent(item.reference ?? "EduRate")}`}>{item.email}</a></small>
                ) : null}
              </div>
              <footer>
                <span className={`is-${item.status}`}>{statusLabel(item.status)}</span>
                {tab === "announcements" && item.status !== "published" && (
                  <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "published")}><Check size={14} /> Yayımla</button>
                )}
                {tab === "announcements" && item.status === "published" && (
                  <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "draft")}><X size={14} /> Qaralamaya al</button>
                )}
                {tab === "feed" && item.status === "pending" && <>
                  <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "published")}><Check size={14} /> Təsdiqlə</button>
                  <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "rejected")}><X size={14} /> Rədd et</button>
                </>}
                {tab === "support-tickets" && item.status !== "resolved" && (
                  <button disabled={busyId === item.id} onClick={() => void changeStatus(item, item.status === "open" ? "in_progress" : "resolved")}>
                    <Check size={14} /> {item.status === "open" ? "İcraya al" : "Həll et"}
                  </button>
                )}
                {tab === "support-tickets" && item.status === "resolved" && (
                  <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "open")}>
                    <RotateCcw size={14} /> Yenidən aç
                  </button>
                )}
                {tab === "reports" && (item.status === "open" || item.status === "reviewing") && <>
                  <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "resolved")}><Check size={14} /> Həll et</button>
                  <button disabled={busyId === item.id} onClick={() => void changeStatus(item, "dismissed")}><X size={14} /> Əsassızdır</button>
                </>}
                {tab !== "support-tickets" && tab !== "reports" && <button className="is-danger" disabled={busyId === item.id} onClick={() => void remove(item)} aria-label="Qeydi sil"><Trash2 size={14} /></button>}
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function statusLabel(status: string) {
  return ({ pending: "Gözləyir", published: "Yayımlanıb", rejected: "Rədd edilib", draft: "Qaralama", open: "Açıq", reviewing: "Yoxlanılır", dismissed: "Əsassızdır", in_progress: "İcradadır", resolved: "Həll edilib" } as Record<string,string>)[status] ?? status;
}
