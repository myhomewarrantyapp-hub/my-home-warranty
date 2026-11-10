import {AuthRequest} from "../middleware/auth";
import {prisma} from "../db";
export async function audit(req:AuthRequest,action:string,type:string,id?:string){
 await prisma.auditEvent.create({data:{actorUserId:req.userId!,action,entityType:type,entityId:id,ipAddress:req.ip?.slice(0,64),userAgent:req.get("user-agent")?.slice(0,240)}});
}