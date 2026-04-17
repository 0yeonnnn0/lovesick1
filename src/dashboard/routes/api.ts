import { Router } from "express";
import statusRoutes from "./status";
import presetRoutes from "./presets";
import logRoutes from "./logs";
import ragRoutes from "./rag";

const router = Router();

router.use(statusRoutes);
router.use(presetRoutes);
router.use(logRoutes);
router.use(ragRoutes);

export default router;
