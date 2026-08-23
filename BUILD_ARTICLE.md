# Road to SCF #45: credit for AI agents that earn

**Fianza — uncollateralized USDC credit for AI agents, underwritten by revenue, on Stellar.**

---

We applied to the Stellar Community Fund once before, as TrustLine, and didn't
get through. Then we found out an already-funded project had the same name, so we
renamed everything — docs, packages, every link.

We kept building. In the months since: three contracts deployed to mainnet, a
real default triggered and absorbed on-chain, SDKs published, and 3rd place at
Stellar BuildStation, Delhi edition. We're now through to submit for SCF #45.

This is what got built in between, and what we're asking the round to fund.

## Where this started

Agents became economic participants sometime in the last eighteen months and
nobody updated the lending stack.

They sell research, data and inference. They get paid in USDC over x402 rails —
119M transactions on Base and 35M on Solana as of March 2026, roughly $600M
annualised. Real income, real counterparties, no human in the loop.

None of it is borrowable against.

| Signal | Number | Source |
|---|---|---|
| Stellar DeFi TVL | $786M across 15 protocols | DefiLlama, Jul 2026 |
| Anchor lending protocol | Blend, ~$138.7M TVL — collateralized | DefiLlama |
| Monthly-active developers | 3,833, up 208% YoY | Electric Capital, Jul 2026 |

So there is a large capital base on Stellar, a fast-growing developer base, and
no way for an agent to convert income into working capital. A bank won't
underwrite a process. Collateralized DeFi wants $150 to lend $100, which is
useless to a borrower whose defining trait is real income and no capital.

The concrete failure looks like this: an agent that reliably earns $5 for a task
requiring a $2 data purchase is profitable, and stops dead if its balance is
below $2 when the work arrives. That's the gap we started building into.

## The decision that shaped everything else

There were easier ways to do this and we didn't take them.

You could score wallet history — transaction count, protocol interactions, asset
holdings. Several systems do. It measures *activity*, and activity costs nothing
to manufacture. A score that can be farmed is not an underwriting signal.

You could require collateral, which defeats the entire premise. You could KYC the
operator, which kills the autonomy that makes an agent worth lending to. Or you
could read an agent's inflows and lend against them directly, which is insolvent
by construction — an attacker fabricates revenue, draws the line, and walks.

We built the independence model instead.

The hard question is not *how much did this agent earn*. It's *is this revenue
genuine third-party economic activity, or an operator paying themselves from
wallets they control?* At the ledger level those are identical. Both are valid
transfers of real value. The distinguishing fact — common control — is not
observable.

So we stopped trying to prove independence and started pricing it. Every payer
gets a weight, the product of four factors: how old the account is, how many
external counterparties it deals with excluding this agent and its co-payers,
whether its funding traces back to the agent within three hops of the transfer
graph, and how much the agent paid *back* to it. Multiply, cap any single payer's
share, penalise concentration with a normalised HHI, and what survives is
*effective independent revenue*. That figure, never raw inflows, is what sizes a
credit line.

The output is a discount, not a verdict. That distinction is the whole design. A
binary classifier has a decision boundary an attacker can probe and cross. A
continuous discount means that as a fabricated construction approaches
indistinguishability from real revenue, its cost approaches that of real revenue.

The protocol is solvent if faking $1 of *counted* revenue costs more than the
credit it unlocks. Everything above exists to push the left side of that
inequality up.

That cost us months. It is also the only part of this that isn't standard
engineering.

## The second decision: isolation over efficiency

Each agent gets its own vault. A lender doesn't deposit into a protocol-wide
pool — they deposit against a specific borrower and hold shares in that vault
alone.

This is deliberately capital-inefficient. A shared pool spreads yield and
requires less work from each lender. It also spreads *loss*, and for a borrower
class where high default rates are expected rather than exceptional, that's the
wrong trade this early.

February 2026 made the argument for us. The YieldBlox DAO pool — running on
Blend V2 — was drained of roughly $10M through oracle manipulation of an illiquid
USTRY/USDC market on SDEX. The attack emptied that pool completely. Every other
Blend pool, isolated from it, was untouched. The blast radius was exactly one
pool because the architecture confined it there.

We take that further: isolation per *borrower*, not per market.

## What we built

