// The free "brain" — Groq primary, Gemini fallback. $0 real cost, real inference.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

async function askGroq(prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${GROQ_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq: no content in response: ${JSON.stringify(data)}`);
  return text;
}

async function askGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini: no content in response: ${JSON.stringify(data)}`);
  return text;
}

/** Real inference at $0 cost: Groq first, Gemini if Groq errors or rate-limits. */
export async function think(prompt) {
  try {
    return { text: await askGroq(prompt), provider: "groq" };
  } catch (e) {
    console.error("[brain] Groq failed, falling back to Gemini:", e.message);
    return { text: await askGemini(prompt), provider: "gemini" };
  }
}
