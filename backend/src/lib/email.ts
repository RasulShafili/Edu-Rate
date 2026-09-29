import { env } from "../config/env.js";

/** Poçt açarı olmayan inkişaf/test mühitində göndərilən son məktublar (testlər kodu buradan oxuyur). */
export const devOutbox:Array<{to:string;subject:string;html:string}>=[];

export async function sendAccountEmail(input:{to:string;subject:string;html:string}){
  if(!env.BREVO_API_KEY&&!env.RESEND_API_KEY){
    if(env.NODE_ENV==="production")throw new EmailDeliveryError("E-poçt xidməti aktiv deyil. Render-də BREVO_API_KEY və ya RESEND_API_KEY əlavə edilməlidir.");
    console.info(`[email disabled] ${input.subject} -> ${input.to}`);
    devOutbox.push(input);
    if(devOutbox.length>50)devOutbox.shift();
    return;
  }
  if(env.BREVO_API_KEY){
    const sender=parseSender(env.EMAIL_FROM);
    const response=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":env.BREVO_API_KEY,Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({sender,to:[{email:input.to}],subject:input.subject,htmlContent:input.html}),signal:AbortSignal.timeout(10_000)});
    if(!response.ok){const detail=await response.text().catch(()=>"");console.error("Brevo delivery failed",response.status,detail.slice(0,500));throw new EmailDeliveryError(response.status===400||response.status===401?"Brevo göndərən ünvanı və ya API açarı qəbul etmədi. Render dəyişənlərini yoxlayın.":"E-poçt xidməti məktubu qəbul etmədi. Bir qədər sonra yenidən yoxlayın.");}
    return;
  }
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({from:env.EMAIL_FROM,to:[input.to],subject:input.subject,html:input.html}),signal:AbortSignal.timeout(10_000)});
  if(!response.ok){const detail=await response.text().catch(()=>"");console.error("Resend delivery failed",response.status,detail.slice(0,500));throw new EmailDeliveryError(response.status===403?"Göndərən domen Resend-də təsdiqlənməyib. EMAIL_FROM ünvanını yoxlayın.":"E-poçt xidməti məktubu qəbul etmədi. Bir qədər sonra yenidən yoxlayın.");}
}

export class EmailDeliveryError extends Error{}

function parseSender(value:string):{name:string;email:string}{
  const named=value.match(/^\s*(.*?)\s*<([^<>\s]+@[^<>\s]+)>\s*$/);
  if(named)return{name:named[1]?.trim()||"EduRate",email:named[2]!};
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))return{name:"EduRate",email:value.trim()};
  throw new EmailDeliveryError("EMAIL_FROM düzgün deyil. Məsələn: EduRate <ad@gmail.com>");
}

export function accountActionUrl(path:string,token:string){const url=new URL(path,env.PUBLIC_APP_URL);url.searchParams.set("token",token);return url.toString();}
