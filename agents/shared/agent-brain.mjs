// agent-brain — a minimal, model-agnostic tool-calling loop.
//
// Unlike brain.mjs (single-shot completion), this drives a real agentic loop:
// the model is given TOOLS, it decides which to call, we execute them, feed the
// results back, and repeat until the model answers with no more tool calls.
//
// Model-agnostic on purpose: it speaks the OpenAI chat-completions + tools wire
// format, which Groq (free, default), xAI/Grok, OpenAI, Together, etc. all
// implement. Point it at any of them with env vars — no code change:
//   LLM_BASE_URL   (default https://api.groq.com/openai/v1)
//   LLM_API_KEY    (default falls back to GROQ_API_KEY)
//   LLM_MODEL      (default llama-3.3-70b-versatile)
// Grok example: LLM_BASE_URL=https://api.x.ai/v1 LLM_API_KEY=xai-... LLM_MODEL=grok-2-latest
//
// The demo defaults to FREE Groq so there's zero billing risk on stage.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

// Providers are tried IN ORDER; the first that succeeds wins. If one 429s
// (rate limit) or errors, we automatically fall through to the next — so a
// Groq daily-cap mid-pitch silently fails over to Gemini instead of dying.
// All are OpenAI-compatible chat-completions + tools endpoints.
//
// A custom LLM_* provider (any OpenAI-compatible host, e.g. Grok/xAI) takes
// priority if configured; then free Groq; then free Gemini's OpenAI shim.
const PROVIDERS = [
  process.env.LLM_API_KEY && {
    name: "custom",
    baseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL || "llama-3.3-70b-versatile",
  },
  process.env.GROQ_API_KEY && {
    name: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
  },
  // Groq's per-model daily cap means the big model can be exhausted while the
  // smaller, cheaper model still has quota (and it burns far fewer tokens/day).
  // A reliable, still-Groq fallback before we leave the provider.
  process.env.GROQ_API_KEY && {
    name: "groq-small",
    baseUrl: "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_SMALL_MODEL || "llama-3.1-8b-instant",
  },
  process.env.GEMINI_API_KEY && {
    name: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
  },
].filter(Boolean);

// For display/reporting: the primary (first) provider.
const PRIMARY = PROVIDERS[0] || { model: "none", baseUrl: "none" };
const BASE_URL = PRIMARY.baseUrl;
const MODEL = PRIMARY.model;

/** One chat call against a specific provider. Throws on non-OK. */
async function chatWith(provider, messages, tools) {
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.4,
      max_tokens: 900,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`${provider.name} ${res.status} (${provider.model}): ${body}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error(`${provider.name}: no message in response: ${JSON.stringify(data)}`);
  return msg;
}

/**
 * One raw chat-completions call with tools, with automatic provider fallback.
 * Tries each provider in order; on failure (429/5xx/network) falls through to
 * the next. Only throws if EVERY provider fails.
 */
async function chat(messages, tools) {
  if (PROVIDERS.length === 0) {
    throw new Error(
      "No LLM key: set GROQ_API_KEY (free at console.groq.com), GEMINI_API_KEY, or LLM_API_KEY.",
    );
  }
  let lastErr;
  for (const provider of PROVIDERS) {
    try {
      return await chatWith(provider, messages, tools);
    } catch (e) {
      lastErr = e;
      console.error(`[brain] ${provider.name} failed (${e.status || "?"}), trying next…`, e.message);
    }
  }
  throw lastErr;
}

/**
 * Run an agentic tool-loop.
 *
 * @param {object}   o
 * @param {string}   o.system     system prompt (the agent's role + how it should think)
 * @param {string}   o.user       the user's request
 * @param {Array}    o.tools      OpenAI tool definitions ({type:'function', function:{name,description,parameters}})
 * @param {object}   o.handlers   { [toolName]: async (args) => resultObject }
 * @param {function} [o.onEvent]  called with streamed events for the UI:
 *                                {type:'thinking', text} | {type:'tool_call', name, args}
 *                                | {type:'tool_result', name, result} | {type:'final', text}
 * @param {number}   [o.maxSteps] safety cap on tool rounds (default 6)
 * @returns {Promise<{final:string, steps:Array}>}
 */
export async function runAgent({ system, user, tools, handlers, onEvent, maxSteps = 6 }) {
  const emit = onEvent || (() => {});
  const messages = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
  const steps = [];

  for (let step = 0; step < maxSteps; step++) {
    const msg = await chat(messages, tools);
    messages.push(msg);

    // The model produced free-text reasoning alongside (or instead of) tool calls.
    if (msg.content && msg.content.trim()) {
      emit({ type: "thinking", text: msg.content.trim() });
    }

    const calls = msg.tool_calls || [];
    if (calls.length === 0) {
      // No tools requested → this is the final answer.
      const final = (msg.content || "").trim();
      emit({ type: "final", text: final });
      return { final, steps };
    }

    // Execute each requested tool and feed results back into the conversation.
    for (const call of calls) {
      const name = call.function?.name;
      let args = {};
      try {
        args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      emit({ type: "tool_call", name, args });

      let result;
      try {
        const handler = handlers[name];
        result = handler
          ? await handler(args)
          : { error: `unknown tool "${name}"` };
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      emit({ type: "tool_result", name, result });
      steps.push({ name, args, result });

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  // Hit the step cap — ask for a final wrap-up with no tools so the arc still closes.
  const wrap = await chat(
    [...messages, { role: "user", content: "Summarize what you did for the user in 2-3 sentences." }],
    [],
  );
  const final = (wrap.content || "Done.").trim();
  emit({ type: "final", text: final });
  return { final, steps };
}

export const llmInfo = {
  baseUrl: BASE_URL,
  model: MODEL,
  hasKey: PROVIDERS.length > 0,
  // The fallback chain, primary first (e.g. ["groq", "gemini"]).
  providers: PROVIDERS.map((p) => p.name),
};
