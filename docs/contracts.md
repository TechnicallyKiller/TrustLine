# Contract addresses

**Network:** Stellar Testnet (`Test SDF Network ; September 2015`)
**Soroban RPC:** `https://soroban-testnet.stellar.org`
**Horizon:** `https://horizon-testnet.stellar.org`

Always cross-check against the live `GET /config` on the backend
(`https://fianza-5m68.onrender.com/config`) before sending a transaction — it's
the source of truth the frontend and SDK actually resolve against.

## Current deployment

| Contract | Address | Notes |
|---|---|---|
| `score_registry` | `CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX` | Never redeployed since day one — all agent score history survives every downstream contract upgrade. |
| `credit_line` | `CC4ZAKREYMCDEONIQMSSBYOBFC75LL5NPYVEBRZ5SACHYWLYGK2R7GDO` | Reads score → tier/limit/APR via `revenue_math`. |
| `lending_vault` | `CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3` | Current, safety-rails hardened: admin pause/unpause, per-agent deposit cap, 1,500-step fuzz-tested. Term is a constructor param (currently 300s for fast testnet iteration). |
| Reclaim verifier (zkTLS) | `CA3EMXR6JOOTNP44T3OAJFMMMGKRRETDJKBLZP2RU3SIY4SDFAH54DU5` | Verifies off-chain revenue proofs on-chain. |
| USDC (Soroban SAC) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | The settlement asset, wrapped for Soroban contract calls. |
| USDC issuer (classic asset) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | Same USDC, classic-asset side — used for trustlines and classic payments (e.g. the faucet). |
| Score signer (trusted, v1) | `GCNFNO4A4WPHUNNT3YJ36J4NIW4SV46XNO35Y355TMJF6DVPVXM3KWXF` | The one key that publishes scores to `score_registry` today. See [Roadmap](roadmap.md) for the decentralization plan. |
| Testnet USDC faucet | `GCUVT3UH4JFHAK7APFHU655SY5QC4JQGRWH5NPGUC3RXCIBYH2NTB2UB` | Drips a small one-time amount of testnet USDC to new agents. Deliberately unrelated to any Fianza agent/customer wallet — see the [onboarding kit](onboarding-kit.md#3-get-testnet-usdc) for why. |

## Mainnet deployment (real, not wired to the live app yet)

Same three contracts, same code, deployed for real on Stellar mainnet,
settling in Circle's actual mainnet USDC. **The live product/backend still
runs on testnet** — these are not yet what the app/SDK point at by default.

| Contract | Address |
|---|---|
| `score_registry` | `CAHWYFLMQI6BBOL6ZLZRRINCK6KVBX73ACH7LCPB24WDED4LSMCI7YZC` |
| `credit_line` | `CDK7S4UWY227FHFKDSV37DGT7AIJ5Z2QEYO5AY456M7RBGJN25WYJVGC` |
| `lending_vault` | `CAE5C5UJYVED5DAVY4YKYT6E2C4NBZCIUBAK2MXGKGLKZESBBXKFPZ4U` |
| USDC (Soroban SAC, mainnet) | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| USDC issuer (Circle, official, mainnet) | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` |

Config: 30-day loan term, $100/vault deposit cap (launch-conservative,
admin-adjustable). Verified live end-to-end (registration, score publish,
cross-contract term derivation) with real on-chain transactions — see the
[`/mainnet`](https://fianza.space/mainnet) status page for tx links.

## Superseded (kept for reference — do not build against these)

| Contract | Address | Why it's kept |
|---|---|---|
| `credit_line` (pre-risk-engine) | `CA2HOO3KKDPQB4URKDJGVP4QD57UTCSKA2XN7U76RAN4VATOKXZV4QSV` | Superseded when the credit-risk engine shipped. |
| `lending_vault` (risk-engine, pre-safety-rails) | `CA7QGIAUGENZU3V63CVUT2N56X3ASZ774E3RCAHFZ2WKAQGOCKTDIQOA` | Holds the standing evidence of a real, live adversarial on-chain default run — kept as proof, not active. |
| `lending_vault` (original) | `CD5RQFFYF57MLI3JI2PHUROMYFWLGDB7RPMGIK5JRWAO6NWHEUE3EC6C` | Holds the first agent's (Scout's) historical loan from before the risk engine shipped. |

## Why `score_registry` never moves but the others do

Every score ever published lives in one registry contract, permanently. The
`credit_line` and `lending_vault` contracts, by contrast, get redeployed as
the credit-risk engine and safety rails evolved — each redeploy is a fresh
contract instance, but it re-reads the same permanent score history. This is
deliberate: an agent's track record shouldn't reset just because the pricing
or vault logic improved underneath it.

## x402 excluded addresses

A small set of addresses are never counted as a revenue counterparty by the
independence engine — facilitator/fee-sponsor infrastructure, the vault
contract itself, and the testnet faucet (see
[Sybil / independence model](sybil-model.md) for why funder addresses must be
excluded rather than counted as revenue). The live, current list is always in
`GET /config`'s implied exclude set — check `backend/src/config.ts`'s
`DEFAULT_EXCLUDE` or the deployed `X402_EXCLUDE_ADDRESSES` env var for the
authoritative list.
