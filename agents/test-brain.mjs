// Verify both providers actually respond, independently — no assumptions.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".env") });

const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;

async function tryGroq(model) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({ model, messages: [{ role: "user", content: "Say hello in exactly 3 words." }], max_tokens: 20 }),
  });
  const body = await res.text();
  console.log(`Groq [${model}] → HTTP ${res.status}`);
  console.log(body.slice(0, 300));
  return res.ok;
}

async function tryGemini(model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Say hello in exactly 3 words." }] }] }),
  });
  const body = await res.text();
  console.log(`Gemini [${model}] → HTTP ${res.status}`);
  console.log(body.slice(0, 300));
  return res.ok;
}

console.log("=== GROQ ===");
for (const m of ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"]) {
  if (await tryGroq(m)) break;
  console.log("---");
}

console.log("\n=== GEMINI ===");
for (const m of ["gemini-3.6-flash"]) {
  if (await tryGemini(m)) break;
  console.log("---");
}
