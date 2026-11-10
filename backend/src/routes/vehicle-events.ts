import {Router} from "express";
import {z} from "zod";
import {prisma} from "../db";
import {authenticate,AuthRequest} from "../middleware/auth";
const router=Router();
const eventSchema=z.object({
 vehicleId:z.string().min(1),
 eventType:z.string().min(1).max(60),
 eventDate:z.string().datetime(),
 odometer:z.number().int().nonnegative().optional(),
 cost:z.number().nonnegative().optional(),
 notes:z.string().max(1000).optional(),
 nextDueDate:z.string().datetime().optional(),
 nextDueOdometer:z.number().int().nonnegative().optional()
});
router.get("/",authenticate,async(req:AuthRequest,res)=>{
 try{
  const events=await prisma.vehicleEvent.findMany({where:{ownerUserId:req.userId},include:{vehicle:{select:{id:true,nickname:true,makeModel:true}}},orderBy:{eventDate:"desc"},take:300});
  res.json({events});
 }catch{res.status(500).json({error:"Unable to load vehicle events"});}
});
router.post("/",authenticate,async(req:AuthRequest,res)=>{
 try{
  const v=eventSchema.parse(req.body);
  const vehicle=await prisma.vehicle.findFirst({where:{id:v.vehicleId,ownerUserId:req.userId},select:{id:true}});
  if(!vehicle)return res.status(404).json({error:"Vehicle not found"});
  const event=await prisma.vehicleEvent.create({data:{ownerUserId:req.userId!,vehicleId:v.vehicleId,eventType:v.eventType,eventDate:new Date(v.eventDate),odometer:v.odometer,cost:v.cost,notes:v.notes,nextDueDate:v.nextDueDate?new Date(v.nextDueDate):undefined,nextDueOdometer:v.nextDueOdometer}});
  res.status(201).json({event});
 }catch(e){res.status(400).json({error:e instanceof Error?e.message:"Invalid vehicle event"});}
});
export default router;
