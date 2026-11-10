import {Router} from "express";
import {z} from "zod";
import {prisma} from "../db";
import {authenticate,AuthRequest} from "../middleware/auth";
const router=Router();
const specs:any={
 assets:{model:"asset",list:"assets",create:z.object({title:z.string().min(1).max(120),category:z.string().min(1).max(80),warrantyEnd:z.string().datetime().optional(),notes:z.string().max(1000).optional()}),fields:["title","category","warrantyEnd","notes"]},
 vehicles:{model:"vehicle",list:"vehicles",create:z.object({nickname:z.string().min(1).max(80),makeModel:z.string().max(120).optional(),registrationLastFour:z.string().regex(/^[A-Za-z0-9]{4}$/).optional(),currentOdometer:z.number().int().nonnegative().optional()}),fields:["nickname","makeModel","registrationLastFour","currentOdometer"]},
 bills:{model:"bill",list:"bills",create:z.object({billType:z.string().min(1).max(40),provider:z.string().max(120).optional(),amount:z.number().positive(),dueDate:z.string().datetime()}),fields:["billType","provider","amount","dueDate"]},
 money:{model:"moneyEntry",list:"entries",create:z.object({direction:z.enum(["GIVEN","RECEIVED"]),personName:z.string().min(1).max(120),mobile:z.string().regex(/^[6-9][0-9]{9}$/).optional(),amount:z.number().positive(),entryDate:z.string().datetime(),dueDate:z.string().datetime().optional(),balance:z.number().nonnegative(),interestRate:z.number().min(0).max(100).optional(),notes:z.string().max(1000).optional()}),fields:["direction","personName","mobile","amount","entryDate","dueDate","balance","interestRate","notes"]},
 insurance:{model:"insurancePolicy",list:"policies",create:z.object({insurer:z.string().min(1).max(120),policyType:z.string().min(1).max(80),startDate:z.string().datetime().optional(),endDate:z.string().datetime().optional(),premiumAmount:z.number().positive().optional(),premiumDue:z.string().datetime().optional()}),fields:["insurer","policyType","startDate","endDate","premiumAmount","premiumDue"]},
 "payment-requests":{model:"paymentRequest",list:"requests",create:z.object({recipientName:z.string().min(1).max(120),recipientMobile:z.string().regex(/^[6-9][0-9]{9}$/).optional(),amount:z.number().positive(),purpose:z.string().max(300).optional()}),fields:["recipientName","recipientMobile","amount","purpose"]},
 "support/tickets":{model:"supportTicket",list:"tickets",create:z.object({subject:z.string().min(3).max(160),message:z.string().min(5).max(4000)}),fields:["subject","message"]}
};
for(const [path,s] of Object.entries(specs) as [string, any][]){
 router.get("/"+path,authenticate,async(req:AuthRequest,res)=>{try{const rows=await (prisma as any)[s.model].findMany({where:{ownerUserId:req.userId},orderBy:{createdAt:"desc"},take:200});res.json({[s.list]:rows});}catch{res.status(500).json({error:"Could not load records"});}});
 router.post("/"+path,authenticate,async(req:AuthRequest,res)=>{try{const v=s.create.parse(req.body);const data:any={ownerUserId:req.userId};for(const k of s.fields)if(v[k]!==undefined)data[k]=["warrantyEnd","dueDate","entryDate","startDate","endDate","premiumDue"].includes(k)?new Date(v[k]):v[k];const row=await (prisma as any)[s.model].create({data});res.status(201).json({record:row});}catch(e){res.status(400).json({error:e instanceof Error?e.message:"Invalid record"});}});
}
export default router;