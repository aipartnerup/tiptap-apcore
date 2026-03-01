import express from "express";
import cors from "cors";
import { chatHandler } from "./chatHandler.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.post("/api/chat", chatHandler);

app.get("/api/health", (_req, res) => {
  const providers = [
    {
      id: "openai",
      name: "OpenAI",
      configured: !!process.env.OPENAI_API_KEY,
      models: [
        { id: "openai:gpt-4o", name: "GPT-4o" },
        { id: "openai:gpt-4.1", name: "GPT-4.1" },
        { id: "openai:gpt-5.1", name: "GPT-5.1" },
      ],
    },
    {
      id: "anthropic",
      name: "Anthropic",
      configured: !!process.env.ANTHROPIC_API_KEY,
      models: [
        { id: "anthropic:claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
        { id: "anthropic:claude-haiku-4-5", name: "Claude Haiku 4.5" },
        { id: "anthropic:claude-opus-4-5", name: "Claude Opus 4.5" },
      ],
    },
    {
      id: "google",
      name: "Google Gemini",
      configured: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      models: [
        { id: "google:gemini-2.5-flash", name: "Gemini 2.5 Flash" },
        { id: "google:gemini-2.5-pro", name: "Gemini 2.5 Pro" },
        { id: "google:gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      ],
    },
  ];

  const defaultModel = process.env.LLM_MODEL || "openai:gpt-4o";

  res.json({ status: "ok", defaultModel, providers });
});

export { app };
