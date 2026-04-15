import mongoose from "mongoose";
import { jobDataFields } from "./jobDataFields.js";

const rawJobDataSchema = new mongoose.Schema(jobDataFields, {
  timestamps: true,
  collection: "raw_job_data",
});

export const RawJobData = mongoose.model("RawJobData", rawJobDataSchema);
