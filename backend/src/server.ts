import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import {prisma} from "./db";
import routes from "./routes";

const app=express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({origin:(process.env.CORS_ORIGIN||"").split(",").filter(Boolean)}));
app.use(express.json({limit:"100kb"}));
app.use(rateLimit({windowMs:60_000,limit:100,standardHeaders:true,legacyHeaders:false}));
app.get("/health",(_req,res)=>res.json({status:"ok",service:"My Home Warranty API"}));
app.get("/v1/site-status",async(_req,res)=>{try{const c=await prisma.siteControl.findUnique({where:{id:"main"}});res.setHeader("Cache-Control","no-store");res.json({visibility:c?.visibility||"PUBLIC",maintenanceMode:c?.maintenanceMode||false,notice:c?.notice||"The website is temporarily unavailable. Please try again later."});}catch{res.status(503).json({error:"Site status unavailable"});}});
app.use("/v1",async(req,res,next)=>{if(req.path.startsWith("/auth/")||req.path==="/admin/site-control"||req.path.startsWith("/admin/site-control/"))return next();try{const c=await prisma.siteControl.findUnique({where:{id:"main"}});if(c&&(c.visibility==="PRIVATE"||c.maintenanceMode))return res.status(503).json({error:c.notice||"Service temporarily unavailable"});next();}catch{res.status(503).json({error:"Service temporarily unavailable"});}},routes);
app.use((_req,res)=>res.status(404).json({error:"Endpoint not found"}));
export default app;

if(!process.env.VERCEL){
  const port=Number(process.env.PORT||4000);
  app.listen(port,()=>console.log(`My Home Warranty API listening on ${port}`));
}