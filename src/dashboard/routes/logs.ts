import { Router, Request, Response } from "express";
import { getTopKeywords, getUserStatsRanked } from "../../shared/state";
import { readLogs, listLogDates } from "../../shared/log-store";

const router = Router();

router.get("/logs", (req: Request, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  let logs = readLogs(date);
  const channel = req.query.channel as string | undefined;
  if (channel) logs = logs.filter((l) => l.channel === channel);
  res.json(logs);
});

router.get("/log-dates", (_req: Request, res: Response) => {
  res.json(listLogDates());
});

router.get("/user-stats", (_req: Request, res: Response) => res.json(getUserStatsRanked()));
router.get("/keywords", (req: Request, res: Response) => res.json(getTopKeywords(parseInt(req.query.limit as string || "20"))));

export default router;
