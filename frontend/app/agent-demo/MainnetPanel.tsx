"use client";

// MainnetPanel — the honest, manual counterpart to the testnet LLM-agent loop.
// There is no live mainnet agent-server/indexer (no real mainnet agent
// revenue exists yet to underwrite against), so this doesn't simulate a
// conversation — it's a real control panel: check the agent's live mainnet
// credit line, then trigger a REAL signed borrow()/repay() against the
// backend's /mainnet/* routes. Every action here moves real USDC.

import { useCallback, useState } from "react";
import { AlertTriangle, ExternalLink, Loader2, RefreshCw, Wallet } from "lucide-react";

const BACKEND =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://fianza-5m68.onrender.com";
const MAINNET_EXPLORER = (h: string) => `https://stellar.expert/explorer/public/tx/${h}`;
const CONTRACT_EXPLORER = (id: string) => `https://stellar.expert/explorer/public/contract/${id}`;

interface MainnetConfig {
  network: string;
  scoreRegistryContractId: string;
  creditLineContractId: string;
  lendingVaultContractId: string;
  usdcSac: string;
  agentConfigured: boolean;
  agent: string | null;
}

interface CreditInfo {
  agent: string;
  tier: string | number;
  limitUsdc: number;
  aprBps: number;
  vault: {
    liquidityUsdc: number;
    principalUsdc: number;
    amountOwedUsdc: number;
    availableCreditUsdc: number;
  } | null;
}

const MAX_ACTION_USDC = 0.5;

