# Fianza

_Formerly "TrustLine" — renamed to avoid confusion with an unrelated,
already-funded SCF project of the same name. Same product, same team, same
code; the backend API host and GitHub repo path are unchanged for now._

**Uncollateralized credit for AI agents, underwritten by revenue — on Stellar.**

An AI agent earns income but can't borrow against it: no collateral, no credit
history. Fianza turns an agent's *verifiable, trailing revenue* into an
uncollateralized USDC credit line. The agent borrows and repays autonomously —
no human in the loop — and settlement rides x402, the payment rail agents already
use to earn.

> Not a credibility badge. A real lending decision, sized against income an agent can prove.

**Status:** working MVP, live on Stellar testnet — full loop (earn → underwrite
→ borrow → repay → default) settled on-chain, SDK published, live demo up.
**Contracts are now also deployed on Stellar mainnet** (see below) — the
product/backend still runs on testnet while the mainnet lender/liquidity side
is built out; the mainnet contracts are live and real, not yet wired to the
live app. 🔗 **Live demo:** https://fianza.space

📖 **[Full documentation](https://docs.fianza.space)** — architecture,
the credit engine, the Sybil model, the SDK reference, contract addresses, and
the roadmap. (Source lives in [`docs/`](docs/README.md).)

---

## What it does — three things, all real on testnet

**1. Autonomous, revenue-backed credit.** An agent registers, is underwritten on
its real on-chain x402 revenue (+ optional zkTLS-attested off-chain income), gets
a credit line, and a lender funds its **isolated vault**. The agent then borrows
and repays USDC *itself*, via the SDK — no human.
[register](https://stellar.expert/explorer/testnet/tx/d6b99f256cdb3b3d1d856809733c4b99ec7f1dc3abb4f968769e635b27a5a669) ·
[score published](https://stellar.expert/explorer/testnet/tx/7d113ede5a77a34696e9fa00142db80c02ca74be5dde866322054daef4fadc11) ·
[deposit](https://stellar.expert/explorer/testnet/tx/4bf6a210842b67520f8dd6dc99f7d0bc635e9400f8b1665b3b830c1de352d2ea) ·
[borrow](https://stellar.expert/explorer/testnet/tx/98b3f5625d9eea49c19ffde5e9a6db6ba462de1c407f9fa7c6ea750fbd515788) ·
[repay](https://stellar.expert/explorer/testnet/tx/c58f02438d5a0d9b9a5b217d891a2161c8bb368f26af3efaf33d6d7055684bfc)

**2. Sybil resistance that works.** The moat isn't reading revenue — anyone can do
that. It's proving revenue is *independent*. An agent that fakes income by paying
itself from wallets it funded is **caught on-chain** (fund-flow loop detection) and
**denied** — both by the underwriter and the vault contract itself.

**3. Invisible credit over x402.** When an agent hits a paywalled x402 resource it
can't afford, `payWithCredit()` **auto-draws the shortfall from its credit line**
and pays. The agent never "decides to borrow" — it just transacts.
([draw](https://stellar.expert/explorer/testnet/tx/b43c09987f4ed41cc43d0386c2202dbfd9e87e80834e70cafd206080628f409e))

## How it works

```
 revenue sources          the underwriter (off-chain)         on-chain rulebook (Soroban)
┌──────────────────┐     ┌───────────────────────────┐      ┌──────────────────────────┐
│ Stellar x402 USDC│──►  │ indexer → independence →   │ ──►  │ score_registry           │
│ Stripe (zkTLS)   │     │ scoring → signer           │      │ credit_line (limit/APR)  │
└──────────────────┘     └───────────────────────────┘      │ lending_vault (isolated) │
        ▲                          signs the score           └──────────────────────────┘
        │                                                              ▲
   agents earn                                        agent SDK: register/borrow/repay,
   over x402                                          payWithCredit (draw-on-402)
```

1. **Earn** — the agent gets paid in USDC over x402; the indexer reads those SAC
   transfer events as revenue.
2. **Underwrite** — the engine checks **counterparty independence** (anti-Sybil),
   scores the agent, and signs the result.
3. **Publish** — the signed score goes on-chain; `credit_line` derives limit + APR.
4. **Borrow / repay** — lenders fund an agent's isolated vault; the agent draws and
   repays autonomously. Repaid interest becomes lender yield.

## What's deployed (Stellar testnet)

| Contract | ID |
|---|---|
| `score_registry` | `CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX` |
| `credit_line` | `CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO` |
| `lending_vault` | `CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3` |

Full list (including superseded IDs kept as standing evidence) in
[`docs/contracts.md`](docs/contracts.md). Settlement is real USDC (SAC).
Off-chain revenue is proven via **Reclaim zkTLS** verified on a Soroban
verifier (`CA3EMXR6…`). x402 payments settle through the **OpenZeppelin
Channels** facilitator.

## What's deployed (Stellar mainnet)

Same three contracts, same code, deployed for real on mainnet — settling in
Circle's actual mainnet USDC, not a testnet stand-in. **Not yet wired to the
live product/backend** (that's still testnet-only while the mainnet lender
side is built out), so treat this as "the primitive is real on mainnet,"
not "the app runs on mainnet."

| Contract | ID |
|---|---|
| `score_registry` | [`CAHWYFLMQI6BBOL6ZLZRRINCK6KVBX73ACH7LCPB24WDED4LSMCI7YZC`](https://stellar.expert/explorer/public/contract/CAHWYFLMQI6BBOL6ZLZRRINCK6KVBX73ACH7LCPB24WDED4LSMCI7YZC) |
| `credit_line` | [`CDK7S4UWY227FHFKDSV37DGT7AIJ5Z2QEYO5AY456M7RBGJN25WYJVGC`](https://stellar.expert/explorer/public/contract/CDK7S4UWY227FHFKDSV37DGT7AIJ5Z2QEYO5AY456M7RBGJN25WYJVGC) |
| `lending_vault` | [`CAE5C5UJYVED5DAVY4YKYT6E2C4NBZCIUBAK2MXGKGLKZESBBXKFPZ4U`](https://stellar.expert/explorer/public/contract/CAE5C5UJYVED5DAVY4YKYT6E2C4NBZCIUBAK2MXGKGLKZESBBXKFPZ4U) |

- **Token:** mainnet USDC SAC `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`
  (derived from Circle's official issuer `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`).
- **Loan term:** 30 days. **Deposit cap:** $100 per agent vault (conservative
  for a fresh mainnet launch; admin-adjustable via `set_deposit_cap`).
- **Admin:** the deployer wallet. **Score signer:** a dedicated mainnet
  keypair, separate from the deployer, funded and ready to sign attestations.

## The moat: counterparty independence

zkTLS proves revenue is *real*; it does not prove it's *independent*. An operator
can loop their own wallets or fund their own Stripe. Fianza's defensible IP is
the **independence model** — framed as economic security: make faking $1 of counted
revenue cost more than the credit it unlocks. It's a real model today (payer age,
external diversity, funding-source independence, reciprocity, and a concentration
cap), not just loop detection — proven against a synthetic attack catalog and a
live on-chain circular-funding attacker. See [`docs/sybil-model.md`](docs/sybil-model.md).

## Why Stellar

Not chain-agnostic — Stellar-native. Soroban (Rust/WASM) contracts, first-class
USDC via the SAC, **x402 on Stellar** (near-zero fees, ideal for indexing
micro-revenue), and **Reclaim zkTLS with a live Soroban verifier**. The roadmap's
zkML step maps onto Soroban's native BLS12-381 host functions (CAP-0059).

## The agent SDK

Credit for an agent, in a few lines — [`@fianza/agent-sdk`](packages/agent-sdk-fianza)
(the JS/TS SDK was published as `@trustline-agents/agent-sdk` before the rename;
that package keeps working as-is for existing integrations — new work happens
under the Fianza name):

```bash
npm install @fianza/agent-sdk
```

```ts
const tl = new FianzaAgent(secret, { apiBaseUrl });
await tl.onboard();                         // register + underwrite
const { limitUsdc } = await tl.creditLine();
await tl.borrow(5); /* ...work... */ await tl.repay(5);
await tl.payWithCredit(url, 3);             // draw-on-402: credit, invisible
```

New to Fianza? [`docs/onboarding-kit.md`](docs/onboarding-kit.md) walks
through funding a testnet agent (XLM, USDC trustline, the Fianza faucet)
and running this exact loop end to end. Full method-by-method reference in
[`docs/sdk-reference.md`](docs/sdk-reference.md).

## Repo structure

```
contracts/   Soroban contracts — score_registry, credit_line, lending_vault, revenue_math
backend/     underwriting engine (TS/Fastify) — indexer, independence, zktls, scoring, signer, API
packages/    @fianza/agent-sdk — the agent-facing SDK (agent-sdk-fianza/); older
             @trustline-agents/agent-sdk (agent-sdk/) kept published & untouched for existing integrations
frontend/    Next.js dashboards (borrower + lender) + landing + docs site
agents/      the live agent fleet (Scout, DataCo, Analyst, Reviewer) — real, working examples
spikes/      validated de-risking spikes (x402 payer, Reclaim zkTLS)
docs/        full documentation — see docs/README.md
```

## Run it locally

```bash
# contracts (native Linux toolchain)
cd contracts && stellar contract build && cargo test

# backend underwriting API (:8787)
cd backend && npm i && npm run dev

# frontend (:3100)
cd frontend && npm i && npm run dev
```

The dashboards connect a Stellar wallet (Freighter) to the deployed contracts.
Full architecture, addresses, and the demo runbook are in

## Roadmap and honest status

Full, current roadmap — what's shipped, in progress, next up, and explicitly
deferred until testnet is proven out — lives in
[`docs/roadmap.md`](docs/roadmap.md). Short version: the core loop, the
credit-risk engine, and the independence model are real and tested. The contracts
are deployed on **mainnet** and have run a full borrow/repay loop in real USDC —
small amounts, one agent, and scores published manually, since there is no live
mainnet underwriting engine yet. What is still missing is scale and a real
adversary: the underwriter remains a single trusted signer (v1, with a documented
decentralization path), and external adoption is early — one third-party
integration (Nebula's MCP server) and a handful of agents. Named openly, not hidden.

## License

MIT. Testnet software; not financial advice.
