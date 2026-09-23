"use client";

import { Camera, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "../i18n/LanguageProvider";
import { uploadSecureImage, type MediaAsset, type MediaKind } from "../lib/media-upload";

type SecureImagePickerProps = {
  kind: MediaKind;
  ownerId?: string;
  currentUrl?: string | null;
  onChange?: (asset: MediaAsset | null) => void;
  compact?: boolean;
};

const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

/**
 * Mesaj açar kimi saxlanır. `uploadSecureImage` azərbaycanca xəta atır, ona görə
 * tip və ölçü burada əvvəlcədən yoxlanılır; qalan uğursuzluqlar ümumi mesajdır.
 */
export function SecureImagePicker({ kind, ownerId, currentUrl, onChange, compact = false }: SecureImagePickerProps) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ key: string; size?: number } | null>(null);
  const [urlOverride, setUrlOverride] = useState<string | null>(null);
  const url = urlOverride ?? currentUrl ?? "";
  const maxMegabytes = kind === "avatar" ? 2 : 5;

  async function choose(file?: File) {
    if (!file) return;
    setMessage(null);
    if (!allowedTypes.includes(file.type)) {
      setMessage({ key: "image.typeError" });
      if (input.current) input.current.value = "";
      return;
    }
    if (file.size > maxMegabytes * 1024 * 1024) {
      setMessage({ key: "image.sizeError", size: maxMegabytes });
      if (input.current) input.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const asset = await uploadSecureImage(file, kind, ownerId);
      setUrlOverride(asset.secureUrl);
      setMessage({ key: "image.uploaded" });
      onChange?.(asset);
    } catch {
      setMessage({ key: "image.uploadFailed" });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setMessage(null);
    try {
      const id = kind === "avatar" ? "me" : ownerId;
      if (!id) {
        setMessage({ key: "image.missingOwner" });
        return;
      }
      const response = await fetch(`/api/media/${kind}/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage({ key: response.status === 401 ? "admin.error.session" : "image.removeFailed" });
        return;
      }
      setUrlOverride("");
      setMessage({ key: "image.removed" });
      onChange?.(null);
    } catch {
      setMessage({ key: "image.removeFailed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`secure-image-picker${compact ? " is-compact" : ""}`}>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" hidden onChange={(event) => void choose(event.target.files?.[0])} />
      {url ? <span className="secure-image-preview" style={{ backgroundImage: `url("${url}")` }} role="img" aria-label={t("image.current")} /> : <span className="secure-image-placeholder"><Camera size={18} aria-hidden="true" /></span>}
      <div>
        <button type="button" disabled={busy} onClick={() => input.current?.click()}><UploadCloud size={14} aria-hidden="true" />{busy ? t("common.loading") : url ? t("image.change") : t("image.choose")}</button>
        {url ? <button type="button" className="is-danger" disabled={busy} onClick={() => void remove()}><Trash2 size={13} aria-hidden="true" />{t("common.delete")}</button> : null}
        <small>{t("image.hint", { size: maxMegabytes })}</small>
        {message ? <p role="status">{t(message.key, { size: message.size ?? maxMegabytes })}</p> : null}
      </div>
    </div>
  );
}
