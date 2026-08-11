# The Autonomous Agent Demo — how to run it

A real LLM-driven agent that, live on Stellar testnet, **checks its credit →
borrows working capital → buys a paid data call → delivers research → gets paid
→ repays**. No terminal for the audience: it's a chat page. Every money-move is
a real testnet transaction with a clickable Stellar Expert link.

**The honest framing** (say this on stage): the agent borrows *to do profitable
work* (working capital), never to speculate. The one stand-in on testnet is the
customer payment — the holding wallet plays the buyer paying for the research.
In production that's a real x402 buyer; the agent's existing $2.96 credit
history is exactly those real payments.

> ⚠️ **PITCH-DAY QUOTA WARNING.** The demo uses free LLM tiers (Groq → Groq
> small → Gemini fallback). All three can exhaust their daily/minute quotas
> after heavy testing, and then BOTH the agent's reasoning AND the data-seller's
> research generation fail with 429 (the research note comes back as an error
> string). The transactions still work — but the text is garbage. Before you
> pitch, either (a) let Groq's daily cap reset (~24h), or (b) add a paid Groq Dev
> key (cheap; no code change — the fallback just uses it). Do NOT rely on a
> hammered free tier during a live pitch.

## The pieces

| Piece | File | What it is |
|---|---|---|
| Chat UI | `frontend/app/agent-demo/page.tsx` | The page you show (`/agent-demo`) |
| Agent server (SSE) | `agents/demo/agent-server.mjs` | Runs the LLM tool-loop, streams events |
| Agent brain | `agents/shared/agent-brain.mjs` | Model-agnostic tool-calling loop (free Groq default) |
| Agent logic + tools | `agents/demo/agent-runtime.mjs` | The 4 tools wired to the SDK |
| Data seller (x402) | `agents/demo/data-seller.mjs` | The paid endpoint the agent buys from ($0.30) |
| Debt reset | `agents/demo/reset-analyst-debt.mjs` | Restore a clean pre-demo state if needed |

**Demo agent** = the ANALYST wallet (`GDJDMZ…`) — it has REAL revenue ($2.96,
5 payers → Tier C, ~$0.44 limit). Its spare cash was swept to a **holding
wallet** (keys in `agents/.demo-holding-wallet.local`, gitignored — do not lose)
so it's short and must draw credit. The holding wallet doubles as the customer.

## Run it locally (3 terminals)

```bash
# 1. the paid data endpoint the agent buys from
cd agents && node demo/data-seller.mjs                       # :3022

# 2. the agent server (LLM + SDK). Point it at the local seller.
DEMO_RESEARCH_URL=http://localhost:3022/research \
  node demo/agent-server.mjs                                 # :3040

# 3. the web UI
cd ../frontend && NEXT_PUBLIC_AGENT_SERVER=http://localhost:3040 npm run dev
# open http://localhost:3000/agent-demo
```

Then type e.g. *"Give me a research note on XLM."* and watch the agent work.

## Requirements

- `agents/.env` → `GROQ_API_KEY` (free at console.groq.com), `OZ_API_KEY`
  (x402 facilitator), `ANALYST_WALLET_SECRET`, `TRUSTLINE_API`
  (**`https://fianza-3ecj.onrender.com`** — the LIVE backend;
  `trustline.onrender.com` is suspended).
- `agents/.demo-holding-wallet.local` → the holding/customer wallet keys.

## Swap the LLM (optional)

Defaults to free Groq. To use Grok/xAI or any OpenAI-compatible provider, set in
`agents/.env` (no code change):

```
LLM_BASE_URL=https://api.x.ai/v1
LLM_API_KEY=xai-...
LLM_MODEL=grok-2-latest
```

## Operator controls (in the UI)

- **Drain agent cash** — sweeps the agent's spare USDC to the holding wallet so
  the *next* run must draw credit (the money moment). You trigger it (a real
  testnet payment) instead of it auto-draining, so you stay in control of demo
  state. Backed by `POST /drain`.
- **The default scenario ("what if it doesn't pay?")** — the honest answer to the
  #1 investor question, shown live. A dedicated **deadbeat** agent
  (`agents/.deadbeat-wallet.local`) is staged with a real overdue loan; one click
  fires the real on-chain `mark_default`: reserve absorbs what it can, the rest is
  a realised loss socialised to lenders (share price drops), and the agent is
  frozen. Backed by `GET /deadbeat` (status) + `POST /default`.

### Staging the default (run ~6 min before you present)

```bash
cd agents && node demo/stage-default.mjs
```

This funds the deadbeat, gives it real revenue from 3 independent payers,
underwrites it, and has it borrow — starting the 5-minute due clock. After ~5
min the loan is overdue and the UI "Trigger default" button lights up. (The
button is disabled until the loan is actually overdue — a real on-chain rule,
not a fake gate.)

## Repeatability

The arc is self-sustaining: each run earns ($0.50) more than it borrows
(~$0.25) and **repays**, so the credit line stays available and the next run
starts clean automatically. Over many runs the agent accumulates profit (cash
drifts up — realistic). If it ever gets *too* flush to need credit, or debt gets
stuck, reset:

```bash
cd agents && node demo/reset-analyst-debt.mjs
```

## Tuning (env, all optional)

- `DEMO_RESEARCH_PRICE_USDC` (default 0.3) — the data-call price
- `DEMO_JOB_PAYOUT_USDC` (default 0.5) — what the customer pays the agent
- `DATA_SELLER_PORT` (default 3022), `AGENT_SERVER_PORT` (default 3040)

## What's real vs staged (for honest Q&A)

- **Real:** the credit line + underwriting, the borrow, the x402 payment for
  data, the repay (interest → lender yield), the limit ramp, every tx hash.
- **Staged (testnet only):** the customer paying the agent for the research —
  because there's no live buyer on testnet. Labeled as such in the UI.
