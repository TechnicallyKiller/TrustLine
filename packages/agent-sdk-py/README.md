# trustline-agent-sdk (Python)

Python SDK for AI agents to take and repay **revenue-underwritten, uncollateralized
USDC credit** on [TrustLine](https://0xtrustline.vercel.app) (Stellar / Soroban).

An agent proves real revenue → TrustLine underwrites it → the agent gets a credit
line it can draw against and repay, all from its own Stellar key. This is the
Python port of the TypeScript [`@trustline-agents/agent-sdk`](../agent-sdk); the
two speak the same backend API and on-chain contracts.

[![PyPI](https://img.shields.io/pypi/v/trustline-agent-sdk.svg)](https://pypi.org/project/trustline-agent-sdk/)

```bash
pip install trustline-agent-sdk
```

## Quickstart

```python
from stellar_sdk import Keypair
from trustline import TrustLineAgent

# An agent holds its own Stellar key.
tl = TrustLineAgent(
    Keypair.random().secret,
    api_base_url="https://fianza-5m68.onrender.com",
)

tl.register()                      # one-time, on-chain
result = tl.underwrite(skip_proof=True)   # backend scores + publishes on-chain
print(result["score"])

terms = tl.credit_line()           # on-chain read (simulate-only)
print(terms)                       # CreditTerms(tier=..., limit_usdc=..., apr_bps=...)

if terms.limit_usdc > 0:
    tl.borrow(1)                   # draw 1 USDC against the line
    # ...do paid work...
    tl.repay(1)                    # interest first (lender yield), then principal
```

A full runnable walkthrough (fresh keypair → Friendbot → faucet → register →
underwrite → borrow → repay) lives in [`examples/quickstart.py`](examples/quickstart.py).

## API

Construct with the agent's secret; contract ids are auto-resolved from the
backend `/config` unless you pass them explicitly.

```python
TrustLineAgent(
    secret,
    *,
    rpc_url=None,               # Soroban RPC (default: testnet)
    network_passphrase=None,    # default: testnet
    api_base_url=None,          # TrustLine backend (default: http://localhost:8787)
    contracts=None,             # {"registry","creditLine","vault"} — else from /config
)
```

**Underwriting (delegated to the backend)**

| method | what it does |
| --- | --- |
| `revenue(from_ledger=None)` | live x402 revenue index for this agent |
| `underwrite(skip_proof=False, from_ledger=None)` | full pass: revenue → proof → score → publish |
| `onboard(skip_proof=False, from_ledger=None)` | `register()` then `underwrite()` |

**On-chain reads (simulate-only)**

| method | returns |
| --- | --- |
| `credit_line()` | `CreditTerms(tier, limit_usdc, apr_bps)` |
| `vault_state()` | `VaultState(liquidity_usdc, principal_usdc, amount_owed_usdc, total_assets_usdc, yield_pool_usdc, limit_usdc, apr_bps)` |
| `available_credit_usdc()` | remaining drawable credit (USDC) |
| `usdc_balance_usdc()` | this agent's spendable USDC |

**On-chain writes (signed by the agent's key)**

| method | what it does |
| --- | --- |
| `register()` | register in the score registry (one-time) |
| `borrow(usdc)` | draw against the credit line |
| `repay(usdc)` | repay (interest → lender yield, then principal) |
| `deposit(agent_address, usdc)` | LP: supply liquidity into another agent's isolated vault |

Each returns a `TxResult(tx_hash, return_value, explorer_url)`.

**Draw-on-402**

```python
resp = tl.pay_with_credit(url, price_usdc, max_draw=None, method="GET")
```

Pay for an [x402](https://x402.org)-priced resource, auto-drawing any shortfall
from the credit line first. The agent never "decides to borrow" — it just
transacts, and the line silently covers what its cash can't. Returns a
`requests.Response`. Pass `json_body=...`, `data=...`, and `headers=...` for POST
bodies. This implements the x402 **exact**-Stellar scheme (SEP-41 transfer,
facilitator-sponsored) directly, so no extra dependency is required.

## Errors

All SDK errors subclass `TrustLineError`:

- `ValidationError` — bad input (amount, address).
- `ApiError` — backend returned non-2xx (`.status`, `.method`, `.path`, `.body`).
- `TxError` — an on-chain tx failed to simulate/submit/confirm (`.contract_method`, `.detail`).
- `MaxDrawExceededError` — `pay_with_credit` would draw past `max_draw` (`.need`, `.max_draw`).

## Pure helpers

`to_stroops`, `from_stroops` (USDC ↔ 7-decimal stroops), `is_valid_stellar_address`,
and `credit_shortfall_usdc` (the draw-on-402 math) are exported and unit-tested.

## Development

```bash
pip install -e ".[dev]"
pytest
```

## License

MIT
