// DRAG-IN SNIPPET — the SDK replaces the manual x402 client entirely, not
// just adds credit on top of it. 3 swaps, each a "select old, drag new in
// its place." Full choreography in agents/demo/RECORDING.md.
//
//   1. Select plain.mjs's 3 x402 imports (wrapFetchWithPaymentFromConfig,
//      createEd25519Signer, ExactStellarScheme) — drag block A on top.
//   2. Select the `NETWORK` / `signer` / `fetchWithPayment` construction
//      block — drag block B on top.
//   3. Select the whole try/catch fetch-with-payment block — drag block C
//      on top.
// That's it — one import, one constructor, one method call replaces the
// entire manual x402 payment client AND adds the credit-line fallback.

// ── Block A: one import instead of three ──
import { TrustLineAgent } from "@trustline-agents/agent-sdk";

// ── Block B: one constructor instead of signer + scheme + fetch wrapper ──
const PRICE_USDC = Number(process.env.ANALYST_PRICE_USDC || 0.3);
const tl = new TrustLineAgent(process.env.DEMO_AGENT_SECRET, {
  apiBaseUrl: process.env.TRUSTLINE_API || "https://fianza-3ecj.onrender.com",
});

// ── Block C: one call instead of a manual fetch + try/catch + 402 check ──
const res = await tl.payWithCredit(RESEARCH_URL, PRICE_USDC, {
  init: {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ asset }),
  },
});
