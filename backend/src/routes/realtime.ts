import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../middleware/authenticate.js";
import { issueRealtimeTicket } from "../realtime.js";
import { userOrIpKey } from "../lib/client-key.js";

export const realtimeRouter=Router();
// Əvvəl limit `authenticate`-dən ƏVVƏL və IP üzrə idi: BFF arxasında dəqiqədə
// 10 bilet bütün sayt üçün ortaq idi və 11-ci istifadəçinin söhbəti qoşulmurdu.
realtimeRouter.post("/ticket",authenticate,rateLimit({windowMs:60_000,limit:10,keyGenerator:userOrIpKey,standardHeaders:true,legacyHeaders:false}),(request,response)=>{
  response.status(201).json({data:issueRealtimeTicket(request.auth!.userId)});
});
