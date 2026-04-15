import mongoose from "mongoose";

const etlAuditLogSchema = new mongoose.Schema(
  {
    syncRunId: { type: String, required: true, index: true },
    ruleCategory: { type: String, required: true, index: true },
    ruleId: { type: String, required: true, index: true },
    ruleDescription: { type: String },
    affectedCount: { type: Number, default: 0 },
    rejectedCount: { type: Number, default: 0 },
    countBeforePhase: { type: Number, default: null },
    countAfterPhase: { type: Number, default: null },
    phaseTimeTakenMs: { type: Number, default: null },
    sampleBefore: { type: mongoose.Schema.Types.Mixed, default: [] },
    sampleAfter: { type: mongoose.Schema.Types.Mixed, default: [] },
    appliedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "etl_audit_logs",
  }
);

etlAuditLogSchema.index({ syncRunId: 1, ruleCategory: 1, ruleId: 1 });

export const EtlAuditLog = mongoose.model("EtlAuditLog", etlAuditLogSchema);
