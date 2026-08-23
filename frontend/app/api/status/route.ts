// GET /api/status — server-side health checks for the /status page.
//
// Why server-side: the browser-side version made 5 cross-origin requests to
// *.onrender.com, which privacy browsers (Brave Shields, Firefox strict, ad-
// blockers) block as suspected third-party trackers — showing a false "down"
// even though the services are up. By pinging from OUR server and serving the
// result same-origin (/api/status), the browser makes ONE same-origin request
// that no shield blocks. Server-to-server has no CORS and no shields at all.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // never cache — always live
export const revalidate = 0;

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://fianza-5m68.onrender.com";
const AGENT_SERVER =
  process.env.NEXT_PUBLIC_AGENT_SERVER ?? "https://fianza-1-cxmh.onrender.com";
const DATA_SELLER =
  process.env.NEXT_PUBLIC_DATA_SELLER ?? "https://fianza-2.onrender.com";
const SOROBAN_RPC = "https://soroban-testnet.stellar.org";

async function fetchT(url: string, init: RequestInit = {}, ms = 9000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

async function getOk(url: string): Promise<boolean> {
  try {
    return (await fetchT(url)).ok;
  } catch {
    return false;
  }
}

async function rpcOk(): Promise<boolean> {
  try {
    const r = await fetchT(SOROBAN_RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
    });
    const j = await r.json();
    return j?.result?.status === "healthy";
  } catch {
    return false;
  }
}

const CHECKS: { key: string; run: () => Promise<boolean> }[] = [
  { key: "backend", run: () => getOk(`${API_BASE}/health`) },
  { key: "portfolio", run: () => getOk(`${API_BASE}/portfolio`) },
  { key: "agent", run: () => getOk(`${AGENT_SERVER}/info`) },
  { key: "seller", run: () => getOk(`${DATA_SELLER}/health`) },
  { key: "rpc", run: () => rpcOk() },
];

export async function GET() {
  const results = await Promise.all(
    CHECKS.map(async (c) => {
      // One retry to ride out a Render cold start.
      let ok = await c.run();
      if (!ok) {
        await new Promise((r) => setTimeout(r, 2500));
        ok = await c.run();
      }
      return [c.key, ok] as const;
    }),
  );
  return NextResponse.json(
    { services: Object.fromEntries(results), checkedAt: Date.now() },
    { headers: { "cache-control": "no-store" } },
  );
}