Three Soroban contracts, deployed on both networks, settling in USDC via its
SEP-41 contract interface.

| Contract | What it does | Mainnet address |
|---|---|---|
| `score_registry` | Signed scores, tiers, repayment history | `CAHWYFLM…SMCI7YZC` |
| `credit_line` | Derives limit and APR from a published score | `CDK7S4UW…N25WYJVGC` |
| `lending_vault` | Custody, shares, borrow/repay, reserve, default | `CAE5C5UJ…SBBXKFPZ4U` |

A shared `revenue_math` library holds every policy constant — tier bands, limit
multiples, APR, the credit ramp, the interest split, utilisation — and compiles
into each contract that needs it. One definition of each credit rule, so the
contract that quotes terms and the contract that enforces them cannot disagree.

Behind them:

| Service | Job |
|---|---|
| Indexer | SAC transfer events over Soroban RPC, Horizon deep-history fallback |
| Payment graph | Persistent Postgres graph — 79k payments, 8.5k accounts |
| Independence engine | k-hop funding traversal, per-payer weighting, HHI |
| Scorer + signer | Composite score, signed attestation, published on-chain |
| zkTLS verifier | Reclaim proofs of off-chain income, verified on a Soroban contract |

Underwriting itself is off-chain — the graph traversal is heavy and iterative and
a poor fit for on-chain execution. But its *output* is on-chain and its *inputs*
are public, so any third party can recompute a published score from ledger data
and catch a dishonest underwriter. Trust is minimised by verifiability rather
than by execution location.

## How a loan actually works

1. The agent registers itself in `score_registry`. One transaction, its own key.
2. The indexer reads its USDC receipts. The independence engine discounts them.
3. The scorer bands the result into a tier — A, B, C or Unrated — which fixes
   both the limit multiple (3×, 2×, 1×, 0) and the base APR (6%, 8.5%, 12%).
4. A lender deposits USDC into that agent's isolated vault and receives shares.
5. The agent borrows. The vault independently re-derives the limit from the
   registry rather than trusting the caller.
6. It repays. Interest splits 20% to a first-loss reserve, 80% to lender yield.
   The repayment enters its credit history, which lifts the ramp.

The ramp is the part that matters most. A score says what an agent *could*
support; it says nothing about whether it repays. So the enforced limit starts at
15% of the sized limit and grows 15% per on-time repayment, falling 30% per miss.
A cold agent, however well scored, draws a small fraction of its ceiling. Trust
is earned linearly and lost at twice the rate.

That's also the defence against an agent that silently changes. An agent is a
black box — its model can be swapped, its prompt altered, its market can move —
and no underwriting model predicts that. Ours doesn't try. It bounds exposure at
every moment and lets history move the bound. A degrading agent shows up as a
ramp that stops advancing, well before it shows up as a large default.

## And when it doesn't pay

If principal is outstanding past the due date, **anyone** can call
`mark_default`. Not us. The operator is not a required participant in loss
recognition and cannot delay it.

The reserve absorbs what it can. The remainder is written off as realised loss —
and because total shares are unchanged while assets fall, the loss socialises
pro-rata through share price automatically, with no iteration over lenders and no
privileged distribution step. Accrued interest is written off, the agent is
frozen, and the miss collapses its ramp.

We ran this live on testnet. Staged an agent with an overdue loan, triggered the
default permissionlessly, watched the reserve draw down and the remainder land on
that vault's lenders exactly as specified.

Plenty of lending protocols will show you a loan working. Fewer will show you a
default working.

## Where Fianza actually stands today

**Shipped and running:**

| | |
|---|---|
| Contracts on mainnet | 3, deployed and verified |
| Mainnet loop | Register, deposit, 6 borrows, 5 repays — real USDC, interest accruing |
| Testnet activity | 225 contract transactions, zero failed |
| A real default | Triggered permissionlessly, reserve drawn, loss socialised on-chain |
| A real attacker | Live circular-funding agent caught and discounted to zero |
| Agents underwritten | 19 |
| Distribution | SDKs on npm and PyPI, plus a Claude Code skill |
| Integrations | DeFindex, Tael, Reclaim zkTLS, and Nebula's MCP server |

**Deliberately limited, for now:**

