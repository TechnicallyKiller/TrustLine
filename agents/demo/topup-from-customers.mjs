// Pays the demo agent (DEMO_AGENT_PUBLIC) from the existing, AGED customer
// wallets (CUSTOMER1/2) instead of fresh ones — the independence engine
// discounts brand-new wallets to near-zero (correctly; that's the anti-Sybil
// check working), so real credit needs real-aged payers. Run after setup.mjs,
// then re-run underwrite.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "..", ".env") });

import { Keypair, Horizon, TransactionBuilder, Operation, Asset, Networks, BASE_FEE } from "@stellar/stellar-sdk";
import { TrustLineAgent } from "@trustline-agents/agent-sdk";

const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
const AMOUNT = "1.5000000";

async function pay(secretVar, destination) {
  const secret = process.env[secretVar];
  const kp = Keypair.fromSecret(secret);
  const acct = await horizon.loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.payment({ destination, asset: USDC, amount: AMOUNT }))
    .setTimeout(60)
    .build();
  tx.sign(kp);
  const sent = await horizon.submitTransaction(tx);
  console.log(`  [${secretVar}] paid ${AMOUNT} USDC -> tx ${sent.hash}`);
}

async function main() {
  const demoPublic = process.env.DEMO_AGENT_PUBLIC;
  if (!demoPublic) throw new Error("DEMO_AGENT_PUBLIC not set — run setup.mjs first");
  console.log(`Paying demo agent ${demoPublic} from aged customer wallets...`);
  await pay("CUSTOMER1_SECRET", demoPublic);
  await pay("CUSTOMER2_SECRET", demoPublic);

  console.log("Re-underwriting...");
  const tl = new TrustLineAgent(process.env.DEMO_AGENT_SECRET, {
    apiBaseUrl: process.env.TRUSTLINE_API || "https://fianza-5m68.onrender.com",
  });
  const result = await tl.underwrite({ skipProof: true });
  console.log(
    `score ${result.score.score} / tier ${result.score.tier} / limit ${result.score.limitUsdc} USDC @ ${result.score.aprBps / 100}% APR`,
  );

  console.log("Draining demo agent balance again (score unaffected)...");
  const bal = await tl.usdcBalanceUsdc();
  if (bal > 0) {
    const kp = Keypair.fromSecret(process.env.DEMO_AGENT_SECRET);
    const acct = await horizon.loadAccount(kp.publicKey());
    const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(
        Operation.payment({ destination: process.env.CUSTOMER1_PUBLIC, asset: USDC, amount: bal.toFixed(7) }),
      )
      .setTimeout(60)
      .build();
    tx.sign(kp);
    await horizon.submitTransaction(tx);
    console.log(`  drained ${bal} USDC`);
  }

  const avail = await tl.availableCreditUsdc();
  console.log(`\navailable credit now: ${avail} USDC`);
}

main().catch((e) => {
  console.error("failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
