// Phase 0 proof: a TrustLine agent pays a Tael-shaped x402 capability via
// payWithCredit — same flagship draw-on-402 method demo/plain.mjs and
// demo/with-credit.mjs already use, now proven against Tael's ACTUAL protocol
// shape (classic Operation.payment + memo attribution), not the generic
// @x402/stellar Soroban-SAC scheme this SDK originally only supported.
//
// Run tael-capability-server.mjs first (see its header for what it stands in
// for), then run this.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });
import { TrustLineAgent } from "@trustline-agents/agent-sdk";

const CAPABILITY_URL = process.env.TAEL_DEMO_URL || "http://localhost:3099/c/demo-capability";
const PRICE_USDC = Number(process.env.TAEL_DEMO_PRICE_USDC || 0.05);

const tl = new TrustLineAgent(process.env.DEMO_AGENT_SECRET || process.env.DATACO_WALLET_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "https://fianza-5m68.onrender.com",
});

console.log(`[tael-demo] agent ${tl.publicKey()} calling Tael-shaped capability...`);
console.log(`[tael-demo] balance before: ${await tl.usdcBalanceUsdc()} USDC`);

const res = await tl.payWithCredit(CAPABILITY_URL, PRICE_USDC, {
  init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
});

if (!res.ok) {
  console.error(`[tael-demo] call failed: ${res.status}`, await res.text());
  process.exit(1);
}

const data = await res.json();
console.log("[tael-demo] response:", data.result);
console.log("[tael-demo] settlement receipt:", data.receipt);
console.log(`[tael-demo] balance after: ${await tl.usdcBalanceUsdc()} USDC`);
