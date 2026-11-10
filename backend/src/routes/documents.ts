import {Router} from "express";
import {prisma} from "../db";
import {authenticate,AuthRequest} from "../middleware/auth";
const router=Router();
router.get("/",authenticate,async(req:AuthRequest,res)=>{try{const documents=await prisma.document.findMany({where:{ownerUserId:req.userId},select:{id:true,originalName:true,mimeType:true,sizeBytes:true,scanStatus:true,createdAt:true},orderBy:{createdAt:"desc"},take:200});res.json({documents});}catch{res.status(500).json({error:"Unable to list documents"});}});
export default router;