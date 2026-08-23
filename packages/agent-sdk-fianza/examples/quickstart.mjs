#!/usr/bin/env node
// Fianza agent-sdk quickstart — a genuine, runnable end-to-end walkthrough.
//
// Generates a fresh Stellar testnet keypair, funds it (Friendbot XLM + a
// Fianza faucet USDC drip), then runs the real credit loop:
//   register -> underwrite -> creditLine -> borrow -> repay
//
// Every step prints its real output so you can see exactly what a from-scratch
// agent gets back. Nothing here is mocked — it hits the live testnet backend.
//
// Usage:
//   node examples/quickstart.mjs
//
// Optional env:
//   TRUSTLINE_API   defaults to https://fianza-5m68.onrender.com
//   AGENT_SECRET    reuse an existing funded Stellar secret instead of
//                   generating + funding a brand-new one

import { Keypair } from "@stellar/stellar-sdk";
import { FianzaAgent } from "../dist/index.js";

const API = process.env.TRUSTLINE_API ?? "https://fianza-5m68.onrender.com";
const FRIENDBOT = "https://friendbot.stellar.org";

function log(step, msg) {
  console.log(`\n[${step}] ${msg}`);
}

async function fundWithFriendbot(publicKey) {
  const res = await fetch(`${FRIENDBOT}/?addr=${publicKey}`);
  if (!res.ok) throw new Error(`Friendbot funding failed: ${res.status}`);
}

async function main() {
  log("1/6", "Setting up a Stellar testnet account...");
  const keypair = process.env.AGENT_SECRET
    ? Keypair.fromSecret(process.env.AGENT_SECRET)
    : Keypair.random();
  console.log(`  address: ${keypair.publicKey()}`);

  if (!process.env.AGENT_SECRET) {
    await fundWithFriendbot(keypair.publicKey());
    console.log("  funded with 10,000 testnet XLM via Friendbot");
  }

  const tl = new FianzaAgent(keypair.secret(), { apiBaseUrl: API });

  log("2/6", "Opening a USDC trustline (required before any USDC can land here)...");
  const cfg = await fetch(`${API}/config`).then((r) => r.json());
  console.log(`  USDC issuer/SAC: ${cfg.usdcSac}`);
  console.log(
    "  -> run: stellar tx new change-trust --source <this-key> --network testnet \\\n" +
      "         --line \"USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5\"",
  );
  console.log("  (see the onboarding kit for the full one-liner)");

  log("3/6", "Requesting a one-time testnet USDC drip from the Fianza faucet...");
  const faucetRes = await fetch(`${API}/faucet`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: keypair.publicKey() }),
  }).then((r) => r.json());
  console.log(`  ${JSON.stringify(faucetRes)}`);

  log("4/6", "Registering + underwriting (register -> revenue -> score -> publish)...");
  const { register, underwrite } = await tl.onboard({ skipProof: true });
  console.log(`  register tx: ${register.txHash}`);
  console.log(
    `  score ${underwrite.score.score} / tier ${underwrite.score.tier} / ` +
      `limit ${underwrite.score.limitUsdc} USDC @ ${underwrite.score.aprBps / 100}% APR`,
  );

  log("5/6", "Reading the live credit line...");
  const terms = await tl.creditLine();
  console.log(`  ${JSON.stringify(terms)}`);

  if (terms.limitUsdc > 0) {
    log("6/6", "Borrowing 1 USDC, then repaying it...");
    const borrowTx = await tl.borrow(Math.min(1, terms.limitUsdc));
    console.log(`  borrow tx: ${borrowTx.txHash}`);
    const repayTx = await tl.repay(Math.min(1, terms.limitUsdc));
    console.log(`  repay tx: ${repayTx.txHash}`);
  } else {
    log(
      "6/6",
      "Skipped borrow/repay — a fresh agent with zero revenue gets a 0 limit " +
        "by design (Unrated tier). Earn some real x402 revenue and re-run " +
        "tl.underwrite() to see the limit ramp up.",
    );
  }

  console.log("\nDone. This agent's address for future runs:");
  console.log(`  AGENT_SECRET=${keypair.secret()}`);
  console.log("(save it if you want to keep building on this same agent)");
}

main().catch((e) => {
  console.error("\nquickstart failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
