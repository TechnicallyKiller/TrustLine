// Demo: a trading-research agent that CAN pay over x402 — it's a real,
// functioning paying agent — but has no TrustLine credit line. It works fine
// as long as its wallet balance covers the price; the moment it can't, the
// payment genuinely fails and it dies. This is a fair, apples-to-apples
// comparison against with-credit.mjs: same real x402 payment capability,
// the only difference is the credit-line fallback.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });
import { TrustLineAgent } from "@trustline-agents/agent-sdk";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

const RESEARCH_URL = process.env.RESEARCH_URL || "http://localhost:3099/research";
const asset = process.argv[2] || "XLM";
const NETWORK = "stellar:testnet";

const PRICE_USDC = Number(process.env.ANALYST_PRICE_USDC || 0.3);
const tl = new TrustLineAgent(process.env.DEMO_AGENT_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "https://fianza-3ecj.onrender.com",
});

console.log(`[demo-agent] requesting research on "${asset}"...`);

const res = await tl.payWithCredit(RESEARCH_URL, PRICE_USDC, {
  init: {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset }),
  },
});

const data = await res.json();
console.log("[demo-agent] got research:", data.note?.slice(0, 120) + "...");
