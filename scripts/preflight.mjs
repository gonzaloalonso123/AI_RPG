import "./read-env.mjs";
import { readFileSync, existsSync } from "node:fs";
const live = process.argv.includes("--live");
const checks = [];
const check = (name, ok) => {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "BLOCKED"} ${name}`);
};
check("Node 22 runtime", process.versions.node.startsWith("22."));
for (const p of [
  "firebase.json",
  "firestore.rules",
  "storage.rules",
  "database.rules.json",
  "pnpm-lock.yaml",
  "functions/runtime-package-lock.json",
])
  check(p, existsSync(p));
const cfg = JSON.parse(readFileSync("firebase.json", "utf8"));
check(
  "Functions deployment uses standalone bundled artifact",
  cfg.functions[0].source === "functions/lib" &&
    cfg.functions[0].runtime === "nodejs22",
);
if (live) {
  const project = process.env.GCLOUD_PROJECT;
  check(
    "Explicit non-demo Firebase project",
    !!project && !project.startsWith("demo-"),
  );
  for (const key of [
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_APP_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_DATABASE_URL",
    "VITE_APPCHECK_SITE_KEY",
  ])
    check(`${key} present`, !!process.env[key]);
  check("Live provider mode", process.env.AI_MODE === "live");
  check("Allowed origins configured",!!process.env.ALLOWED_ORIGINS);
  check("Client project matches deployment project",process.env.VITE_FIREBASE_PROJECT_ID===project);
  for (const key of [
    "DAILY_BUDGET_USD",
    "SESSION_BUDGET_USD",
    "TEXT_RESERVATION_USD",
    "IMAGE_RESERVATION_USD",
  ])
    check(`${key} configured above zero`, Number(process.env[key]) > 0);
  console.log(
    "Remote IAM, enabled APIs, App Check enforcement, queues, billing, indexes and Secret Manager bindings require staging verification described in SETUP.md. Local checks do not prove remote readiness.",
  );
}
if (checks.some((c) => !c.ok)) process.exitCode = 1;
