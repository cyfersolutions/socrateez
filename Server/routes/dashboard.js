import { Router } from "express";
import { getDashboardPayload } from "../services/dashboardService.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const data = await getDashboardPayload();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
