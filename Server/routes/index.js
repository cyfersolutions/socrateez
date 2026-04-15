import { Router } from "express";
import rawJobsRouter from "./rawJobs.js";
import cleanedJobsRouter from "./cleanedJobs.js";
import employersRouter from "./employers.js";
import dashboardRouter from "./dashboard.js";
import jobsRouter from "./jobs.js";
import assistantRouter from "./assistant.js";
import etlAuditRouter from "./etlAudit.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ ok: true });
});

router.use("/dashboard", dashboardRouter);
router.use("/jobs", jobsRouter);
router.use("/assistant", assistantRouter);
router.use("/raw-jobs", rawJobsRouter);
router.use("/cleaned-jobs", cleanedJobsRouter);
router.use("/employers", employersRouter);
router.use("/etl-audit", etlAuditRouter);

export default router;
