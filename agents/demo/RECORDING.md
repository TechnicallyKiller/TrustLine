# Recording the "drag and drop" SDK demo

Goal: show, live and un-faked, that the SDK doesn't just add credit — it
**replaces a hand-rolled x402 payment client** with one import, one
constructor, and one method call.

## Setup (before you hit record)

1. Open the repo in VS Code. Open two files in a **split editor** (right-click
   a tab → "Split Right", or drag a tab to the right half of the window):
   - Left pane: `agents/demo/plain.mjs`
   - Right pane: `agents/demo/snippet-add-credit.mjs`
2. Zoom in (`Cmd/Ctrl` + `+` a few times) so text is readable on camera —
   aim for ~18-20px editor font.
3. In a **third terminal pane** (bottom, out of the main frame), start Analyst:
   ```bash
   cd ~/stellar/agents/analyst && ANALYST_PORT=3099 ANALYST_PRICE_USDC=0.05 node server.mjs
   ```
4. Have a second terminal tab ready (not yet focused) with:
   ```bash
   cd ~/stellar/agents/demo && RESEARCH_URL=http://localhost:3099/research node plain.mjs BTC
   ```
   (Price is $0.05 — matches the demo agent's current real headroom; see
   "Available credit" note at the bottom before you record.)

## The recording, in one continuous take

**0:00 — Run the plain agent.** Switch to the terminal, run the command from
step 4 above. It genuinely tries to pay over x402 (real signed payment
attempt) and genuinely fails — no USDC to send. Prints `payment failed` /
`dead`. Let it sit for a beat; this is a real failure, not a mocked one.

**0:10 — Cut to the editor.** Left pane shows `plain.mjs` top-to-bottom, right
pane shows the snippet. Voiceover: "this agent hand-rolls its own x402
payment client — three imports, a signer, a scheme wrapper. Watch what the
SDK replaces."

**0:15 — Swap block A.** In the left pane, select the 3 x402 imports
(`wrapFetchWithPaymentFromConfig`, `createEd25519Signer`, `ExactStellarScheme`
— 3 lines). Delete them. Drag the single `import { TrustLineAgent }...` line
from the snippet pane into their place.

**0:22 — Swap block B.** Select the `const NETWORK = ...` / `const signer =
...` / `const fetchWithPayment = ...` block (4 lines). Delete it. Drag the
`PRICE_USDC` + `TrustLineAgent(...)` construction block (4 lines) from the
snippet pane into its place.

**0:30 — Swap block C.** Select the whole `try { ... res = await
fetchWithPayment(...) ... } catch (e) { ... }` block plus the
`if (res.status === 402) { ... }` block below it (the entire manual
error-handling chunk). Delete it. Drag the single `const res = await
tl.payWithCredit(...)` block from the snippet pane into its place.

**0:40 — Save (`Cmd/Ctrl+S`).** The file is now functionally identical to
`with-credit.mjs` — same behavior, same credit fallback, far less code.

**0:43 — Run it.** Switch to the terminal, run:
```bash
RESEARCH_URL=http://localhost:3099/research ANALYST_PRICE_USDC=0.05 node plain.mjs BTC
```
Same paywall, same agent — now it prints `paid via credit line, got
research:` and real content.

**Total: ~50 seconds**, all real, nothing faked — every keystroke and every
terminal line is genuine output against live testnet infrastructure.

## Why this is safe to claim as "just drag and drop"

- Three clean swaps, each "select the old block, drop the new one in its
  place" — no logic changes anywhere else in the file.
- The story is honestly *better* than a pure addition: without the SDK you
  need to hand-roll signer + payment-scheme + fetch-wrapper just to pay over
  x402 at all. The SDK replaces all of that, not just bolts credit on top.
- If you'd rather not do live drag-and-drop (mouse drags can look janky on
  screen recordings, especially at 1x speed), the fallback is identical in
  spirit: a code-typing animation tool (VS Code's own macro recorder, or a
  screen-recording tool with speed ramping) showing the same 3 swaps in the
  same order. Whichever you use: don't fake the "it works" part — run it
  live afterward, same as above.

## If you need a clean re-run

`plain.mjs` and `with-credit.mjs` are the reference files — don't drag into
them directly if you want to preserve them for a re-take. Copy first:
`cp plain.mjs scratch.mjs`, drag into `scratch.mjs`, run
`node scratch.mjs BTC` to test.

## Before you record: check available credit

The demo agent's credit line ramps with repayment history and is currently
small (real anti-Sybil design — new agents start at 15% of their tier
ceiling). Check headroom right before filming:

```bash
cd ~/stellar/agents/demo
node -e "
import('@trustline-agents/agent-sdk').then(async ({TrustLineAgent}) => {
  const dotenv = await import('dotenv');
  dotenv.config({ path: '../.env' });
  const tl = new TrustLineAgent(process.env.DEMO_AGENT_SECRET, { apiBaseUrl: process.env.TRUSTLINE_API || 'https://fianza-5m68.onrender.com' });
  console.log('available credit:', await tl.availableCreditUsdc());
  console.log('wallet balance:', await tl.usdcBalanceUsdc());
});
"
```

Wallet balance should read `0` (the broke story) and available credit should
comfortably cover `ANALYST_PRICE_USDC` for as many takes as you plan to
record. If it's thin, either lower the price or top up the vault (see
`setup2.mjs`'s pattern — deposit from an aged wallet, never drain back to a
paying customer).
