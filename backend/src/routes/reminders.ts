import {Router} from "express";
import {z} from "zod";
import {prisma} from "../db";
import {authenticate,AuthRequest} from "../middleware/auth";
const router=Router();

router.get("/",authenticate,async(req:AuthRequest,res)=>{
  try{
    const reminders=await prisma.reminder.findMany({
      where:{ownerUserId:req.userId},
      orderBy:{remindAt:"asc"},
      take:300
    });
    res.json({reminders});
  }catch{
    res.status(500).json({error:"Unable to load reminders"});
  }
});

router.post("/",authenticate,async(req:AuthRequest,res)=>{
  try{
    const v=z.object({
      title:z.string().min(1).max(140),
      description:z.string().max(1000).optional(),
      dueAt:z.string().datetime(),
      remindAt:z.string().datetime()
    }).parse(req.body);
    if(new Date(v.remindAt)>new Date(v.dueAt)){
      return res.status(400).json({error:"Reminder time must be on or before the due date"});
    }
    const reminder=await prisma.reminder.create({
      data:{
        ownerUserId:req.userId!,
        title:v.title,
        description:v.description,
        dueAt:new Date(v.dueAt),
        remindAt:new Date(v.remindAt)
      }
    });
    res.status(201).json({reminder});
  }catch(e){
    res.status(400).json({error:e instanceof Error?e.message:"Invalid reminder"});
  }
});

router.patch("/:id",authenticate,async(req:AuthRequest,res)=>{
  try{
    const v=z.object({status:z.enum(["PENDING","COMPLETED","CANCELLED"])}).parse(req.body);
    const result=await prisma.reminder.updateMany({
      where:{id:req.params.id,ownerUserId:req.userId},
      data:{status:v.status}
    });
    if(!result.count)return res.status(404).json({error:"Reminder not found"});
    const reminder=await prisma.reminder.findFirst({where:{id:req.params.id,ownerUserId:req.userId}});
    res.json({reminder});
  }catch(e){
    res.status(400).json({error:e instanceof Error?e.message:"Unable to update reminder"});
  }
});
export default router;
