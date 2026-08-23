// Same trading-research agent — now with TrustLine credit.
// Only real change from plain.mjs: 3 lines. It hits the exact same paywall,
// but instead of dying, it draws the shortfall from its credit line and pays.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });
import { TrustLineAgent } from "@trustline-agents/agent-sdk"; // +1

const RESEARCH_URL = process.env.RESEARCH_URL || "http://localhost:3022/research";
const PRICE_USDC = Number(process.env.ANALYST_PRICE_USDC || 0.3);
const asset = process.argv[2] || "XLM";

const tl = new TrustLineAgent(process.env.DEMO_AGENT_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "https://fianza-5m68.onrender.com",
}); // +1

console.log(`[demo-agent] requesting research on "${asset}"...`);

const res = await tl.payWithCredit(RESEARCH_URL, PRICE_USDC, {
  init: {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset }),
  },
}); // +1 (replaces the plain fetch() call)

const data = await res.json();
console.log("[demo-agent] paid via credit line, got research:", data.note?.slice(0, 120) + "...");
