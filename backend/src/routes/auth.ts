import {Router} from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {z} from "zod";
import {prisma} from "../db";
const router=Router();
const input=z.object({name:z.string().min(2).max(80).optional(),email:z.string().email().max(254).optional(),mobile:z.string().regex(/^[6-9][0-9]{9}$/).optional(),password:z.string().min(12).max(128)});
function token(id:string){const secret=process.env.JWT_SECRET;if(!secret||secret.length<32)throw new Error("Server security configuration incomplete");return jwt.sign({},secret,{subject:id,expiresIn:"2h"});}
router.post("/register",async(req,res)=>{try{const v=input.parse(req.body);if(!v.email&&!v.mobile)return res.status(400).json({error:"Email or mobile required"});const passwordHash=await bcrypt.hash(v.password,12);const user=await prisma.user.create({data:{name:v.name||"User",email:v.email?.toLowerCase(),mobile:v.mobile,passwordHash},select:{id:true,name:true,email:true,mobile:true,role:true}});res.status(201).json({user,token:token(user.id)});}catch(e:any){if(e?.code==="P2002")return res.status(409).json({error:"Email or mobile already registered"});res.status(400).json({error:e instanceof Error?e.message:"Registration failed"});}});
router.post("/login",async(req,res)=>{try{const v=z.object({login:z.string().min(1),password:z.string().min(1)}).parse(req.body);const login=v.login.trim().toLowerCase();const user=await prisma.user.findFirst({where:{OR:[{email:login},{mobile:login}]}});if(!user||!user.isActive||!(await bcrypt.compare(v.password,user.passwordHash)))return res.status(401).json({error:"Invalid login or password"});res.json({user:{id:user.id,name:user.name,email:user.email,mobile:user.mobile,role:user.role},token:token(user.id)});}catch(e){res.status(400).json({error:e instanceof Error?e.message:"Login failed"});}});
export default router;