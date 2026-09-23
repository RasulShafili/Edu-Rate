"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Crown,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type {
  AdminClub,
  AdminClubCreateInput,
  AdminCollectionKind,
  AdminCollectionRecord,
  AdminEvent,
  AdminEventCreateInput,
  AdminUser,
  AdminUserCreateInput,
} from "../data/admin";
import { SecureImagePicker } from "./SecureImagePicker";
import { ImageDraftPicker } from "./ImageDraftPicker";

const subscribeNoop = () => () => {};

export type AdminRecordSheetMode = "create" | "edit" | "delete";

export type AdminRecordSubmission =
  | { kind: "users"; input: AdminUserCreateInput }
  | { kind: "clubs"; input: AdminClubCreateInput; coverFile?: File }
  | { kind: "events"; input: AdminEventCreateInput; imageFile?: File };

type AdminRecordFormSheetProps = {
  canAssignElevatedRoles: boolean;
  error: string | null;
  kind: AdminCollectionKind;
  mode: AdminRecordSheetMode;
  onClose: () => void;
  onDelete: () => Promise<void>;
  onSubmit: (submission: AdminRecordSubmission) => Promise<void>;
  open: boolean;
  pending: boolean;
  record: AdminCollectionRecord | null;
  userRoleOnly: boolean;
};

const labels: Record<AdminCollectionKind, { singular: string; plural: string }> = {
  users: { singular: "istifadəçi", plural: "İstifadəçilər" },
  clubs: { singular: "klub", plural: "Klublar" },
  events: { singular: "tədbir", plural: "Tədbirlər" },
};

