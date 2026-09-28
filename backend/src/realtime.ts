import { randomBytes } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { conversationParticipants } from "./db/messaging.js";

type Ticket={userId:string;expiresAt:number};
const tickets=new Map<string,Ticket>();
let io:Server|null=null;

export function issueRealtimeTicket(userId:string){
  const ticket=randomBytes(32).toString("base64url");
  tickets.set(ticket,{userId,expiresAt:Date.now()+60_000});
  return {ticket,expiresIn:60};
}

export function attachRealtime(server:HttpServer){
  io=new Server(server,{path:"/socket.io",cors:{origin:env.ALLOWED_ORIGINS,methods:["GET","POST"],credentials:false},maxHttpBufferSize:32_000});
  io.use((socket,next)=>{const value=typeof socket.handshake.auth.ticket==="string"?socket.handshake.auth.ticket:"";const entry=tickets.get(value);tickets.delete(value);if(!entry||entry.expiresAt<Date.now())return next(new Error("AUTH_REQUIRED"));socket.data.userId=entry.userId;next();});
  io.on("connection",(socket)=>{
    socket.join(`user:${socket.data.userId}`);
    socket.on("conversation:join",async(value)=>{if(typeof value!=="string")return;const participants=await conversationParticipants(value);if(participants.includes(socket.data.userId))socket.join(`conversation:${value}`);});
    socket.on("typing",async(payload)=>{if(!payload||typeof payload.conversationId!=="string"||typeof payload.active!=="boolean")return;const participants=await conversationParticipants(payload.conversationId);if(participants.includes(socket.data.userId))socket.to(`conversation:${payload.conversationId}`).emit("typing",{conversationId:payload.conversationId,userId:socket.data.userId,active:payload.active});});
  });
  const cleanup=setInterval(()=>{const time=Date.now();for(const [key,value] of tickets)if(value.expiresAt<time)tickets.delete(key);},60_000);cleanup.unref();
}

export async function publishRealtime(conversationId:string,event:string,payload:unknown){
  if(!io)return;
  io.to(`conversation:${conversationId}`).emit(event,payload);
  for(const userId of await conversationParticipants(conversationId))io.to(`user:${userId}`).emit(event,payload);
}

/** Yalnız bir istifadəçiyə (bütün açıq tablarına) hadisə göndərir. */
export function publishToUser(userId:string,event:string,payload:unknown){
  io?.to(`user:${userId}`).emit(event,payload);
}

export async function closeRealtime(){await io?.close();io=null;}
