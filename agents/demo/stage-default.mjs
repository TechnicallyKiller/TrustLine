// stage-default — prepare the DEADBEAT agent so it can be defaulted on stage.
//
// Run this ~6 minutes BEFORE your pitch. It:
//   1. ensures the deadbeat wallet exists + has a USDC trustline
//   2. has 3 INDEPENDENT funded wallets each pay it a little (real revenue, so
//      the anti-Sybil underwriter will give it a small real credit line)
//   3. underwrites it via the backend (publishes an on-chain limit)
//   4. seeds its vault with liquidity from the treasury (so it can borrow)
//   5. has the deadbeat BORROW — starting the 5-minute repayment clock
//
// After ~5 min the loan is overdue and the UI "trigger default" button (POST
// /default) can fire mark_default for real. This agent then gets FROZEN — it's
// a throwaway, never reused.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env") });
dotenv.config({ path: path.resolve(here, "../.deadbeat-wallet.local") });

const { TrustLineAgent } = await import("../../packages/agent-sdk/dist/index.js");

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const API = process.env.TRUSTLINE_API || "https://fianza-3ecj.onrender.com";
const EXPLORER = (h) => `https://stellar.expert/explorer/testnet/tx/${h}`;
const BORROW_USDC = Number(process.env.DEADBEAT_BORROW_USDC || 0.1);

const deadbeatSecret = process.env.DEADBEAT_WALLET_SECRET;
const deadbeatPub = process.env.DEADBEAT_WALLET_PUBLIC;
if (!deadbeatSecret) throw new Error("DEADBEAT_WALLET_SECRET missing (.deadbeat-wallet.local)");

// 3 independent payers we already fund elsewhere (real, unrelated wallets).
const PAYERS = [
  ["SCOUT", process.env.SCOUT_WALLET_SECRET],
  ["DATACO", process.env.DATACO_WALLET_SECRET],
  ["REVIEWER", process.env.REVIEWER_WALLET_SECRET],
].filter(([, s]) => s);

async function friendbot(pub) {
  for (let i = 0; i < 3; i++) if ((await fetch(`https://friendbot.stellar.org/?addr=${pub}`)).ok) return true;
  return false;
}
async function usdcBalance(pub) {
  try {
    const a = await horizon.loadAccount(pub);
    const b = a.balances.find((x) => x.asset_code === "USDC" && x.asset_issuer === USDC.issuer);
    return b ? Number(b.balance) : null; // null = no trustline
  } catch {
    return "no-account";
  }
}
async function pay(fromSecret, toPub, amount) {
  const kp = Keypair.fromSecret(fromSecret);
  const acct = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: toPub, asset: USDC, amount: amount.toFixed(7) }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  return (await horizon.submitTransaction(tx)).hash;
}

console.log("[stage-default] deadbeat:", deadbeatPub);

// 1. Ensure account + trustline.
let bal = await usdcBalance(deadbeatPub);
if (bal === "no-account") {
  console.log("  funding via friendbot…");
  if (!(await friendbot(deadbeatPub))) throw new Error("friendbot failed");
  bal = null;
}
if (bal === null) {
  console.log("  adding USDC trustline…");
  const kp = Keypair.fromSecret(deadbeatSecret);
  const acct = await horizon.loadAccount(deadbeatPub);
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  await horizon.submitTransaction(tx);
}

// 2. Independent revenue: each payer pays the deadbeat a little.
console.log("  seeding real revenue from", PAYERS.length, "independent payers…");
for (const [name, secret] of PAYERS) {
  try {
    const h = await pay(secret, deadbeatPub, 0.3);
    console.log(`    ${name} → deadbeat 0.3 USDC  ${h.slice(0, 10)}`);
  } catch (e) {
    console.log(`    ${name} pay failed: ${e.message}`);
  }
}

// 3. Underwrite (publish on-chain limit).
console.log("  underwriting…");
const tl = new TrustLineAgent(deadbeatSecret, { apiBaseUrl: API });
try {
  await tl.register().catch(() => {});
  const uw = await tl.underwrite({ skipProof: true });
  console.log("    limit:", uw?.score?.limitUsdc ?? uw?.limitUsdc ?? "?", "tier:", uw?.score?.tier ?? "?");
} catch (e) {
  console.log("    underwrite:", e.message);
}

// 4. Seed vault liquidity from the treasury so a borrow can go through.
console.log("  seeding vault liquidity from treasury…");
try {
  const r = await fetch(`${API}/agent/${deadbeatPub}/ensure-liquidity`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ neededUsdc: BORROW_USDC }),
  }).then((r) => r.json());
  console.log("    ", JSON.stringify(r));
} catch (e) {
  console.log("    ensure-liquidity:", e.message);
}

// 5. Borrow — starts the 5-minute repayment clock. The deadbeat will NOT repay.
console.log(`  deadbeat borrowing ${BORROW_USDC} USDC (starts the due clock)…`);
try {
  const b = await tl.borrow(BORROW_USDC);
  console.log("    borrow tx:", b.txHash);
  console.log("    ", EXPLORER(b.txHash));
} catch (e) {
  console.log("    borrow failed:", e.message);
  process.exit(1);
}

console.log("\n[stage-default] DONE. The loan is now due in ~5 minutes.");
console.log("[stage-default] After 5 min, click 'Trigger default' in the UI (POST /default).");
