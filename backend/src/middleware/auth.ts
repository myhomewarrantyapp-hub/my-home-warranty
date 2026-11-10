import {Request,Response,NextFunction} from "express";
import jwt from "jsonwebtoken";
import {prisma} from "../db";
export type AuthRequest=Request & {userId?:string;role?:string};
export async function authenticate(req:AuthRequest,res:Response,next:NextFunction){
 try{
  const token=req.headers.authorization?.startsWith("Bearer ")?req.headers.authorization.slice(7):"";
  const secret=process.env.JWT_SECRET;
  if(!secret||secret.length<32)return res.status(503).json({error:"Server security configuration incomplete"});
  const payload=jwt.verify(token,secret) as {sub:string};
  const user=await prisma.user.findUnique({where:{id:payload.sub},select:{id:true,role:true,isActive:true}});
  if(!user||!user.isActive)return res.status(401).json({error:"Account unavailable"});
  req.userId=user.id;req.role=user.role;next();
 }catch{return res.status(401).json({error:"Authentication required"});}
}
export function allowRoles(...roles:string[]){return(req:AuthRequest,res:Response,next:NextFunction)=>{
 if(!req.role||!roles.includes(req.role))return res.status(403).json({error:"Insufficient permission"});next();
};}