export default function MainnetPanel() {
  const [config, setConfig] = useState<MainnetConfig | null>(null);
  const [credit, setCredit] = useState<CreditInfo | null>(null);
  const [loadingCredit, setLoadingCredit] = useState(false);
  const [amount, setAmount] = useState("0.05");
  const [acting, setActing] = useState<"borrow" | "repay" | null>(null);
  const [lastTx, setLastTx] = useState<{ action: string; hash: string; amountUsdc: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingCredit(true);
    setError(null);
    try {
      const cfg: MainnetConfig = await fetch(`${BACKEND}/mainnet/config`).then((r) => r.json());
      setConfig(cfg);
      if (cfg.agent) {
        const info: CreditInfo = await fetch(`${BACKEND}/mainnet/agent/${cfg.agent}/credit`).then((r) =>
          r.json(),
        );
        setCredit(info);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCredit(false);
    }
  }, []);

  const act = useCallback(
    async (action: "borrow" | "repay") => {
      const amountUsdc = Number(amount);
      if (!(amountUsdc > 0)) {
        setError("enter a positive amount");
        return;
      }
      setActing(action);
      setError(null);
      try {
        const res = await fetch(`${BACKEND}/mainnet/agent/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amountUsdc }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `${action} failed (${res.status})`);
        setLastTx({ action, hash: body.txHash, amountUsdc: body.amountUsdc });
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setActing(null);
      }
    },
    [amount, refresh],
  );

  return (
    <div className="tl-anim-fadeup mx-auto max-w-2xl">
      {/* honest framing */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-flare/25 bg-flare/[0.06] p-4">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-flare" />
        <div className="font-tl-sans text-[13px] leading-[1.6] text-ash">
          <p className="mb-1 font-semibold text-bone">Real Stellar mainnet. Real USDC.</p>
          <p>
            This isn&apos;t a simulated agent conversation — there&apos;s no live
            mainnet revenue yet to underwrite against, so this is a direct control
            panel over the real, deployed contracts. Every borrow/repay below
            signs and submits an actual transaction, capped at ${MAX_ACTION_USDC}
            {" "}per call.
          </p>
        </div>
      </div>

      {/* contracts */}
      <div className="mb-6 rounded-xl border border-white/[0.08] bg-void/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-tl-mono text-[11px] tracking-[0.14em] text-ion">
            LIVE MAINNET CONTRACTS
          </div>
          <button
            onClick={refresh}
            disabled={loadingCredit}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 font-tl-mono text-[10px] text-ash transition-colors hover:border-ion/40 hover:text-bone disabled:opacity-50"
          >
            {loadingCredit ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            {config ? "refresh" : "load"}
          </button>
        </div>
        {config ? (
          <div className="grid grid-cols-1 gap-1.5 font-tl-mono text-[11px] text-ash sm:grid-cols-2">
            <ContractLink label="score_registry" id={config.scoreRegistryContractId} />
            <ContractLink label="credit_line" id={config.creditLineContractId} />
            <ContractLink label="lending_vault" id={config.lendingVaultContractId} />
            <ContractLink label="USDC (SAC)" id={config.usdcSac} />
          </div>
        ) : (
          <p className="font-tl-sans text-[12px] text-ash/70">
            Click &quot;load&quot; to read live contract config from the backend.
          </p>
        )}
      </div>

      {/* credit + vault state */}
      {credit ? (
        <div className="mb-6 rounded-xl border border-white/[0.08] bg-void/60 p-4">
          <div className="mb-3 flex items-center gap-2 font-tl-mono text-[11px] tracking-[0.14em] text-ion">
            <Wallet size={13} /> AGENT {short(credit.agent)} · LIVE CREDIT LINE
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-tl-mono text-[11px] text-ash sm:grid-cols-4">
            <Stat label="tier" value={String(credit.tier)} />
            <Stat label="limit" value={`$${credit.limitUsdc}`} />
            <Stat label="APR" value={`${(credit.aprBps / 100).toFixed(1)}%`} />
            <Stat
              label="available credit"
              value={credit.vault ? `$${credit.vault.availableCreditUsdc}` : "—"}
            />
            {credit.vault ? (
              <>
                <Stat label="vault liquidity" value={`$${credit.vault.liquidityUsdc}`} />
                <Stat label="principal owed" value={`$${credit.vault.principalUsdc}`} />
                <Stat label="amount owed" value={`$${credit.vault.amountOwedUsdc}`} />
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* actions */}
      <div className="mb-4 rounded-xl border border-white/[0.08] bg-void/50 p-4">
        <div className="mb-3 font-tl-mono text-[11px] tracking-[0.14em] text-ash/70">
          BORROW / REPAY (real signed transaction)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            max={MAX_ACTION_USDC}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-28 rounded-lg border border-white/10 bg-obsidian px-3 py-2 font-tl-mono text-sm text-bone focus:border-flare/60 focus:outline-none"
          />
          <span className="font-tl-mono text-[11px] text-ash">USDC</span>
          <button
            onClick={() => act("borrow")}
            disabled={acting !== null || !config?.agentConfigured}
            className="inline-flex items-center gap-2 rounded-lg border border-flare/40 bg-flare/[0.1] px-4 py-2 font-tl-sans text-sm font-semibold text-flare transition-colors hover:bg-flare/20 disabled:opacity-50"
          >
            {acting === "borrow" ? <Loader2 size={14} className="animate-spin" /> : null}
            Borrow
          </button>
          <button
            onClick={() => act("repay")}
            disabled={acting !== null || !config?.agentConfigured}
            className="inline-flex items-center gap-2 rounded-lg border border-ion/40 bg-ion/[0.1] px-4 py-2 font-tl-sans text-sm font-semibold text-ion transition-colors hover:bg-ion/20 disabled:opacity-50"
          >
            {acting === "repay" ? <Loader2 size={14} className="animate-spin" /> : null}
            Repay
          </button>
        </div>
        {!config?.agentConfigured && config ? (
          <p className="mt-2 font-tl-mono text-[10px] text-ash/60">
            Backend has no mainnet agent key configured — borrow/repay are inert.
          </p>
        ) : null}
      </div>

      {error ? <p className="mb-3 font-tl-mono text-xs text-flare">{error}</p> : null}

      {lastTx ? (
        <div className="rounded-lg border border-white/10 bg-obsidian/70 p-3">
          <a
            href={MAINNET_EXPLORER(lastTx.hash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-tl-mono text-[11px] text-ion hover:text-nectar"
          >
            {lastTx.action} ${lastTx.amountUsdc}: {lastTx.hash.slice(0, 8)}…{lastTx.hash.slice(-6)}
            <ExternalLink size={11} />
          </a>
        </div>
      ) : null}
    </div>
  );
}

function ContractLink({ label, id }: { label: string; id: string }) {
  return (
    <a
      href={CONTRACT_EXPLORER(id)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 hover:text-ion"
    >
      <span className="text-ash/60">{label}:</span> {id.slice(0, 6)}…{id.slice(-4)}
      <ExternalLink size={10} />
    </a>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-ash/60">{label}</span>
      <span className="text-bone">{value}</span>
    </div>
  );
}

function short(a: string) {
  return a ? `${a.slice(0, 4)}…${a.slice(-4)}` : "";
}
