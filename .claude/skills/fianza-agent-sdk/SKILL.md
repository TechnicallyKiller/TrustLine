---
name: fianza-agent-sdk
description: Drive the Fianza agent SDK (JavaScript/TypeScript `@fianza/agent-sdk` or Python `fianza-agent-sdk`) so an AI agent can take and repay revenue-underwritten, uncollateralized USDC credit on Stellar. Covers register -> underwrite -> credit_line -> borrow -> repay, the repayment-driven credit ramp, on-chain vault/credit reads, mainnet vs testnet selection, and payWithCredit / pay_with_credit (draw-on-402: auto-borrow a shortfall then pay an x402-priced API). USDC (SEP-41 SAC), testnet by default. Use when writing an agent (JS/TS or Python) that earns, gets underwritten, and pays for its own inputs on credit.
user-invocable: true
argument-hint: "[language js|py + what to do — onboard / underwrite / borrow / pay an x402 API on credit]"
---

# Fianza Agent SDK

The interface an AI agent uses to take and repay **revenue-underwritten,
uncollateralized USDC credit** on Fianza (Stellar/Soroban). The agent holds
its own Stellar key, so the whole lifecycle is agent-driven — every on-chain
write is signed by the agent, never by Fianza.

**Two SDKs, one surface.** They are ports of each other — same backend API, same
on-chain contracts, same lifecycle. Pick per your agent's language:

| SDK | Package | Import | Style |
|--|--|--|--|
| **JavaScript / TypeScript** | `@fianza/agent-sdk` | `import { FianzaAgent }` | camelCase, options object, `async`/`await` |
| **Python** | `fianza-agent-sdk` | `from fianza import FianzaAgent` | snake_case, keyword args, synchronous |

The one-line thesis: an agent proves real revenue → Fianza underwrites it →
the agent gets a credit line it draws against to pay for its own inputs (APIs,
compute, other agents) and repays as it earns.

## Quick decision — which method

| You want to… | JS/TS | Python |
|--|--|--|
| Register the agent on-chain (one-time) | `tl.register()` | `tl.register()` |
| Score + publish a credit line from revenue | `tl.underwrite({ skipProof: true })` | `tl.underwrite(skip_proof=True)` |
| Do both in one step | `tl.onboard({ skipProof: true })` | `tl.onboard(skip_proof=True)` |
| Read the current credit terms | `tl.creditLine()` | `tl.credit_line()` |
| Read isolated-vault state | `tl.vaultState()` | `tl.vault_state()` |
| See remaining drawable credit | `tl.availableCreditUsdc()` | `tl.available_credit_usdc()` |
| Read spendable USDC balance | `tl.usdcBalanceUsdc()` | `tl.usdc_balance_usdc()` |
| Draw cash against the line | `tl.borrow(usdc)` | `tl.borrow(usdc)` |
| Repay (interest → lender yield, then principal) | `tl.repay(usdc)` | `tl.repay(usdc)` |
| Repay everything owed, in one call | `tl.repayAll()` | — (JS only) |
| Preview live score/limit without writing on-chain | `tl.previewCredit()` | — (JS only) |
| Lend into another agent's vault | `tl.deposit(agentAddress, usdc)` | `tl.deposit(agent_address, usdc)` |
| Pay an x402 API, auto-borrowing any shortfall | `tl.payWithCredit(url, priceUsdc, opts)` | `tl.pay_with_credit(url, price_usdc, ...)` |

- Just getting an agent live → **Onboarding** below.
- Agent needs to pay for an x402 resource it can't fully afford → **Draw-on-402** below.
- Unsure why a fresh agent got a 0 limit → that's correct: zero revenue =
  Unrated tier = 0 limit, by design. Earn real x402 revenue, then re-`underwrite()`.

## Install

**JavaScript / TypeScript**
```bash
npm install @fianza/agent-sdk
# monorepo local dev:  npm --workspace packages/agent-sdk run build
```
Node.js ≥ 18. Depends on `@stellar/stellar-sdk`.

**Python**
```bash
pip install fianza-agent-sdk               # published on PyPI
# monorepo local dev:  pip install -e packages/agent-sdk-py
```
Python ≥ 3.10, `stellar-sdk` (13–15.x) and `requests` (installed automatically).

## Construct

**JavaScript / TypeScript**
```ts
import { FianzaAgent } from "@fianza/agent-sdk";

const tl = new FianzaAgent(secret, {
  apiBaseUrl: "https://fianza-5m68.onrender.com", // the Fianza backend
  // rpcUrl, networkPassphrase,                       // default: testnet
  // contracts: { registry, creditLine, vault },      // else auto-resolved from /config
});
```

