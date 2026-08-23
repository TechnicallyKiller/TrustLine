# @trustline-agents/agent-sdk

Credit for AI agents, in a few lines. An agent uses this SDK to get an
**uncollateralized, revenue-underwritten credit line** and draw/repay USDC on
Stellar — autonomously, no human in the loop.

Borrowing power comes from the agent's *proven revenue* (on-chain x402 earnings +
zkTLS-attested off-chain income), underwritten by the Fianza engine. Settles in
USDC. Every agent's line is an isolated vault.

## Install

```bash
npm install @trustline-agents/agent-sdk
```

New to Fianza? **[Read the onboarding kit first](../../docs/onboarding-kit.md)**
— it walks through getting a testnet Stellar account funded (XLM + USDC) before
any of this will work, then runs this exact quickstart end to end with real
command output. There's also a runnable copy of it at
[`examples/quickstart.mjs`](examples/quickstart.mjs).

## Quickstart

```ts
import { FianzaAgent } from "@trustline-agents/agent-sdk";

// The agent holds its own Stellar key.
const tl = new FianzaAgent(process.env.AGENT_SECRET!, {
  apiBaseUrl: "https://fianza-5m68.onrender.com", // the underwriting engine
  // contracts: { registry, creditLine, vault }  // optional; else read from /config
});

// 1. Register + get underwritten from your real revenue.
await tl.onboard();

// 2. See your line.
const { limitUsdc, aprBps } = await tl.creditLine();
console.log(`limit ${limitUsdc} USDC @ ${aprBps / 100}% APR`);

// 3. Borrow working capital, do the work, repay as revenue lands.
if (await tl.availableCreditUsdc() >= 5) {
  await tl.borrow(5);
  // ...spend on compute / APIs / data, deliver, get paid over x402...
  await tl.repay(5);
}
```

## API

| Method | What it does |
|---|---|
| `register()` | Register the agent on-chain (one-time). |
| `underwrite({ skipProof?, fromLedger? })` | Run the full scoring pass (revenue → zkTLS proof → score → publish on-chain). |
| `onboard()` | `register()` then `underwrite()`. |
| `creditLine()` | `{ tier, limitUsdc, aprBps }` derived live from the on-chain score. |
| `availableCreditUsdc()` | Remaining drawable credit. |
| `vaultState()` | Full isolated-vault accounting for this agent. |
| `borrow(usdc)` / `repay(usdc)` | Draw / repay against the line. |
| `deposit(agent, usdc)` | LP action — supply liquidity to an agent's isolated vault. |
| `usdcBalanceUsdc()` | The agent's spendable USDC balance. |
| **`payWithCredit(url, priceUsdc)`** | **Draw-on-402** — pay for an x402 resource, auto-drawing any shortfall from the credit line first. Credit becomes invisible. |
| `revenue(fromLedger?)` | Live x402 revenue index. |

On-chain writes are signed by the agent's own key; reads are simulate-only;
scoring is delegated to the Fianza underwriting engine (the trusted underwriter
in v1 — see the decentralization roadmap).

## Draw-on-402 — credit that draws itself

```ts
// The agent just transacts. If it can't cover the paywall, the line covers it.
const res = await tl.payWithCredit("https://api.example.com/premium", 3, {
  maxDraw: 5, // optional cap per call
});
// → checks USDC balance, borrows only the shortfall, pays over x402, returns the Response.
```

> Testnet today. Not financial advice; you are responsible for your agent's
> borrowing.
