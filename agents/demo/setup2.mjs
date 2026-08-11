// Clean rebuild of the demo agent, fixing the mistake in setup.mjs's drain
// step: draining the agent's balance back to one of its OWN paying customers
// creates a real on-chain funding loop (agent -> payer -> agent), which the
// independence engine correctly flags as circular — permanently, for that
// agent/payer pair. This script pays from the aged CUSTOMER1/2/3 wallets
// (real history — required, since brand-new wallets get discounted as
// fresh/puppet regardless of real payment) and drains to a DEDICATED SINK
// wallet that never pays anyone, so it can never create a loop.
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, "..", ".env");
const recoveryPath = path.resolve(here, ".wallets-recovery.json");
dotenv.config({ path: envPath });

import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import { TrustLineAgent } from "@trustline-agents/agent-sdk";

const TRUSTLINE_API = process.env.TRUSTLINE_API || "https://fianza-3ecj.onrender.com";
const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

const PAYERS = [
  { secretVar: "CUSTOMER1_SECRET", amount: "1.5000000" },
  { secretVar: "CUSTOMER2_SECRET", amount: "0.3000000" },
  { secretVar: "CUSTOMER3_SECRET", amount: "0.3000000" },
];

function loadRecovery() {
  try { return JSON.parse(fs.readFileSync(recoveryPath, "utf8")); } catch { return {}; }
}
function saveRecoveryEntry(label, fields) {
  const rec = loadRecovery();
  rec[label] = { ...rec[label], ...fields };
  fs.writeFileSync(recoveryPath, JSON.stringify(rec, null, 2));
}
function getOrCreateWallet(label) {
  const rec = loadRecovery();
  if (rec[label]?.secret) {
    console.log(`  [${label}] reusing existing: ${rec[label].publicKey}`);
    return Keypair.fromSecret(rec[label].secret);
  }
  const kp = Keypair.random();
  saveRecoveryEntry(label, { publicKey: kp.publicKey(), secret: kp.secret() });
  console.log(`  [${label}] generated + saved: ${kp.publicKey()}`);
  return kp;
}

async function friendbot(pub) {
  for (let i = 0; i < 6; i++) {
    if ((await fetch(`https://friendbot.stellar.org/?addr=${pub}`)).ok) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`friendbot failed for ${pub}`);
}
async function openTrustline(kp) {
  const acct = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  await horizon.submitTransaction(tx);
}
async function payTo(secretVar, destination, amount) {
  const kp = Keypair.fromSecret(process.env[secretVar]);
  const acct = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination, asset: USDC, amount }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  const sent = await horizon.submitTransaction(tx);
  console.log(`  [${secretVar}] paid ${amount} USDC -> tx ${sent.hash}`);
}

async function main() {
  console.log("[1/6] Fresh demo-agent keypair (persisted immediately)...");
  const demo = getOrCreateWallet("demo2");
  const demoRec = loadRecovery().demo2;
  if (!demoRec.fundedXlm) { await friendbot(demo.publicKey()); saveRecoveryEntry("demo2", { fundedXlm: true }); }
  if (!demoRec.trustline) { await openTrustline(demo); saveRecoveryEntry("demo2", { trustline: true }); }

  console.log("[2/6] Dedicated sink wallet (drain target — never pays anyone)...");
  const sink = getOrCreateWallet("sink");
  const sinkRec = loadRecovery().sink;
  if (!sinkRec.fundedXlm) { await friendbot(sink.publicKey()); saveRecoveryEntry("sink", { fundedXlm: true }); }
  if (!sinkRec.trustline) { await openTrustline(sink); saveRecoveryEntry("sink", { trustline: true }); }

  console.log("[3/6] Paying demo agent from aged, real customer wallets...");
  for (const { secretVar, amount } of PAYERS) {
    await payTo(secretVar, demo.publicKey(), amount);
  }

  console.log("[4/6] Registering + underwriting...");
  const tl = new TrustLineAgent(demo.secret(), { apiBaseUrl: TRUSTLINE_API });
  const { register, underwrite } = await tl.onboard({ skipProof: true });
  console.log(`  register tx: ${register.txHash}`);
  console.log(
    `  score ${underwrite.score.score} / tier ${underwrite.score.tier} / ` +
      `limit ${underwrite.score.limitUsdc} USDC @ ${underwrite.score.aprBps / 100}% APR`,
  );

  if (underwrite.score.limitUsdc <= 0) {
    console.log("\n  Still 0 limit — check independence breakdown before proceeding.");
    console.log(JSON.stringify(underwrite.independence?.perPayer, null, 2));
    return;
  }

  console.log("[5/6] Draining demo agent's balance to the SINK (never a payer)...");
  const bal = await tl.usdcBalanceUsdc();
  if (bal > 0) {
    const acct = await horizon.loadAccount(demo.publicKey());
    const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({ destination: sink.publicKey(), asset: USDC, amount: bal.toFixed(7) }))
      .setTimeout(60)
      .build();
    tx.sign(demo);
    await horizon.submitTransaction(tx);
    console.log(`  drained ${bal} USDC to sink — balance now 0`);
  }

  console.log("[6/6] Depositing lender liquidity (from the sink, post-drain)...");
  const lenderTl = new TrustLineAgent(sink.secret(), { apiBaseUrl: TRUSTLINE_API });
  const sinkBal = await lenderTl.usdcBalanceUsdc();
  const depositAmount = Math.min(3, sinkBal);
  if (depositAmount > 0) {
    const depositTx = await lenderTl.deposit(demo.publicKey(), depositAmount);
    console.log(`  deposit tx: ${depositTx.txHash} (${depositAmount} USDC)`);
  }

  console.log("Saving DEMO_AGENT_SECRET/PUBLIC to agents/.env...");
  let env = fs.readFileSync(envPath, "utf8");
  if (env.length && !env.endsWith("\n")) env += "\n";
  env = env.replace(/^DEMO_AGENT_SECRET=.*$/m, "").replace(/^DEMO_AGENT_PUBLIC=.*$/m, "");
  env += `DEMO_AGENT_SECRET=${demo.secret()}\nDEMO_AGENT_PUBLIC=${demo.publicKey()}\n`;
  fs.writeFileSync(envPath, env);

  const finalCredit = await tl.availableCreditUsdc();
  console.log("\nDone. Demo agent ready:", demo.publicKey());
  console.log(`available credit: ${finalCredit} USDC`);
}

main().catch((e) => {
  console.error("\nfailed:", e instanceof Error ? e.message : e);
  console.error("Wallets so far are saved in", recoveryPath);
  process.exit(1);
});
