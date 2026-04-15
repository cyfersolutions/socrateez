import { Router } from "express";
import { answerAssistantMessage } from "../services/assistantService.js";

const router = Router();

router.post("/chat", async (req, res, next) => {
  try {
    const message = req.body?.message;
    if (message == null || typeof message !== "string") {
      res.status(400).json({ error: "message (string) is required" });
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      res.status(400).json({ error: "message must not be empty" });
      return;
    }
    const result = await answerAssistantMessage(trimmed);
    res.json(result);
  } catch (err) {
    console.error(err);
    next(err);
  }
});

export default router;
