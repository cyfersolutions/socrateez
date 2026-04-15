import { Router } from "express";
import { EmployerData } from "../models/EmployerData.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const docs = await EmployerData.find()
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
    const doc = await EmployerData.create(req.body);
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

export default router;
