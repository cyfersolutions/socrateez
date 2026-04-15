import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import apiRouter from "./routes/index.js";

const PORT = Number(process.env.PORT) || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/socrateez";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", apiRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected");

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
