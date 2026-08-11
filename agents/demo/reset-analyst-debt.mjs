// Reset the demo agent (ANALYST) to a clean pre-demo state:
//   1. top it up from the holding wallet so it can repay,
//   2. repay its full outstanding principal + interest (frees the ramped limit),
//   3. re-drain back to a ~$0.05 float so it's short again.
// After this, ANALYST has its FULL ramped limit (~$0.44) available and ~$0.05
// cash — so a $0.30 data-call forces a clean ~$0.25 credit draw.
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
dotenv.config({ path: path.resolve(here, "../.demo-holding-wallet.local") });

const { TrustLineAgent } = await import("@trustline-agents/agent-sdk");

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const API = process.env.TRUSTLINE_API || "https://fianza-3ecj.onrender.com";
const FLOAT = 0.05;
const TOPUP = 0.6; // enough to cover principal+interest for the repay

const analyst = Keypair.fromSecret(process.env.ANALYST_WALLET_SECRET);
const holding = Keypair.fromSecret(process.env.DEMO_HOLDING_SECRET);
const tl = new TrustLineAgent(process.env.ANALYST_WALLET_SECRET, { apiBaseUrl: API });

function usdcBal(acct) {
  const b = acct.balances.find((x) => x.asset_code === "USDC" && x.asset_issuer === USDC.issuer);
  return b ? Number(b.balance) : 0;
}
async function sendUsdc(fromKp, toPub, amount) {
  const acct = await horizon.loadAccount(fromKp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination: toPub, asset: USDC, amount: amount.toFixed(7) }))
    .setTimeout(60)
    .build();
  tx.sign(fromKp);
  return (await horizon.submitTransaction(tx)).hash;
}

// 1. Top up ANALYST from holding so it can repay.
console.log("[reset] topping up ANALYST with", TOPUP, "USDC from holding…");
const h1 = await sendUsdc(holding, analyst.publicKey(), TOPUP);
console.log("  tx", h1);

// 2. Repay outstanding principal. Try a few times, shrinking, until available == limit.
async function available() {
  const r = await fetch(`${API}/agent/${analyst.publicKey()}/available-credit`).then((r) => r.json());
  return { ramped: Number(r.rampedLimitUsdc), avail: null, raw: r };
}
// Read on-chain available_credit + owed via the SDK (same path the server uses OK).
let owed = 0;
try {
  const avail = await tl.availableCreditUsdc();
  const ramped = (await available()).ramped;
  owed = Math.max(0, ramped - avail);
  console.log(`[reset] ramped limit=${ramped}  available=${avail}  ⇒ outstanding≈${owed.toFixed(6)}`);
} catch (e) {
  console.log("[reset] couldn't read available_credit, will repay a fixed 0.5:", e.message);
  owed = 0.5;
}

if (owed > 0) {
  // Repay slightly more than principal to also clear accrued interest.
  const repayAmt = Math.min(TOPUP, owed + 0.05);
  console.log(`[reset] repaying ${repayAmt.toFixed(6)} USDC…`);
  const r = await tl.repay(Number(repayAmt.toFixed(6)));
  console.log("  repay tx", r.txHash);
} else {
  console.log("[reset] nothing outstanding — limit already fully available.");
}

// 3. Re-drain ANALYST back to the float.
const acct = await horizon.loadAccount(analyst.publicKey());
const bal = usdcBal(acct);
const sweep = Math.floor((bal - FLOAT) * 1e7) / 1e7;
if (sweep > 0) {
  console.log(`[reset] re-draining ${sweep} USDC back to holding…`);
  const h2 = await sendUsdc(analyst, holding.publicKey(), sweep);
  console.log("  tx", h2);
}
console.log("[reset] done. ANALYST: ~$" + FLOAT + " cash, full ramped limit available.");
