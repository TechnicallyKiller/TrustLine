# Deploy the demo servers (Render + Hostinger subdomains)

Two servers to deploy on Render, fronted by Hostinger subdomains. Your Hostinger
purchase is a **domain only** (no server hosting) — so Hostinger is used purely
for DNS (CNAMEs pointing at Render). The servers run on Render.

## Why a build command is needed

`agents/demo/*` import the SDK from `../../packages/agent-sdk/dist/index.js`.
That `dist/` folder is **gitignored (not committed)**, so Render must build it
during deploy. The build command below does that.

---

## Step 1 — Render: two new Web Services

Both use the SAME repo and the SAME build command. **Root Directory = blank**
(repo root) so both `packages/` and `agents/` are present.

**Build command (both services):**

```
npm --prefix packages/agent-sdk install && npm --prefix packages/agent-sdk run build && npm --prefix agents install
```

### Service A — data-seller (the paid endpoint the agent buys from)

- **Name:** `trustline-data-seller`
- **Start command:** `node agents/demo/data-seller.mjs`
- **Env vars:**
  - `OZ_API_KEY` = *(your x402 facilitator key)*
  - `GROQ_API_KEY` = *(free Groq key)*
  - `GEMINI_API_KEY` = *(optional fallback)*
  - `DEMO_HOLDING_PUBLIC` = `GCYTUI46TG2CGOGRC73VBD56KIIQHE46EKZ57SUQGZXHRE6MEXWXMMUI`
  - `DEMO_RESEARCH_PRICE_USDC` = `0.3`

### Service B — agent-server (the LLM tool-loop the UI talks to)

- **Name:** `trustline-agent`
- **Start command:** `node agents/demo/agent-server.mjs`
- **Env vars:**
  - `GROQ_API_KEY` = *(free Groq key)*
  - `GEMINI_API_KEY` = *(optional fallback)*
  - `ANALYST_WALLET_SECRET` = *(the demo agent's secret)*
  - `DEMO_HOLDING_SECRET` = *(the customer/holding wallet secret)*
  - `DEMO_HOLDING_PUBLIC` = `GCYTUI46TG2CGOGRC73VBD56KIIQHE46EKZ57SUQGZXHRE6MEXWXMMUI`
  - `TRUSTLINE_API` = `https://fianza-3ecj.onrender.com`  *(the LIVE backend)*
  - `DEMO_RESEARCH_URL` = `https://trustline-data-seller-cfww.onrender.com/research`
    *(or your branded subdomain from step 2)*
  - `DEMO_JOB_PAYOUT_USDC` = `0.5`
  - `AGENT_CORS_ORIGIN` = `https://<your-frontend-domain>`  *(optional; `*` if unset)*

> Get the secrets from `agents/.env` and `agents/.demo-holding-wallet.local`.
> NEVER paste them anywhere public — only into Render's env var UI.

### Free tier warning
Render free services sleep after ~15 min idle (30–50s cold start). For a live
pitch, either hit both URLs ~1 min before you present, or use a paid instance so
they never sleep. (This is what suspended your old backend.)

---

## Step 2 — Hostinger: branded subdomains (optional but nice)

In hPanel → **DNS / Nameservers** for `0xtrustline.online`, add CNAMEs:

| Type | Name | Points to |
|---|---|---|
| CNAME | `agent` | `trustline-agent.onrender.com` |
| CNAME | `data` | `trustline-data-seller-cfww.onrender.com` |

Then in each Render service → **Settings → Custom Domains**, add
`agent.0xtrustline.online` / `data.0xtrustline.online` so Render issues TLS certs.

If you use the subdomains, update:
- Service B `DEMO_RESEARCH_URL` → `https://data.0xtrustline.online/research`
- Frontend `NEXT_PUBLIC_AGENT_SERVER` → `https://agent.0xtrustline.online`

---

## Step 3 — Frontend

Set on your frontend host (Render/Vercel/wherever the Next app lives):

```
NEXT_PUBLIC_AGENT_SERVER = https://trustline-agent.onrender.com
   (or https://agent.0xtrustline.online)
```

Redeploy the frontend. Open `/agent-demo` — it now talks to the hosted agent.

---

## Verify after deploy

```bash
curl https://trustline-data-seller-cfww.onrender.com/health      # {ok:true,...}
curl https://trustline-agent.onrender.com/info              # {agent,llm,...}
```

Then load `/agent-demo` and run a research request end to end.