export function AdminRecordFormSheet({
  canAssignElevatedRoles,
  error,
  kind,
  mode,
  onClose,
  onDelete,
  onSubmit,
  open,
  pending,
  record,
  userRoleOnly,
}: AdminRecordFormSheetProps) {
  const reducedMotion = useReducedMotion();
  // Serverdə və hidrasiya render-ində `false`, sonra `true` — portal yalnız
  // brauzerdə qurulur. `useEffect(() => setMounted(true))` eyni işi görürdü,
  // amma effekt içində setState lint qaydasını pozurdu.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const config = labels[kind];

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      if (mode === "delete") {
        panelRef.current?.querySelector<HTMLElement>("[data-delete-cancel]")?.focus();
      } else {
        firstFieldRef.current?.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [mode, open]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && !pending) {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await onSubmit(createSubmission(kind, formData));
  }

  const title =
    mode === "create"
      ? `Yeni ${config.singular} yarat`
      : mode === "edit"
        ? `${capitalize(config.singular)} məlumatını yenilə`
        : `${capitalize(config.singular)} qeydini sil?`;
  const description =
    mode === "delete"
      ? "Bu əməliyyat geri qaytarılmır. Təsdiqdən əvvəl qeydi bir daha yoxla."
      : "Yalnız vacib məlumatları daxil et. Dəyişikliklər REST API-yə təhlükəsiz göndəriləcək.";

  /**
   * Portal yalnız quraşdırmadan SONRA render olunur.
   *
   * Əvvəl `typeof document === "undefined"` yoxlanışı vardı: serverdə `null`,
   * brauzerin İLK (hidrasiya) render-ində isə portal qaytarırdı. Yəni server
   * HTML-i ilə müştərinin ilk render-i fərqlənirdi və React bütün bölməni
   * atıb yenidən qururdu — konsolda "Hydration failed" xətası bundan gəlirdi.
   * `mounted` bayrağı ilk render-i hər iki tərəfdə eyni (null) saxlayır.
   */
  if (!mounted) return null;

  // Modal document.body-yə portal olunur ki, heç bir transform/filter saxlayan
  // ata element onu viewport əvəzinə səhifə hündürlüyünə "uzada" bilməsin.
  // `kuds-shell` sarğısı (display:contents — heç nə çəkmir) işıqlı temanın
  // `.kuds-shell ...` seçiciləri bədənə portal olunandan sonra da işləməsini
  // təmin edir; onsuz vərəq köhnə tünd temaya qayıdırdı.
  return createPortal(
    <div className="kuds-shell" style={{ display: "contents" }}>
    <AnimatePresence>
      {open && (
        <motion.div
          className="admin-record-sheet-backdrop"
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.22 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            className={`admin-record-sheet${mode === "delete" ? " is-delete" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            aria-busy={pending}
            initial={reducedMotion ? false : { opacity: 0, x: 32, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0, x: 24, scale: 0.99 }}
            transition={{ duration: reducedMotion ? 0 : 0.34, ease: [0.22, 1, 0.36, 1] }}
            onKeyDown={handleKeyDown}
          >
            <header className="admin-record-sheet__header">
              <span className="admin-record-sheet__eyebrow">
                {mode === "create" ? <Plus size={15} /> : mode === "edit" ? <Pencil size={15} /> : <Trash2 size={15} />}
                {config.plural} / {mode === "create" ? "Yeni qeyd" : mode === "edit" ? "Redaktə" : "Silmə"}
              </span>
              <h2 id={titleId}>{title}</h2>
              <p id={descriptionId}>{description}</p>
              <button
                type="button"
                className="admin-record-sheet__close"
                onClick={onClose}
                disabled={pending}
                aria-label="Pəncərəni bağla"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {mode === "delete" ? (
              <DeleteConfirmation
                name={record?.name ?? "Bu qeyd"}
                error={error}
                pending={pending}
                onCancel={onClose}
                onDelete={onDelete}
              />
            ) : (
              <form className="admin-record-form" onSubmit={(event) => void handleSubmit(event)}>
                <div className="admin-record-form__fields">
                  {kind === "users" && (
                    <UserFields
                      record={record?.kind === "users" ? record : null}
                      firstFieldRef={firstFieldRef}
                      canAssignElevatedRoles={canAssignElevatedRoles}
                      roleOnly={userRoleOnly}
                    />
                  )}
                  {kind === "clubs" && (
                    <ClubFields
                      record={record?.kind === "clubs" ? record : null}
                      firstFieldRef={firstFieldRef}
                    />
                  )}
                  {kind === "events" && (
                    <EventFields
                      record={record?.kind === "events" ? record : null}
                      firstFieldRef={firstFieldRef}
                    />
                  )}
                </div>

                {mode === "edit" && kind === "clubs" && record?.kind === "clubs" ? (
                  <div className="admin-record-form__leaders">
                    <ClubLeadersManager clubId={record.id} />
                  </div>
                ) : null}

                {error && (
                  <p className="admin-record-form__error" role="alert">
                    <AlertTriangle size={16} aria-hidden="true" />
                    {error}
                  </p>
                )}

                <footer className="admin-record-form__footer">
                  <button type="button" onClick={onClose} disabled={pending}>
                    Ləğv et
                  </button>
                  <button type="submit" className="is-primary" disabled={pending}>
                    <Check size={16} aria-hidden="true" />
                    {pending ? "Yadda saxlanılır…" : mode === "create" ? "Qeyd yarat" : "Yadda saxla"}
                  </button>
                </footer>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>,
    document.body,
  );
}

type ClubLeaderMember = { id: string; name: string; role: "leader" | "member"; isCreator: boolean; avatarUrl?: string };

/**
 * Admin panelində klub liderlərinin idarəsi. Üzvləri gətirir və admin istənilən
 * üzvü lider təyin edə / liderlikdən çıxara bilər (klubu yaradan daimi liderdir).
 */
function ClubLeadersManager({ clubId }: { clubId: string }) {
  const [members, setMembers] = useState<ClubLeaderMember[] | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/clubs/${encodeURIComponent(clubId)}/members`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { data?: { members: ClubLeaderMember[] } } | null;
        if (response.ok && payload?.data) setMembers(payload.data.members);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [clubId]);

  async function change(member: ClubLeaderMember) {
    setBusy(member.id);
    setMessage("");
    try {
      const response = await fetch(`/api/clubs/${encodeURIComponent(clubId)}/leaders/${encodeURIComponent(member.id)}`, {
        method: member.role === "leader" ? "DELETE" : "PATCH",
      });
      const payload = (await response.json().catch(() => null)) as { data?: ClubLeaderMember; error?: { message?: string } } | null;
      if (!response.ok || !payload?.data) throw new Error(payload?.error?.message || "Liderlik dəyişdirilmədi.");
      const updated = payload.data;
      setMembers((current) => current?.map((item) => (item.id === member.id ? updated : item)) ?? current);
      setMessage(member.role === "leader" ? "Liderlik səlahiyyəti götürüldü." : "Yeni lider təyin edildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Liderlik dəyişdirilmədi.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="club-leader-manager">
      <header>
        <div>
          <small>KLUB RƏHBƏRLİYİ</small>
          <h3>Liderləri idarə et</h3>
          <p>Klubu yaradan şəxs daimi liderdir. Üzvlər arasından lider təyin et və ya liderliyi geri götür.</p>
        </div>
        <Crown size={22} />
      </header>
      <div>
        {members
          ? members.length
            ? members.map((member) => (
                <article key={member.id}>
                  <span className={`club-leader-avatar${member.avatarUrl ? " has-image" : ""}`} style={member.avatarUrl ? { backgroundImage: `url("${member.avatarUrl}")` } : undefined}>
                    {member.avatarUrl ? null : member.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("")}
                  </span>
                  <div>
                    <strong>{member.name}</strong>
                    <small>{member.isCreator ? "Klubun yaradıcısı · Lider" : member.role === "leader" ? "Lider" : "Üzv"}</small>
                  </div>
                  {!member.isCreator ? (
                    <button type="button" disabled={busy === member.id} onClick={() => void change(member)}>
                      {member.role === "leader" ? <><Trash2 size={14} />Liderlikdən çıxar</> : <><UserPlus size={14} />Lider et</>}
                    </button>
                  ) : (
                    <Crown size={17} aria-label="Lider" />
                  )}
                </article>
              ))
            : <p className="club-leader-empty">Hələ üzv yoxdur — üzvlər qoşulduqca burada görünəcək.</p>
          : <p className="club-leader-empty">Üzvlər yüklənir…</p>}
      </div>
      {message ? <p className="club-leader-empty" role="status">{message}</p> : null}
    </section>
  );
}

type FieldProps<TRecord> = {
  firstFieldRef: React.RefObject<HTMLInputElement | null>;
  record: TRecord | null;
};

function UserFields({
  firstFieldRef,
  record,
  canAssignElevatedRoles,
  roleOnly,
}: FieldProps<AdminUser> & { canAssignElevatedRoles: boolean; roleOnly: boolean }) {
  if (roleOnly) {
    return (
      <>
        <p className="admin-permission-note" role="note">
          Yalnız adi istifadəçi rolu dəyişdirilə bilər. Administrator rolları əsas administrator tərəfindən idarə olunur.
        </p>
        <Field label="Yeni rol" name="role" required>
          <select name="role" defaultValue={record?.role ?? "student"} autoFocus required>
            <option value="student">Tələbə</option>
            <option value="teacher">Müəllim</option>
            {record?.role === "mentor" ? <option value="mentor">Mentor (köhnə)</option> : null}
          </select>
        </Field>
      </>
    );
  }
  return (
    <>
      <Field label="Ad və soyad" name="name" required>
        <input ref={firstFieldRef} name="name" defaultValue={record?.name} minLength={3} maxLength={80} required />
      </Field>
      <Field label="E-poçt" name="email" required>
        <input name="email" type="email" defaultValue={record?.email} maxLength={120} autoComplete="email" required />
      </Field>
      <Field label="Rol" name="role" required>
        <select name="role" defaultValue={record?.role ?? "student"} required>
          <option value="student">Tələbə</option>
          <option value="teacher">Müəllim</option>
          {canAssignElevatedRoles && (
            <>
              <option value="assistant_admin">Admin köməkçisi</option>
              <option value="admin">Administrator</option>
            </>
          )}
          {record?.role === "mentor" ? <option value="mentor">Mentor (köhnə)</option> : null}
          {record?.role === "owner_admin" ? <option value="owner_admin">Platforma sahibi (köhnə)</option> : null}
          {!canAssignElevatedRoles && (record?.role === "admin" || record?.role === "assistant_admin") ? (
            <option value={record.role}>{record.role === "admin" ? "Administrator" : "Admin köməkçisi"} (cari)</option>
          ) : null}
        </select>
      </Field>
      <Field label="Universitet" name="university" required>
        <input name="university" defaultValue={record?.university} minLength={3} maxLength={120} required />
      </Field>
      <Field label="Fakültə" name="faculty" required>
        <input name="faculty" defaultValue={record?.faculty} minLength={2} maxLength={100} required />
      </Field>
      <Field label="Vəziyyət" name="status" required>
        <select name="status" defaultValue={record?.status ?? "Gözləmədə"} required>
          <option value="Aktiv">Aktiv</option>
          <option value="Gözləmədə">Gözləmədə</option>
          <option value="Məhdudlaşdırılıb">Məhdudlaşdırılıb</option>
        </select>
      </Field>
    </>
  );
}

function ClubFields({ firstFieldRef, record }: FieldProps<AdminClub>) {
  const [draft, setDraft] = useState({
    name: record?.name ?? "",
    category: record?.category ?? "",
    tagline: record?.tagline ?? "",
    description: record?.description ?? "",
    about: record?.about?.join("\n") ?? "",
    meetingDay: record?.meeting?.day ?? "",
    meetingTime: record?.meeting?.time ?? "",
    meetingPlace: record?.meeting?.place ?? "",
  });
  const [coverPreview, setCoverPreview] = useState(record?.coverUrl ?? "");
  const localPreviewRef = useRef("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
  }, []);

  function selectCover(file?: File) {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = file ? URL.createObjectURL(file) : "";
    setCoverPreview(localPreviewRef.current || record?.coverUrl || "");
    if (!file && coverInputRef.current) coverInputRef.current.value = "";
  }

  return (
    <>
      <div className={`admin-club-live-preview is-wide${coverPreview ? " has-cover" : ""}`} style={coverPreview ? { backgroundImage: `linear-gradient(135deg, rgba(8,37,31,.16), rgba(8,37,31,.76)), url("${coverPreview}")` } : undefined}>
        <span>{draft.category || "KATEQORİYA"}</span>
        <h3>{draft.name || "Klubun adı"}</h3>
        <p>{draft.tagline || draft.description || "Klubun qısa şüarı və məqsədi burada görünəcək."}</p>
      </div>
      <div className="admin-record-field is-wide">
        <span>Klubun örtük şəkli</span>
        {record ? (
          <SecureImagePicker kind="club" ownerId={record.id} currentUrl={record.coverUrl} compact onChange={(asset) => setCoverPreview(asset?.secureUrl ?? "")} />
        ) : (
          <div className="admin-club-file-picker">
            <div className="admin-club-file-actions">
              <label><span>{coverPreview ? "Şəkli dəyiş" : "Şəkil seç"}</span><input ref={coverInputRef} name="coverFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectCover(event.target.files?.[0])} /></label>
              {coverPreview ? <button type="button" onClick={() => selectCover()}><Trash2 size={14} /> Şəkli sil</button> : null}
            </div>
            <small>JPG, PNG və ya WebP · maksimum 5 MB</small>
          </div>
        )}
      </div>
      <Field label="Klubun adı" name="name" required>
        <input ref={firstFieldRef} name="name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} minLength={3} maxLength={100} required />
      </Field>
      <Field label="Kateqoriya" name="category" required>
        <select name="category" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} required>
          <option value="" disabled>Kateqoriya seç</option>
          <option>Texnologiya</option><option>Akademik</option><option>Yaradıcılıq</option><option>Sosial təsir</option><option>Mədəniyyət</option><option>İdman</option>
        </select>
      </Field>
      <Field label="Şüar" name="tagline" required>
        <input name="tagline" value={draft.tagline} onChange={(event) => setDraft({ ...draft, tagline: event.target.value })} minLength={5} maxLength={220} required />
      </Field>
      {record ? <Field label="Qısa təsvir" name="description" required>
        <textarea name="description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} minLength={10} maxLength={800} rows={3} required />
      </Field> : null}
      <Field label="Haqqında" name="about" hint="Hər abzası yeni sətirdən yaz" required>
        <textarea name="about" value={draft.about} onChange={(event) => setDraft({ ...draft, about: event.target.value })} minLength={10} maxLength={3000} rows={4} required />
      </Field>
      <Field label="Görüş günü" name="meetingDay" required><input name="meetingDay" value={draft.meetingDay} onChange={(event) => setDraft({ ...draft, meetingDay: event.target.value })} minLength={1} maxLength={80} required /></Field>
      <Field label="Görüş saatı" name="meetingTime" required><input name="meetingTime" value={draft.meetingTime} onChange={(event) => setDraft({ ...draft, meetingTime: event.target.value })} minLength={1} maxLength={40} required /></Field>
      <Field label="Görüş yeri" name="meetingPlace" required><input name="meetingPlace" value={draft.meetingPlace} onChange={(event) => setDraft({ ...draft, meetingPlace: event.target.value })} minLength={2} maxLength={180} required /></Field>
      {record ? <><input type="hidden" name="slug" value={record.slug} /><input type="hidden" name="coordinatorInitials" value={record.coordinatorInitials} /><input type="hidden" name="shortName" value={record.shortName} /><input type="hidden" name="tone" value={record.tone} /><input type="hidden" name="visualMark" value={record.visualMark ?? "club"} /><input type="hidden" name="meetingCadence" value={record.meeting?.cadence ?? "Həftəlik"} /><input type="hidden" name="focusTags" value={(record.focusTags ?? [record.category]).join(", ")} /></> : null}
      <Field label="Vəziyyət" name="status" required>
        <select name="status" defaultValue={record?.status ?? "Gözləmədə"} required>
          <option value="Aktiv">Aktiv</option>
          <option value="Gözləmədə">Gözləmədə</option>
          <option value="Məhdudlaşdırılıb">Məhdudlaşdırılıb</option>
        </select>
      </Field>
    </>
  );
}

function EventFields({ firstFieldRef, record }: FieldProps<AdminEvent>) {
  const [imageFile,setImageFile]=useState<File|null>(null);
  return (
    <>
      <div className="admin-record-field is-wide"><span>Tədbir şəkli</span>{record?<SecureImagePicker kind="event" ownerId={record.id} currentUrl={record.imageUrl} compact/>:<ImageDraftPicker file={imageFile} onChange={setImageFile} label="Tədbir şəkli (istəyə bağlı)" compact inputName="eventImageFile"/>}</div>
      <Field label="Tədbirin adı" name="name" required>
        <input ref={firstFieldRef} name="name" defaultValue={record?.name} minLength={3} maxLength={120} required />
      </Field>
      <Field label="Kateqoriya" name="category" required>
        <input name="category" defaultValue={record?.category} minLength={2} maxLength={60} required />
      </Field>
      <Field label="Təşkilatçı" name="organizer" required>
        <input name="organizer" defaultValue={record?.organizer} minLength={2} maxLength={100} required />
      </Field>
      <Field label="Başlama vaxtı" name="startAt" required>
        <input name="startAt" type="datetime-local" defaultValue={toLocalDateTime(record?.startAt)} required />
      </Field>
      <Field label="Tutum" name="capacity" required>
        <input name="capacity" type="number" defaultValue={record?.capacity ?? 40} min={1} max={5000} inputMode="numeric" required />
      </Field>
      <Field label="Məkan" name="place" required>
        <input name="place" defaultValue={record?.place} minLength={2} maxLength={100} required />
      </Field>
      <Field label="Vəziyyət" name="status" required>
        <select name="status" defaultValue={record?.status ?? "Qaralama"} required>
          <option value="Açıq">Açıq</option>
          <option value="Qaralama">Qaralama</option>
          <option value="Tamamlanıb">Tamamlanıb</option>
        </select>
      </Field>
    </>
  );
}

type FieldPropsBase = {
  children: React.ReactNode;
  hint?: string;
  label: string;
  name: string;
  required?: boolean;
};

function Field({ children, hint, label, name, required }: FieldPropsBase) {
  return (
    <label className="admin-record-field">
      <span>
        {label}
        {required && <i aria-hidden="true">*</i>}
      </span>
      {children}
      {hint && <small id={`${name}-hint`}>{hint}</small>}
    </label>
  );
}

type DeleteConfirmationProps = {
  error: string | null;
  name: string;
  onCancel: () => void;
  onDelete: () => Promise<void>;
  pending: boolean;
};

function DeleteConfirmation({ error, name, onCancel, onDelete, pending }: DeleteConfirmationProps) {
  return (
    <div className="admin-delete-confirmation">
      <div aria-hidden="true"><AlertTriangle size={22} /></div>
      <strong>{name}</strong>
      <p>Qeyd və onun idarəetmə məlumatları siyahıdan silinəcək.</p>
      {error && <p className="admin-record-form__error" role="alert">{error}</p>}
      <footer>
        <button type="button" data-delete-cancel onClick={onCancel} disabled={pending}>Geri qayıt</button>
        <button type="button" className="is-danger" onClick={() => void onDelete()} disabled={pending}>
          <Trash2 size={16} aria-hidden="true" />
          {pending ? "Silinir…" : "Bəli, sil"}
        </button>
      </footer>
    </div>
  );
}

function createSubmission(
  kind: AdminCollectionKind,
  formData: FormData,
): AdminRecordSubmission {
  if (kind === "users") {
    return {
      kind,
      input: {
        name: fieldValue(formData, "name"),
        email: fieldValue(formData, "email").toLocaleLowerCase("az"),
        role: fieldValue(formData, "role") as AdminUser["role"],
        university: fieldValue(formData, "university"),
        faculty: fieldValue(formData, "faculty"),
        status: fieldValue(formData, "status") as AdminUser["status"],
      },
    };
  }
  if (kind === "clubs") {
    const name = fieldValue(formData, "name");
    const category = fieldValue(formData, "category");
    const aboutText = fieldValue(formData, "about");
    const description = fieldValue(formData, "description") || aboutText.split(/\r?\n/).map((value)=>value.trim()).find(Boolean)?.slice(0, 500) || "Klub haqqında məlumat";
    const coordinatorInitials = fieldValue(formData, "coordinatorInitials") || createInitials(name) || "ER";
    const generatedSlug = normalizeClubSlug(name);
    return {
      kind,
      coverFile: formData.get("coverFile") instanceof File && (formData.get("coverFile") as File).size > 0
        ? formData.get("coverFile") as File
        : undefined,
      input: {
        name,
        slug: fieldValue(formData, "slug").toLocaleLowerCase("az") || generatedSlug,
        category,
        coordinatorInitials: coordinatorInitials.toLocaleUpperCase("az"),
        shortName: fieldValue(formData, "shortName") || name,
        tagline: fieldValue(formData, "tagline") || "Birlikdə öyrən, yarat və paylaş.",
        description,
        about: aboutText.split(/\r?\n/).map((value)=>value.trim()).filter(Boolean).length
          ? aboutText.split(/\r?\n/).map((value)=>value.trim()).filter(Boolean)
          : [description],
        tone: (fieldValue(formData, "tone") || "lime") as NonNullable<AdminClub["tone"]>,
        visualMark: fieldValue(formData, "visualMark") || coordinatorInitials,
        meeting: {
          cadence: fieldValue(formData, "meetingCadence") || "Cədvəl üzrə",
          day: fieldValue(formData, "meetingDay") || "Dəqiqləşdiriləcək",
          time: fieldValue(formData, "meetingTime") || "18:00",
          place: fieldValue(formData, "meetingPlace") || "Universitet kampusu",
        },
        focusTags: fieldValue(formData, "focusTags").split(",").map((value)=>value.trim()).filter(Boolean).length
          ? fieldValue(formData, "focusTags").split(",").map((value)=>value.trim()).filter(Boolean)
          : [category],
        status: (fieldValue(formData, "status") || "Gözləmədə") as AdminClub["status"],
      },
    };
  }
  const startAtValue = fieldValue(formData, "startAt");
  return {
    kind,
    input: {
      name: fieldValue(formData, "name"),
      category: fieldValue(formData, "category"),
      organizer: fieldValue(formData, "organizer"),
      startAt: new Date(startAtValue).toISOString(),
      capacity: Number.parseInt(fieldValue(formData, "capacity"), 10),
      place: fieldValue(formData, "place"),
      status: fieldValue(formData, "status") as AdminEvent["status"],
    },
    imageFile: formData.get("eventImageFile") instanceof File && (formData.get("eventImageFile") as File).size > 0 ? formData.get("eventImageFile") as File : undefined,
  };
}

function fieldValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function createInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? "").join("");
}

function normalizeClubSlug(name: string): string {
  const base = name
    .toLocaleLowerCase("az")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ə/g, "e").replace(/ı/g, "i").replace(/ş/g, "s")
    .replace(/ç/g, "c").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ğ/g, "g")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "klub";
  return `${base.slice(0, 70)}-${Date.now().toString(36).slice(-6)}`;
}

function toLocalDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("az") + value.slice(1);
}
