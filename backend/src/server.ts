import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGIN || "").split(",").filter(Boolean) }));
app.use(express.json({ limit: "100kb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true, legacyHeaders: false }));

app.get("/health", (_req, res) => res.json({ status: "ok", service: "My Home Warranty API" }));
app.get("/v1/site-status", (_req, res) => res.setHeader("Cache-Control", "no-store").json({
  visibility: "PUBLIC",
  maintenanceMode: false,
  notice: "The website is temporarily unavailable. Please try again later."
}));
app.use((_req, res) => res.status(404).json({ error: "Endpoint not found" }));

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`My Home Warranty API listening on ${port}`));