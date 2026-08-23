"""TrustLine Agent SDK (Python).

The interface an AI agent uses to take and repay revenue-underwritten credit on
TrustLine (Stellar), settled in USDC.

    from trustline import TrustLineAgent

    tl = TrustLineAgent(secret, api_base_url="https://fianza-5m68.onrender.com")
    tl.register()
    tl.underwrite()
    terms = tl.credit_line()
    tl.borrow(5); tl.repay(5)
"""

from __future__ import annotations

from .agent import (
    TrustLineAgent,
    CreditTerms,
    VaultState,
    TxResult,
    TESTNET_PASSPHRASE,
    TESTNET_RPC,
)
from .errors import (
    TrustLineError,
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

__version__ = "0.2.0"

__all__ = [
    "TrustLineAgent",
    "CreditTerms",
    "VaultState",
    "TxResult",
    "TESTNET_PASSPHRASE",
    "TESTNET_RPC",
    "TrustLineError",
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
