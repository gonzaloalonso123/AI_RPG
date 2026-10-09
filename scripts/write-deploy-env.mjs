// Non-secret runtime configuration only. STORY_AI_KEY remains in Secret Manager.
import { writeFileSync } from "node:fs";
const project = process.env.GCLOUD_PROJECT;
if (
  !project ||
  !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(project) ||
  project.startsWith("demo-")
)
  throw new Error("Explicit real project required");
const keys = [
  "AI_MODE",
  "ALLOWED_ORIGINS",
  "DAILY_BUDGET_USD",
  "SESSION_BUDGET_USD",
  "TEXT_RESERVATION_USD",
  "IMAGE_RESERVATION_USD",
];
const lines = keys.map((key) => {
  const value = process.env[key];
  if (!value || /[\r\n\0"\\]/.test(value))
    throw new Error(`Missing or invalid ${key}`);
  return `${key}="${value}"`;
});
writeFileSync(`functions/lib/.env.${project}`, lines.join("\n") + "\n", {
  mode: 0o600,
});
