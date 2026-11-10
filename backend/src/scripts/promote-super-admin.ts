import "dotenv/config";
import { prisma } from "../db";
async function main() {
 const email=process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
 const mobile=process.env.SUPER_ADMIN_MOBILE?.trim();
 if(!!email===!!mobile) throw new Error("Set exactly one of SUPER_ADMIN_EMAIL or SUPER_ADMIN_MOBILE.");
 const user=await prisma.user.findFirst({where:email?{email}:{mobile}});
 if(!user) throw new Error("Register the owner account first.");
 if(user.role==="SUPER_ADMIN"){console.log("Already SUPER_ADMIN.");return;}
 await prisma.user.update({where:{id:user.id},data:{role:"SUPER_ADMIN"}});
 console.log("Owner account promoted to SUPER_ADMIN.");
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Failed");process.exitCode=1;}).finally(async()=>prisma.$disconnect());