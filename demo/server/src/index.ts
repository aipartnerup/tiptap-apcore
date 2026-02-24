import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env from demo/ directory (parent of server/)
dotenv.config({ path: resolve(__dirname, "../../.env") });
import express from "express";
import cors from "cors";
import { chatHandler } from "./chatHandler.js";

const app = express();
const port = parseInt(process.env.PORT || "3001", 10);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.post("/api/chat", chatHandler);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`tiptap-apcore demo server running on http://localhost:${port}`);
});
