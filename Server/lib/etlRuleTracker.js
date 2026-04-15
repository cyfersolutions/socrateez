import crypto from "crypto";

const MAX_SAMPLES = 5;

function sanitizeSample(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : { ...doc };
  delete obj.__v;
  return obj;
}

export class EtlRuleTracker {
  constructor() {
    this.syncRunId = crypto.randomUUID();
    this.phases = new Map();
    this.subRules = new Map();
    this._phaseTimers = new Map();
  }

  startPhase(phaseName, countBefore) {
    this._phaseTimers.set(phaseName, { start: Date.now(), countBefore });
  }

  endPhase(phaseName, countAfter) {
    const timer = this._phaseTimers.get(phaseName);
    if (!timer) return;
    this.phases.set(phaseName, {
      countBefore: timer.countBefore,
      countAfter,
      timeTakenMs: Date.now() - timer.start,
    });
  }

  /** Set phase counts/timing directly (for cascading funnel phases). */
  setPhaseResult(phaseName, countBefore, countAfter, timeTakenMs) {
    this.phases.set(phaseName, { countBefore, countAfter, timeTakenMs });
  }

  /** Record a single doc hitting a sub-rule. */
  record(ruleId, category, description, { before, after, rejected = false } = {}) {
    const r = this._ensureRule(ruleId, category, description);
    r.affectedCount++;
    if (rejected) r.rejectedCount++;
    if (before && r.samplesBefore.length < MAX_SAMPLES) {
      r.samplesBefore.push(sanitizeSample(before));
    }
    if (after && r.samplesAfter.length < MAX_SAMPLES) {
      r.samplesAfter.push(sanitizeSample(after));
    }
  }

  /** Record a bulk count (e.g. eligibility counts computed via aggregation). */
  recordBulk(ruleId, category, description, { affected = 0, rejected = 0, sampleBefore, sampleAfter } = {}) {
    const r = this._ensureRule(ruleId, category, description);
    r.affectedCount += affected;
    r.rejectedCount += rejected;
    if (sampleBefore && r.samplesBefore.length < MAX_SAMPLES) {
      r.samplesBefore.push(sanitizeSample(sampleBefore));
    }
    if (sampleAfter && r.samplesAfter.length < MAX_SAMPLES) {
      r.samplesAfter.push(sanitizeSample(sampleAfter));
    }
  }

  _ensureRule(ruleId, category, description) {
    if (!this.subRules.has(ruleId)) {
      this.subRules.set(ruleId, {
        ruleId,
        category,
        description,
        affectedCount: 0,
        rejectedCount: 0,
        samplesBefore: [],
        samplesAfter: [],
      });
    }
    return this.subRules.get(ruleId);
  }

  toAuditEntries() {
    const entries = [];
    for (const [, data] of this.subRules) {
      const phase = this.phases.get(data.category);
      entries.push({
        syncRunId: this.syncRunId,
        ruleCategory: data.category,
        ruleId: data.ruleId,
        ruleDescription: data.description,
        affectedCount: data.affectedCount,
        rejectedCount: data.rejectedCount,
        countBeforePhase: phase?.countBefore ?? null,
        countAfterPhase: phase?.countAfter ?? null,
        phaseTimeTakenMs: phase?.timeTakenMs ?? null,
        sampleBefore: data.samplesBefore,
        sampleAfter: data.samplesAfter,
        appliedAt: new Date(),
      });
    }
    return entries;
  }
}
