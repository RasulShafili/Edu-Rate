"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n/LanguageProvider";

type ImageDraftPickerProps={file:File|null;onChange:(file:File|null)=>void;label?:string;compact?:boolean;inputName?:string};

export function ImageDraftPicker({file,onChange,label,compact=false,inputName}:ImageDraftPickerProps){
  const t=useT();
  const inputRef=useRef<HTMLInputElement>(null);const previewRef=useRef("");const [preview,setPreview]=useState("");const [error,setError]=useState("");
  useEffect(()=>()=>{if(previewRef.current)URL.revokeObjectURL(previewRef.current);},[]);
  function choose(next?:File){setError("");if(!next)return;if(!["image/jpeg","image/png","image/webp"].includes(next.type)){setError("image.typeError");if(inputRef.current)inputRef.current.value="";return;}if(next.size>5*1024*1024){setError("image.sizeError");if(inputRef.current)inputRef.current.value="";return;}if(previewRef.current)URL.revokeObjectURL(previewRef.current);previewRef.current=URL.createObjectURL(next);setPreview(previewRef.current);onChange(next);}
  function remove(){if(previewRef.current)URL.revokeObjectURL(previewRef.current);previewRef.current="";setPreview("");onChange(null);setError("");if(inputRef.current)inputRef.current.value="";}
  return <div className={`image-draft-picker${compact?" is-compact":""}`}><span className="image-draft-label">{label??t("image.label")}</span>{file&&preview?<span className="image-draft-preview" style={{backgroundImage:`linear-gradient(135deg,rgba(8,37,31,.06),rgba(8,37,31,.35)),url("${preview}")`}} role="img" aria-label={t("image.preview")}/>:null}<div className="image-draft-actions"><label><ImagePlus size={16} aria-hidden="true"/>{file?t("image.change"):t("image.choose")}<input ref={inputRef} name={inputName} type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={(event)=>choose(event.target.files?.[0])}/></label>{file?<button type="button" onClick={remove}><Trash2 size={15} aria-hidden="true"/>{t("image.remove")}</button>:null}</div><small>{t("image.hintShort",{size:5})}</small>{error?<p role="alert">{t(error,{size:5})}</p>:null}</div>;
}
