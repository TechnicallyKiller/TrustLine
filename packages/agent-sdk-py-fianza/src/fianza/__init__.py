"""Fianza Agent SDK (Python).

The interface an AI agent uses to take and repay revenue-underwritten credit on
Fianza (Stellar), settled in USDC.

    from fianza import FianzaAgent

    tl = FianzaAgent(secret, api_base_url="https://fianza-5m68.onrender.com")
    tl.register()
    tl.underwrite()
    terms = tl.credit_line()
    tl.borrow(5); tl.repay(5)
"""

from __future__ import annotations

from .agent import (
    FianzaAgent,
    CreditTerms,
    VaultState,
    TxResult,
    TESTNET_PASSPHRASE,
    TESTNET_RPC,
)
from .errors import (
    FianzaError,
    ValidationError,
    ApiError,
    TxError,
    MaxDrawExceededError,
)
from .util import (
    to_stroops,
    from_stroops,
    is_valid_stellar_address,
    credit_shortfall_usdc,
)

__version__ = "0.1.0"

__all__ = [
    "FianzaAgent",
    "CreditTerms",
    "VaultState",
    "TxResult",
    "TESTNET_PASSPHRASE",
    "TESTNET_RPC",
    "FianzaError",
    "ValidationError",
    "ApiError",
    "TxError",
    "MaxDrawExceededError",
    "to_stroops",
    "from_stroops",
    "is_valid_stellar_address",
    "credit_shortfall_usdc",
    "__version__",
]
