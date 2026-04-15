import { Router } from "express";
import { RawJobData } from "../models/RawJobData.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const docs = await RawJobData.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const doc = await RawJobData.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

export default router;
