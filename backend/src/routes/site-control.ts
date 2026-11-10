import {Router} from "express";
import {z} from "zod";
import {prisma} from "../db";
import {authenticate,allowRoles,AuthRequest} from "../middleware/auth";
import {audit} from "../services/audit";
const router=Router();
router.get("/",authenticate,allowRoles("SUPER_ADMIN"),async(_req,res)=>{const control=await prisma.siteControl.upsert({where:{id:"main"},create:{id:"main"},update:{}});res.json({control});});
router.patch("/",authenticate,allowRoles("SUPER_ADMIN"),async(req:AuthRequest,res)=>{try{const v=z.object({visibility:z.enum(["PUBLIC","PRIVATE"]),maintenanceMode:z.boolean(),notice:z.string().max(240)}).parse(req.body);const control=await prisma.siteControl.upsert({where:{id:"main"},create:{id:"main",...v},update:v});await audit(req,"SITE_CONTROL_UPDATE","SiteControl","main");res.json({control});}catch(e){res.status(400).json({error:e instanceof Error?e.message:"Invalid site control"});}});
export default router;