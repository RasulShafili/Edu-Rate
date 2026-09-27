import { randomUUID, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import { z } from "zod";
import { env } from "../config/env.js";
import { getMedia, removeMedia, saveMedia, type MediaKind } from "../db/media.js";
import { findClub, isClubLeader } from "../db/platform.js";
import { findEventById } from "../db/business.js";
import { findAnnouncementById } from "../db/network.js";
import { ApiError } from "../lib/api-error.js";
import { authenticate } from "../middleware/authenticate.js";
import { userOrIpKey } from "../lib/client-key.js";

export const mediaRouter=Router();
mediaRouter.use(authenticate);
// Limit yalnız Cloudinary-yə gedən yazma əməliyyatlarındadır. Əvvəl router-in
// hamısına tətbiq olunurdu: hər səhifə açılışı `GET /avatar/me` çağırır və 20
// səhifədən sonra profil şəkli 429 ilə itirdi (BFF arxasında — bütün sayt üçün).
const writeLimiter=rateLimit({windowMs:15*60_000,limit:20,keyGenerator:userOrIpKey,standardHeaders:true,legacyHeaders:false});
const kindSchema=z.enum(["avatar","club","announcement","event"]);
type CloudinarySignatureAlgorithm="sha1"|"sha256";
const signCloudinaryRequest=cloudinary.utils.api_sign_request as unknown as (params:Record<string,string|number>,secret:string,algorithm:CloudinarySignatureAlgorithm,version:number)=>string;
const signSchema=z.object({kind:kindSchema,ownerId:z.string().trim().min(1).max(120).optional()}).strict();
const confirmSchema=z.object({kind:kindSchema,ownerId:z.string().trim().min(1).max(120).optional(),publicId:z.string().min(10).max(300),version:z.coerce.number().int().positive(),signature:z.string().regex(/^[a-f0-9]{40,64}$/i)}).strict();
const configured=Boolean(env.CLOUDINARY_CLOUD_NAME&&env.CLOUDINARY_API_KEY&&env.CLOUDINARY_API_SECRET&&env.CLOUDINARY_UPLOAD_PRESET);
if(configured)cloudinary.config({cloud_name:env.CLOUDINARY_CLOUD_NAME,api_key:env.CLOUDINARY_API_KEY,api_secret:env.CLOUDINARY_API_SECRET,secure:true,signature_algorithm:"sha256"});

mediaRouter.get("/status",(_request,response)=>response.json({data:{enabled:configured,formats:["jpg","jpeg","png","webp"],avatarMaxBytes:2*1024*1024,coverMaxBytes:5*1024*1024}}));
mediaRouter.get("/avatar/me",async(request,response)=>response.json({data:await getMedia("avatar",request.auth!.userId)}));

mediaRouter.post("/sign",writeLimiter,async(request,response)=>{
  const input=signSchema.parse(request.body);const ownerId=await resolveWriteOwner(input.kind,input.ownerId,request.auth!);assertConfigured();
  const timestamp=Math.floor(Date.now()/1000);const publicId=`edurate/${input.kind}/${ownerId}/${randomUUID()}`;
  const limits=policy(input.kind);const params={timestamp,public_id:publicId,overwrite:"false",allowed_formats:"jpg,jpeg,png,webp",transformation:limits.transformation,upload_preset:env.CLOUDINARY_UPLOAD_PRESET!};
  const signature=cloudinary.utils.api_sign_request(params,env.CLOUDINARY_API_SECRET!);
  response.status(201).json({data:{cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,uploadUrl:`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME!)}/image/upload`,timestamp,publicId,signature,allowedFormats:"jpg,jpeg,png,webp",transformation:limits.transformation,uploadPreset:env.CLOUDINARY_UPLOAD_PRESET,maxBytes:limits.maxBytes}});
});

mediaRouter.post("/confirm",writeLimiter,async(request,response)=>{
  const input=confirmSchema.parse(request.body);const ownerId=await resolveWriteOwner(input.kind,input.ownerId,request.auth!);assertConfigured();const prefix=`edurate/${input.kind}/${ownerId}/`;
  if(!input.publicId.startsWith(prefix))throw new ApiError(403,"MEDIA_OWNER_MISMATCH","Şəkil bu hesaba və ya qeydə aid deyil.");
  if(!verifyCloudinaryResponseSignature(input.publicId,input.version,input.signature))throw new ApiError(422,"INVALID_MEDIA_SIGNATURE","Şəkil cavabının imzası yanlışdır.");
  const resource=await cloudinary.api.resource(input.publicId,{resource_type:"image"});const limits=policy(input.kind);
  const format=String(resource.format??"").toLowerCase();const bytes=Number(resource.bytes);const width=Number(resource.width);const height=Number(resource.height);
  if(!["jpg","jpeg","png","webp"].includes(format)||!Number.isFinite(bytes)||bytes<=0||bytes>limits.maxBytes||width<=0||height<=0||width>limits.maxDimension||height>limits.maxDimension)throw new ApiError(422,"UNSAFE_MEDIA","Şəkil təhlükəsizlik ölçülərinə uyğun deyil.");
  const {asset,replacedPublicId}=await saveMedia({kind:input.kind,ownerId,publicId:input.publicId,secureUrl:String(resource.secure_url),format,bytes,width,height,createdBy:request.auth!.userId});
  if(replacedPublicId&&replacedPublicId!==asset.publicId)void cloudinary.uploader.destroy(replacedPublicId,{resource_type:"image",invalidate:true}).catch(()=>undefined);
  response.status(201).json({data:asset});
});

mediaRouter.delete("/:kind/:ownerId",writeLimiter,async(request,response)=>{const kind=kindSchema.parse(request.params.kind);const requested=z.string().min(1).max(120).parse(request.params.ownerId);const ownerId=await resolveDeleteOwner(kind,requested,request.auth!);assertConfigured();const removed=await removeMedia(kind,ownerId);if(!removed)throw new ApiError(404,"MEDIA_NOT_FOUND","Silinə bilən şəkil tapılmadı.");await cloudinary.uploader.destroy(removed.publicId,{resource_type:"image",invalidate:true});response.status(204).send();});

async function resolveWriteOwner(kind:MediaKind,requested:string|undefined,auth:{userId:string;role:string}){if(kind==="avatar")return auth.userId;if(!requested)throw new ApiError(422,"OWNER_REQUIRED","Şəklin aid olduğu qeyd tələb olunur.");const ownerId=requested.replace(/[^a-zA-Z0-9_-]/g,"-");if(auth.role==="admin"||auth.role==="owner_admin"||auth.role==="assistant_admin")return ownerId;if(kind==="announcement"){const item=await findAnnouncementById(ownerId);if(item?.createdBy===auth.userId&&item.status==="draft")return ownerId;}if(kind==="event"){const event=await findEventById(ownerId);if(event?.createdBy===auth.userId&&event.adminStatus==="Qaralama")return ownerId;}if(kind==="club"){const club=await findClub(ownerId);if(club&&await isClubLeader(club.id,auth.userId))return club.id;}throw new ApiError(403,"MEDIA_OWNER_MISMATCH","Bu şəkli dəyişmək üçün qeydin sahibi və ya rəhbərlik olmalısan.");}
async function resolveDeleteOwner(kind:MediaKind,requested:string,auth:{userId:string;role:string}){if(kind!=="avatar")return resolveWriteOwner(kind,requested,auth);if(requested==="me"||requested===auth.userId)return auth.userId;if(auth.role==="admin"||auth.role==="owner_admin")return requested.replace(/[^a-zA-Z0-9_-]/g,"-");throw new ApiError(403,"MEDIA_OWNER_MISMATCH","Başqa istifadəçinin profil şəklini silmək icazən yoxdur.");}
function policy(kind:MediaKind){return kind==="avatar"?{maxBytes:2*1024*1024,maxDimension:512,transformation:"c_limit,w_512,h_512,q_auto:good,f_webp,fl_strip_profile"}:{maxBytes:5*1024*1024,maxDimension:1600,transformation:"c_limit,w_1600,h_1600,q_auto:good,f_webp,fl_strip_profile"};}
function verifyCloudinaryResponseSignature(publicId:string,version:number,signature:string){
  // Response signatures may use SHA-1 even when request signatures use SHA-256.
  const algorithm:CloudinarySignatureAlgorithm=signature.length===64?"sha256":"sha1";
  const expected=signCloudinaryRequest({public_id:publicId,version},env.CLOUDINARY_API_SECRET!,algorithm,1);
  const receivedBuffer=Buffer.from(signature,"hex");const expectedBuffer=Buffer.from(expected,"hex");
  return receivedBuffer.length===expectedBuffer.length&&timingSafeEqual(receivedBuffer,expectedBuffer);
}
function assertConfigured(){if(!configured)throw new ApiError(503,"MEDIA_NOT_CONFIGURED","Şəkil yaddaşı hələ konfiqurasiya edilməyib.");}
