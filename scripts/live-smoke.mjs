import "./read-env.mjs";
// Explicitly gated, one bounded text request. Never run in ordinary tests/CI.
if (process.env.STORY_ALLOW_PAID_SMOKE !== "yes")
  throw new Error(
    "Set STORY_ALLOW_PAID_SMOKE=yes only after approving one small API request",
  );
if (!process.env.STORY_AI_KEY || !process.env.TEXT_MODEL)
  throw new Error("Provide STORY_AI_KEY securely and a verified TEXT_MODEL");
const r = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.STORY_AI_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.TEXT_MODEL,
    messages: [{ role: "user", content: "Reply with the single word ready." }],
    max_completion_tokens: 64,
  }),
  signal: AbortSignal.timeout(30000),
});
if (!r.ok)
  throw new Error(`Provider HTTP ${r.status}; inspect account access securely`);
const result = await r.json();
console.log(
  JSON.stringify({
    status: "completed",
    model: result.model,
    usage: result.usage,
    requestId: result.id,
  }),
);