**Python**
```python
from fianza import FianzaAgent

tl = FianzaAgent(
    secret,                                              # the agent's S... secret
    api_base_url="https://fianza-5m68.onrender.com",  # the Fianza backend
    # rpc_url=..., network_passphrase=...,               # default: testnet
    # contracts={"registry","creditLine","vault"},       # else auto-resolved from /config
)
```

Contract ids are auto-resolved from the backend `/config` on first use and
cached. Pass `contracts` only to pin them.

## Onboarding (register → underwrite → read line)

**JavaScript / TypeScript**
```ts
await tl.register();                                  // on-chain, one-time
const result = await tl.underwrite({ skipProof: true }); // revenue → score → publish
console.log(result.score);                            // { score, tier, limitUsdc, aprBps, ... }

const terms = await tl.creditLine();                  // simulate-only read
// { tier, limitUsdc, aprBps }
```

**Python**
```python
tl.register()                              # on-chain, one-time
result = tl.underwrite(skip_proof=True)    # revenue → score → publish on-chain
print(result["score"])                     # {'score','tier','limitUsdc','aprBps',...}

terms = tl.credit_line()                   # simulate-only read
# CreditTerms(tier=..., limit_usdc=..., apr_bps=...)
```

`skipProof` / `skip_proof` skips the slow zkTLS off-chain-revenue proof (Reclaim,
~70–90s) — use it for fast on-chain-only scoring. Drop it to also fold in proven
off-chain revenue.

A fresh, zero-revenue agent correctly returns **score 400 / Unrated / limit 0**.
That is the honest result, not a bug.

## Repaying builds credit (v0.2.1+)

`repay()` does two things: it clears the debt on-chain, and it settles that
repayment into the agent's **credit history** in `score_registry`. History is
what drives the *credit ramp* — the enforced limit starts near zero and grows
only as the agent repays, independent of the headline score.

```ts
await tl.borrow(0.10);
await tl.repayAll();        // clears debt AND records the repayment
const { limitUsdc } = await tl.vaultState();  // ramped limit, higher than before
```

Two things follow from this:

- **The vault's `limitUsdc` is the number that matters.** `creditLine()` and
  `previewCredit()` report the underwritten limit; `vaultState().limitUsdc` is
  the *ramped* limit the contract actually enforces. A new agent's ramped limit
  is well below its scored limit — that is the design, not a bug.
- **Settlement is best-effort.** If the backend is unreachable the repayment
  still succeeds on-chain; only the history write is skipped. `repay()` never
  fails because of it.

Use `repayAll()` rather than hand-rolling read-then-repay: it reads the amount
owed and the spendable balance, repays the lesser of the two, and returns
`null` when there is nothing owed or nothing to pay with.

## Mainnet (v0.2.0+)

```ts
const tl = new FianzaAgent(secret, { network: "mainnet" });
```

Sets the mainnet passphrase, contract ids and USDC SAC, and uses a multi-RPC
fallback list because free public mainnet Soroban RPCs are individually flaky.
Reads retry across every endpoint; a submitted transaction stays on the endpoint
that accepted it, so nothing is ever double-submitted.

**What does not work on mainnet yet:** `revenue()` and `underwrite()` throw
immediately. There is no live mainnet indexer or scorer, because there is no
real mainnet agent revenue to underwrite against yet — mainnet scores are
published manually. Read already-published terms with `creditLine()` /
`vaultState()`, and note `repay()` skips history settlement on mainnet for the
same reason. Default is `"testnet"`; existing code is unaffected.

## Draw-on-402 (the headline feature)

