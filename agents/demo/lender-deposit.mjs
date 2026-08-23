// A real lender deposits into the demo agent's isolated vault — needed before
// with-credit.mjs's borrow() has any liquidity to actually draw. Run once,
// after setup.mjs.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "..", ".env") });

import { TrustLineAgent } from "../../packages/agent-sdk/dist/index.js";

// CUSTOMER1 has spare USDC on hand; using it as the lender is safe — a
// deposit goes to the vault contract's address, not the agent's own wallet,
// so it's invisible to the revenue/independence graph entirely.
const lender = new TrustLineAgent(process.env.CUSTOMER1_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "https://fianza-5m68.onrender.com",
});
const amount = Number(process.argv[2] || "2");

if (!process.env.DEMO_AGENT_PUBLIC) {
  throw new Error("DEMO_AGENT_PUBLIC not set — run setup.mjs first");
}

console.log(
  `lender ${lender.publicKey()} depositing ${amount} USDC into the demo agent's isolated vault...`,
);
const r = await lender.deposit(process.env.DEMO_AGENT_PUBLIC, amount);
console.log("deposit tx:", r.txHash);
