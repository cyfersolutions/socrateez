import mongoose from "mongoose";
import { jobDataFields } from "./jobDataFields.js";

const cleanedJobDataSchema = new mongoose.Schema(
  {
    ...jobDataFields,

    /** Raw document this cleaned row was derived from (idempotent sync). */
    sourceRawId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RawJobData",
      index: true,
      sparse: true,
    },

    // ── Existing ETL fields ──────────────────────────────────────────
    isRemote: { type: Boolean, default: false },
    etlSalaryFlags: { type: [String], default: [] },

    // ── Job Title Normalization (TTL) ───────────────────────────────
    normalizedTitle: { type: String, trim: true, index: true },
    /** Which raw title field produced normalizedTitle after JTP cleaning. */
    roleSource: {
      type: String,
      enum: ["filter_title", "listing_title"],
      default: null,
    },

    // ── Job Type Classification (JTP) ────────────────────────────────
    jobType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "internship", "freelance"],
      default: "full_time",
      index: true,
    },

    // ── Date & Freshness (DTE) ───────────────────────────────────────
    postedAt: { type: Date, default: null },
    daysSincePosted: { type: Number, default: null },

    // ── Location Normalization (LOC) ─────────────────────────────────
    normalizedState: { type: String, trim: true },
    normalizedCity: { type: String, trim: true },
    normalizedCountry: { type: String, trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    // ── Company Deduplication (CMP) ──────────────────────────────────
    canonicalCompany: { type: String, trim: true, index: true },

    // ── Skills Extraction (SKL) ──────────────────────────────────────
    skills: { type: [String], default: [] },

    // ── Duplicate Detection (DUP) ────────────────────────────────────
    isDuplicate: { type: Boolean, default: false, index: true },
    duplicateHash: { type: String, default: null },

    // ── Audit trail of every rule ID that fired on this doc ──────────
    etlRulesApplied: { type: [String], default: [] },
  },
  {
    timestamps: true,
    collection: "cleaned_job_data",
  }
);

export const CleanedJobData = mongoose.model(
  "CleanedJobData",
  cleanedJobDataSchema
);
