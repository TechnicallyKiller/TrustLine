#!/usr/bin/env python3
"""TrustLine agent-sdk (Python) quickstart -- a genuine, runnable end-to-end walk.

Generates a fresh Stellar testnet keypair, funds it (Friendbot XLM + a TrustLine
faucet USDC drip), then runs the real credit loop:

    register -> underwrite -> credit_line -> borrow -> repay

Every step prints its real output so you can see exactly what a from-scratch
agent gets back. Nothing here is mocked -- it hits the live testnet backend.

Usage:
    python examples/quickstart.py

Optional env:
    TRUSTLINE_API   defaults to https://fianza-3ecj.onrender.com
    AGENT_SECRET    reuse an existing funded Stellar secret instead of
                    generating + funding a brand-new one
"""

import json
import os

import requests
from stellar_sdk import Keypair

from trustline import TrustLineAgent

API = os.environ.get("TRUSTLINE_API", "https://fianza-3ecj.onrender.com")
FRIENDBOT = "https://friendbot.stellar.org"


def log(step, msg):
    print(f"\n[{step}] {msg}")


def fund_with_friendbot(public_key):
    res = requests.get(f"{FRIENDBOT}/?addr={public_key}", timeout=60)
    res.raise_for_status()


def main():
    log("1/6", "Setting up a Stellar testnet account...")
    secret = os.environ.get("AGENT_SECRET")
    keypair = Keypair.from_secret(secret) if secret else Keypair.random()
    print(f"  address: {keypair.public_key}")

    if not secret:
        fund_with_friendbot(keypair.public_key)
        print("  funded with 10,000 testnet XLM via Friendbot")

    tl = TrustLineAgent(keypair.secret, api_base_url=API)

    log("2/6", "Opening a USDC trustline (required before any USDC can land here)...")
    cfg = requests.get(f"{API}/config", timeout=90).json()
    print(f"  USDC issuer/SAC: {cfg.get('usdcSac')}")
    print(
        "  -> run: stellar tx new change-trust --source <this-key> --network testnet \\\n"
        '         --line "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"'
    )
    print("  (see the onboarding kit for the full one-liner)")

    log("3/6", "Requesting a one-time testnet USDC drip from the TrustLine faucet...")
    faucet = requests.post(
        f"{API}/faucet", json={"address": keypair.public_key}, timeout=90
    ).json()
    print(f"  {json.dumps(faucet)}")

    log("4/6", "Registering + underwriting (register -> revenue -> score -> publish)...")
    result = tl.onboard(skip_proof=True)
    register, underwrite = result["register"], result["underwrite"]
    print(f"  register tx: {register.tx_hash}")
    score = underwrite["score"]
    print(
        f"  score {score['score']} / tier {score['tier']} / "
        f"limit {score['limitUsdc']} USDC @ {score['aprBps'] / 100}% APR"
    )

    log("5/6", "Reading the live credit line...")
    terms = tl.credit_line()
    print(f"  {terms}")

    if terms.limit_usdc > 0:
        log("6/6", "Borrowing 1 USDC, then repaying it...")
        amount = min(1, terms.limit_usdc)
        borrow_tx = tl.borrow(amount)
        print(f"  borrow tx: {borrow_tx.tx_hash}")
        repay_tx = tl.repay(amount)
        print(f"  repay tx: {repay_tx.tx_hash}")
    else:
        log(
            "6/6",
            "Skipped borrow/repay -- a fresh agent with zero revenue gets a 0 "
            "limit by design (Unrated tier). Earn some real x402 revenue and "
            "re-run tl.underwrite() to see the limit ramp up.",
        )

    print("\nDone. This agent's address for future runs:")
    print(f"  AGENT_SECRET={keypair.secret}")
    print("(save it if you want to keep building on this same agent)")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001
        print(f"\nquickstart failed: {e}")
        raise SystemExit(1)
