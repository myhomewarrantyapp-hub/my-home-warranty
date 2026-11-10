import {Router} from "express";
import auth from "./auth";
import siteControl from "./site-control";
import records from "./records";
const router=Router();
router.use("/auth",auth);
router.use("/admin/site-control",siteControl);
router.use("/",records);
export default router;