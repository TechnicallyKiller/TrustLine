#!/usr/bin/env python3
# Same trading-research agent (Python) -- now with TrustLine credit.
# Only real change from plain.py: use the SDK's pay_with_credit(). It hits the
# exact same paywall, but instead of dying, it draws the shortfall from its
# credit line (a real on-chain borrow) and pays.
import os
import re
import sys

from stellar_sdk import Keypair  # noqa: F401  (kept for parity/optional use)

from trustline import TrustLineAgent

HERE = os.path.dirname(os.path.abspath(__file__))


def load_env():
    env = {}
    with open(os.path.join(HERE, "..", ".env")) as f:
        for line in f:
            m = re.match(r"^(\w+)=(.*)$", line.strip())
            if m:
                env[m.group(1)] = m.group(2)
    return env


env = load_env()
RESEARCH_URL = os.environ.get("RESEARCH_URL", "http://localhost:3099/research")
PRICE_USDC = float(os.environ.get("ANALYST_PRICE_USDC", env.get("ANALYST_PRICE_USDC", "0.05")))
asset = sys.argv[1] if len(sys.argv) > 1 else "XLM"

tl = TrustLineAgent(
    env["DEMO_AGENT_SECRET"],
    api_base_url=env.get("TRUSTLINE_API") or "https://fianza-3ecj.onrender.com",
)

print(f'[credit-agent] requesting research on "{asset}"...')

res = tl.pay_with_credit(
    RESEARCH_URL,
    PRICE_USDC,
    method="POST",
    json_body={"asset": asset},
)

data = res.json()
print("[credit-agent] paid via credit line, got research:", (data.get("note") or "")[:120] + "...")