| | |
|---|---|
| Mainnet deposit cap | $100 per vault |
| Lender liquidity | Isolated vaults only — lenders still pick agents by hand |
| Mainnet underwriting | Scores published manually; the engine runs against testnet |
| Score signer | A single key, with a documented path to M-of-N |
| Usage | Early. Most agents are ours or a partner's |
| Collusion rings | The known open problem in the independence model |

That second table is the honest half, and it's why the next phase is mostly risk
engineering rather than interface. We audit our own contracts on a schedule and
fix what that turns up before third-party capital is exposed to it — which is
what a closed beta is for.

## What we're building next

We're through to submit for the **SCF #45 Build Award**, Open Track — $81,550
over 20 weeks, 20 deliverables. 54% of it goes into the credit engine.

First, what it does not fund: the three contracts, the independence engine, the
indexer, both SDKs and the existing testnet and mainnet deployments were built
without external funding. None of it is a deliverable and no line item
reimburses completed work. Nothing covers marketing, bounties, legal costs,
liquidity capital or a security audit.

What it does fund:

**A size-weighted ramp and a score-freshness gate**, closing the two defects
above.

**Borrower stake as a junior tranche.** Required stake scales with the ramp
rather than with entry — a cold agent at 15% still posts nothing and borrows
purely on revenue, so uncollateralized entry survives. As the line grows, the
agent locks stake that sits junior to lenders, seized first on default ahead of
the reserve. An attacker's upside becomes the limit minus the stake they forfeit,
so their cost scales with the prize instead of staying flat. This is also the
answer to the collusion-ring gap, and to the operator whose agent quietly gets
worse.

**Repayment out of income rather than intent.** Today repayment depends on the
agent calling `repay()`. Tael's x402 implementation already proves the mechanism:
`splitFee()` routes a marketplace fee as a second atomic leg of the same
settlement transaction. The same primitive routes a repayment leg, so a share of
an agent's income settles to its vault at the moment it is paid.

**Operator-cluster exposure caps.** Every agent is underwritten in isolation
today, so one operator running N agents extracts N × limit while each looks
individually modest. Clustering by shared funding origin and payer sets, with an
aggregate cap enforced on-chain.

**Revenue we currently can't see.** We read x402 and Tael settlements plus
zkTLS-attested off-chain balances, but not MPP — the Machine Payments Protocol
from Stripe and Tempo, x402-compatible but multi-rail across stablecoin, fiat,
cards and Lightning. An agent earning there looks poorer to us than it is.

**Then the rest:** M-of-N score attestation replacing the single signer, a SEP-56
pooled vault so lenders can supply once for diversified exposure, an expanded
adversarial catalog with a red-team harness gating CI, and finally the
underwriting engine itself brought onto mainnet.

## We're building on Stellar, not beside it

Sub-cent fees and five-second finality are not a nice-to-have here. Loans in this
system are often under ten dollars. On a chain where settling one costs more than
the interest it earns, the product does not exist.

Live integrations, three of them with other Stellar teams' infrastructure:

| Integration | What we use it for |
|---|---|
| DeFindex (SCF #28, #32) | Yield on idle lender capital |
| Tael Protocol | Cross-marketplace revenue underwriting and payment |
| Reclaim zkTLS | Off-chain revenue proofs, verified on a Soroban contract |
| Nebula | Fianza credit as native MCP tools — built by their team, not ours |
| Soroban / SEP-41 / USDC | Custody, settlement, the rulebook itself |

That fourth row is the one we weigh most heavily. The first three are
integrations we built into other protocols. Nebula is another team building
Fianza into theirs.

## Who's building it

Two people, both full time.

| | |
|---|---|
| **Divyanshh Kalra** | Founder & CTO. 3 years in Web3, shipping throughout |
| **Kundan Kumar** | Co-Founder & CEO. 5 years in Web3, multichain |

## Check us

| | |
|---|---|
| Live app | https://fianza.space |
| Whitepaper | https://fianza.space/whitepaper |
| Docs | https://docs.fianza.space |
| Code | https://github.com/TechnicallyKiller/Fianza |
| SDK | `npm i @fianza/agent-sdk` · `pip install fianza-agent-sdk` |

---

*Everything above is verifiable. The contracts are public, every transaction is
on-chain, and the model that decides who can borrow is documented — including
the parts of it that don't work yet.*
