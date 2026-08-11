// One-time setup for the demo agent used in plain.mjs / with-credit.mjs.
//
// Creates a fresh Stellar keypair for the demo agent, plus 2 FRESH independent
// payer wallets funded via the live TrustLine faucet (never any existing
// TrustLine agent/customer wallet — avoids the funding-contamination trap:
// paying this new agent from wallets it never touched is genuine, independent
// revenue). Registers + underwrites the demo agent for a real, non-zero
// credit line.
//
// SAFETY: every generated keypair's secret is written to
// agents/demo/.wallets-recovery.json IMMEDIATELY on creation, before any
// network call — so a crash mid-run can never strand funded testnet USDC in
// an unrecoverable wallet (this happened once; this file exists because of
// that). Re-running this script reuses any wallet already recorded as
// funded/dripped in the recovery file instead of creating new ones.
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

const PAY_TO_AGENT_USDC = "7.0000000"; // per payer, 2 payers = $14 revenue
const LENDER_DEPOSIT_USDC = 3; // from payer2's leftover balance after paying the agent

// ---- recovery-file persistence (the actual safety fix) ----

function loadRecovery() {
  try {
    return JSON.parse(fs.readFileSync(recoveryPath, "utf8"));
  } catch {
    return {};
  }
}

function saveRecoveryEntry(label, fields) {
  const rec = loadRecovery();
  rec[label] = { ...rec[label], ...fields };
  fs.writeFileSync(recoveryPath, JSON.stringify(rec, null, 2));
}

/** Get-or-create a wallet for `label`, persisting the secret THE INSTANT it's
 * generated — before friendbot/trustline/drip, so a crash never loses it. */
function getOrCreateWallet(label) {
  const rec = loadRecovery();
  if (rec[label]?.secret) {
    console.log(`  [${label}] reusing existing wallet from recovery file: ${rec[label].publicKey}`);
    return { kp: Keypair.fromSecret(rec[label].secret), entry: rec[label] };
  }
  const kp = Keypair.random();
  saveRecoveryEntry(label, {
    publicKey: kp.publicKey(),
    secret: kp.secret(),
    fundedXlm: false,
    trustline: false,
    dripped: false,
  });
  console.log(`  [${label}] generated + saved to recovery file: ${kp.publicKey()}`);
  return { kp, entry: loadRecovery()[label] };
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

async function faucetDrip(address) {
  const res = await fetch(`${TRUSTLINE_API}/faucet`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`faucet drip failed for ${address}: ${JSON.stringify(body)}`);
  return body;
}

/** Fully provision a payer wallet, checkpointing progress after every step so
 * a crash resumes instead of re-spending faucet funds on a fresh wallet. */
async function ensureFundedWallet(label) {
  const { kp, entry } = getOrCreateWallet(label);

  if (!entry.fundedXlm) {
    await friendbot(kp.publicKey());
    saveRecoveryEntry(label, { fundedXlm: true });
  }
  if (!entry.trustline) {
    await openTrustline(kp);
    saveRecoveryEntry(label, { trustline: true });
  }
  if (!entry.dripped) {
    const drip = await faucetDrip(kp.publicKey());
    saveRecoveryEntry(label, { dripped: true });
    console.log(`  [${label}] faucet drip: ${drip.amountUsdc} USDC (tx ${drip.txHash})`);
  } else {
    console.log(`  [${label}] already dripped — skipping`);
  }
  return kp;
}

async function payFromKeypair(kp, destination, amount) {
  const acct = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination, asset: USDC, amount }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  const sent = await horizon.submitTransaction(tx);
  console.log(`  paid ${amount} USDC -> tx ${sent.hash}`);
}

async function main() {
  console.log("[1/7] Demo-agent keypair (fresh, persisted immediately)...");
  const { kp: demo, entry: demoEntry } = getOrCreateWallet("demo");

  console.log("[2/7] Funding demo agent with Friendbot + opening a USDC trustline...");
  if (!demoEntry.fundedXlm) {
    await friendbot(demo.publicKey());
    saveRecoveryEntry("demo", { fundedXlm: true });
  }
  if (!demoEntry.trustline) {
    await openTrustline(demo);
    saveRecoveryEntry("demo", { trustline: true });
  }

  console.log("[3/7] Creating 2 independent payers, faucet-funded (resumable)...");
  const payers = [];
  for (let i = 1; i <= 2; i++) {
    payers.push(await ensureFundedWallet(`payer${i}`));
  }

  console.log("[4/7] Each payer pays the demo agent real, independent revenue...");
  const rec = loadRecovery();
  for (const [i, payer] of payers.entries()) {
    const label = `payer${i + 1}`;
    if (rec[label]?.paidAgent) {
      console.log(`  [${label}] already paid — skipping`);
      continue;
    }
    await payFromKeypair(payer, demo.publicKey(), PAY_TO_AGENT_USDC);
    saveRecoveryEntry(label, { paidAgent: true });
  }

  console.log("[5/7] Registering + underwriting on TrustLine...");
  const tl = new TrustLineAgent(demo.secret(), { apiBaseUrl: TRUSTLINE_API });
  const { register, underwrite } = await tl.onboard({ skipProof: true });
  console.log(`  register tx: ${register.txHash}`);
  console.log(
    `  score ${underwrite.score.score} / tier ${underwrite.score.tier} / ` +
      `limit ${underwrite.score.limitUsdc} USDC @ ${underwrite.score.aprBps / 100}% APR`,
  );

  console.log("[6/7] Draining the demo agent's USDC balance (score is unaffected)...");
  const bal = await tl.usdcBalanceUsdc();
  if (bal > 0) {
    const drainAcct = await horizon.loadAccount(demo.publicKey());
    const drainTx = new TransactionBuilder(drainAcct, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({ destination: payers[0].publicKey(), asset: USDC, amount: bal.toFixed(7) }),
      )
      .setTimeout(60)
      .build();
    drainTx.sign(demo);
    await horizon.submitTransaction(drainTx);
    console.log(`  drained ${bal} USDC — balance now 0`);
  }

  console.log("[7/7] Depositing lender liquidity (from payer2's leftover balance)...");
  const lenderTl = new TrustLineAgent(payers[1].secret(), { apiBaseUrl: TRUSTLINE_API });
  const depositTx = await lenderTl.deposit(demo.publicKey(), LENDER_DEPOSIT_USDC);
  console.log(`  deposit tx: ${depositTx.txHash}`);

  console.log("Saving DEMO_AGENT_SECRET/PUBLIC to agents/.env...");
  let env = fs.readFileSync(envPath, "utf8");
  if (env.length && !env.endsWith("\n")) env += "\n";
  env = env.replace(/^DEMO_AGENT_SECRET=.*$/m, "").replace(/^DEMO_AGENT_PUBLIC=.*$/m, "");
  env += `DEMO_AGENT_SECRET=${demo.secret()}\nDEMO_AGENT_PUBLIC=${demo.publicKey()}\n`;
  fs.writeFileSync(envPath, env);

  const finalCredit = await tl.availableCreditUsdc();
  console.log("\nDone. Demo agent is ready:");
  console.log(`  ${demo.publicKey()}`);
  console.log(`  available credit: ${finalCredit} USDC`);
  console.log("\nRun: node plain.mjs   and   node with-credit.mjs");
}

main().catch((e) => {
  console.error("\nsetup failed:", e instanceof Error ? e.message : e);
  console.error("Nothing is lost — every wallet generated so far is saved in");
  console.error(recoveryPath);
  console.error("Re-run this script and it will resume from where it left off.");
  process.exit(1);
});
