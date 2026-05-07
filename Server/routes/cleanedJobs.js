import { Router } from "express";
import { CleanedJobData } from "../models/CleanedJobData.js";
import {
  exportDuplicateKeptSourceDetailsCsv,
  exportDuplicateRule3SourceDetailsCsv,
  rebuildDuplicateDebugFiles,
  resetCleanedCollectionAndSync,
  syncEligibleRawToCleaned,
} from "../services/rawToCleanedService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const docs = await CleanedJobData.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const doc = await CleanedJobData.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

router.post("/sync", async (req, res, next) => {
  try {
    console.log("Sync start:", new Date().toISOString());
    const result = await syncEligibleRawToCleaned();
    console.log("Sync end:", new Date().toISOString());
    res.json(result);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

/** Destructive: drops all cleaned rows, then full sync from raw (use after ETL rule changes). */
router.post("/reset-and-sync", async (req, res, next) => {
  try {
    console.log("Reset+cleaned sync start:", new Date().toISOString());
    const result = await resetCleanedCollectionAndSync();
    console.log("Reset+cleaned sync end:", new Date().toISOString());
    res.json(result);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

/** Rebuild duplicate debug JSON files with cleaned-record details by sourceRawId. */
router.post("/duplicate-debug/rebuild", async (req, res, next) => {
  try {
    const result = await rebuildDuplicateDebugFiles();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Export keptSourceRawDetails-only CSV files from duplicate debug JSON files. */
router.post("/duplicate-debug/export-kept-csv", async (req, res, next) => {
  try {
    const result = await exportDuplicateKeptSourceDetailsCsv();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** Export sourceRawDetails CSV files for DUP-03 debug JSON files. */
router.post("/duplicate-debug/export-rule3-source-csv", async (req, res, next) => {
  try {
    const result = await exportDuplicateRule3SourceDetailsCsv();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
