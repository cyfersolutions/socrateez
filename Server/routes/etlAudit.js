import { Router } from "express";
import { EtlAuditLog } from "../models/EtlAuditLog.js";

const router = Router();

const PHASE_ORDER = [
  "eligibility_filter",
  "salary_normalization",
  "job_type_classification",
  "job_title_normalization",
  "remote_detection",
  "date_freshness",
  "location_normalization",
  "company_deduplication",
  "skills_extraction",
  "duplicate_detection",
];

function phaseRank(category) {
  const idx = PHASE_ORDER.indexOf(category);
  return idx === -1 ? PHASE_ORDER.length : idx;
}

/** List all sync runs (most recent first). */
router.get("/runs", async (req, res, next) => {
  try {
    const runs = await EtlAuditLog.aggregate([
      {
        $group: {
          _id: "$syncRunId",
          appliedAt: { $max: "$appliedAt" },
          totalRules: { $sum: 1 },
          categories: { $addToSet: "$ruleCategory" },
        },
      },
      { $sort: { appliedAt: -1 } },
      { $limit: Number(req.query.limit) || 50 },
    ]);

    for (const run of runs) {
      run.categories.sort((a, b) => phaseRank(a) - phaseRank(b));
    }

    res.json(runs);
  } catch (err) {
    next(err);
  }
});

/** Get full audit detail for a specific sync run. */
router.get("/runs/:syncRunId", async (req, res, next) => {
  try {
    const logs = await EtlAuditLog.find({ syncRunId: req.params.syncRunId })
      .sort({ ruleId: 1 })
      .lean();
    if (logs.length === 0) {
      return res.status(404).json({ error: "Sync run not found" });
    }

    const byCategory = {};
    for (const log of logs) {
      if (!byCategory[log.ruleCategory]) {
        byCategory[log.ruleCategory] = {
          category: log.ruleCategory,
          countBeforePhase: log.countBeforePhase,
          countAfterPhase: log.countAfterPhase,
          phaseTimeTakenMs: log.phaseTimeTakenMs,
          subRules: [],
        };
      }
      byCategory[log.ruleCategory].subRules.push({
        ruleId: log.ruleId,
        ruleDescription: log.ruleDescription,
        affectedCount: log.affectedCount,
        rejectedCount: log.rejectedCount,
        sampleBefore: log.sampleBefore,
        sampleAfter: log.sampleAfter,
      });
    }

    const phases = Object.values(byCategory).sort(
      (a, b) => phaseRank(a.category) - phaseRank(b.category),
    );

    res.json({
      syncRunId: req.params.syncRunId,
      appliedAt: logs[0].appliedAt,
      phases,
    });
  } catch (err) {
    next(err);
  }
});

/** Get audit entries filtered by rule category. */
router.get("/category/:category", async (req, res, next) => {
  try {
    const logs = await EtlAuditLog.find({ ruleCategory: req.params.category })
      .sort({ appliedAt: -1 })
      .limit(Number(req.query.limit) || 100)
      .lean();
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

/** Get audit entries for a specific sub-rule (e.g. SAL-01). */
router.get("/rule/:ruleId", async (req, res, next) => {
  try {
    const logs = await EtlAuditLog.find({ ruleId: req.params.ruleId })
      .sort({ appliedAt: -1 })
      .limit(Number(req.query.limit) || 100)
      .lean();
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

export default router;
