import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
// Firebase CLI currently routes loopback through ProxyAgent even with NO_PROXY.
// Downloads are prepared with the normal proxy during installation; local startup needs no external service.
const env = { ...process.env };
for (const k of [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "http_proxy",
  "https_proxy",
  "ALL_PROXY",
  "all_proxy",
])
  delete env[k];
const args = [
  "emulators:" + (process.argv.includes("--test") ? "exec" : "start"),
  "--project",
  "demo-story-master",
];
if (!process.argv.includes("--test")) {
  if (existsSync(".emulator-data/firebase-export-metadata.json"))
    args.push("--import=.emulator-data");
  args.push("--export-on-exit=.emulator-data");
} else args.push("pnpm test:rules && pnpm test:e2e");
const p = spawn("firebase", args, { env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => p.kill(signal));
p.on("exit", (code) => process.exit(code ?? 1));
