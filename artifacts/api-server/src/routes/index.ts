import { Router, type IRouter } from "express";
import healthRouter from "./health";
import musicvizionRouter from "./musicvizion";

const router: IRouter = Router();

router.use(healthRouter);
router.use(musicvizionRouter);

export default router;