`payWithCredit` / `pay_with_credit` fetches an [x402](https://x402.org)-priced
resource and, if the wallet can't cover the price, **draws the shortfall from the
credit line first**, then pays. The agent never "decides to borrow" — it just
transacts.

**JavaScript / TypeScript**
```ts
const res = await tl.payWithCredit(
  "http://localhost:3099/research",
  0.05,                                 // price in USDC (the agent knows what it's buying)
  { maxDraw: 5, init: { method: "POST", body: JSON.stringify({ asset: "BTC" }) } },
);
const data = await res.json();          // returns a fetch Response
```

**Python**
```python
res = tl.pay_with_credit(
    "http://localhost:3099/research",
    0.05,                       # price in USDC (the agent knows what it's buying)
    method="POST",
    json_body={"asset": "BTC"},
    max_draw=None,              # optional cap; raises MaxDrawExceededError if exceeded
)
data = res.json()               # returns a requests.Response
```

Under the hood: `balance < price` → `borrow(shortfall)` on-chain → build + sign
the x402 **exact-Stellar** payment (SEP-41 transfer, agent signs an auth entry
only) → the facilitator settles it → resource returned. No extra dependency: each
SDK reimplements the `@x402/stellar` exact scheme (`fianza/x402.py`, and the
TS `x402` helper).

For selling/paying x402 in general (facilitator setup, seller side, MPP), see the
[`agentic-payments`](../../../.stellar-dev-skill/skills/agentic-payments/SKILL.md)
skill.

## Errors (all extend/subclass `FianzaError`)

**JavaScript / TypeScript**
```ts
import { FianzaError, ValidationError, ApiError, TxError, MaxDrawExceededError }
  from "@fianza/agent-sdk";
```

**Python**
```python
from fianza import (
    FianzaError, ValidationError, ApiError, TxError, MaxDrawExceededError,
)
```

- `ValidationError` — bad input (non-finite/≤0 amount, malformed address). Thrown
  **locally, before any network call**.
- `ApiError` — backend returned non-2xx (`.status`, `.method`, `.path`, `.body`).
- `TxError` — on-chain tx failed to simulate/submit/confirm (`.contractMethod` /
  `.contract_method`, `.detail`).
- `MaxDrawExceededError` — draw-on-402 would draw past the cap (`.need`,
  `.maxDraw` / `.max_draw`).

## Pure helpers (unit-tested, no network)

**JavaScript / TypeScript**: `toStroops`, `fromStroops`, `isValidStellarAddress`, `creditShortfallUsdc`
**Python**: `to_stroops`, `from_stroops`, `is_valid_stellar_address`, `credit_shortfall_usdc`

```python
to_stroops(0.3)                  # 3_000_000  (USDC → 7-decimal stroops)
credit_shortfall_usdc(0.1, 0.3)  # 0.2  (how much to borrow to afford 0.3 with 0.1 on hand)
```

## Runnable examples

- **JS/TS**: `packages/agent-sdk/examples/quickstart.mjs` — fresh keypair →
  Friendbot → faucet → register → underwrite → borrow → repay, live against testnet.
- **Python**: `packages/agent-sdk-py/examples/quickstart.py` — same loop, in Python.
- **Draw-on-402 demo**: `agents/demo/plain.py` vs `agents/demo/with_credit.py` —
  same agent, same paywall; `plain.py` (wallet only) dies when broke,
  `with_credit.py` draws credit and pays. Start the Analyst server first:
  `cd agents/analyst && ANALYST_PORT=3099 ANALYST_PRICE_USDC=0.05 node server.mjs`.

## Common pitfalls (language-agnostic)

**Fresh agent scores 0 / Unrated**
- Not a bug. Zero on-chain (and off-chain) revenue → Unrated tier → 0 limit.
  Earn real x402 revenue, then call `underwrite()` again.

**`borrow` / draw-on-402 fails with SAC error #10 (`resulting balance not within allowed range`)**
- The agent's USDC transfer would go negative — it has no cash and (for a raw pay)
  no credit fallback. Use draw-on-402 (auto-borrows) and confirm the drawable
  credit covers the price. This is exactly what the `plain.py` demo shows.

**SAC error #13 (`trustline entry is missing`)**
- The **recipient** (or the agent) lacks a USDC trustline. Open one before paying
  (`change_trust` for `USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`
  on testnet). See the `agentic-payments` testnet runbook.

**Reads (`creditLine`/`credit_line`, `vaultState`/`vault_state`, balance) raise on a brand-new key**
- They simulate against the agent's account, which must exist on-chain first
  (Friendbot-fund it). Register/onboard after funding.

**Backend cold-start (Render free tier)**
- First request after ~15 min idle wakes the backend (~30–60s). A slow first
  `/config` / `underwrite` is the wake, not a hang.

**Amounts are in USDC, not stroops**
- All SDK method args (`borrow(1)`, `payWithCredit(url, 0.05)`) are human USDC.
  The SDK converts to 7-decimal stroops internally. Only use `toStroops` /
  `to_stroops` if you need raw base units yourself.

## Related skills
- x402 seller/buyer, MPP, facilitator setup → `../../../.stellar-dev-skill/skills/agentic-payments/SKILL.md`
- The Soroban contracts underneath (score_registry / credit_line / lending_vault) → `../../../.stellar-dev-skill/skills/soroban/SKILL.md`
- USDC trustlines and classic assets → `../../../.stellar-dev-skill/skills/assets/SKILL.md`
