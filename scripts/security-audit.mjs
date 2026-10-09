import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function patchedBraces() {
  const cli = createRequire(require.resolve("firebase-tools/package.json"));
  const watcher = createRequire(cli.resolve("chokidar"));
  const braces = watcher("braces");
  if (braces("{one,two}").length !== 1)
    throw new Error("Unexpected braces API");
  try {
    braces("{".repeat(4000) + "x" + "}".repeat(4000));
  } catch (e) {
    return e instanceof SyntaxError && e.message.includes("safe depth");
  }
  return false;
}
let raw;
try {
  raw = execFileSync("pnpm", ["audit", "--json"], { encoding: "utf8" });
} catch (e) {
  if (!e.stdout) throw e;
  raw = e.stdout;
}
const result = JSON.parse(raw);
let blocked = false;
for (const advisory of Object.values(result.advisories ?? {})) {
  const id = advisory.github_advisory_id;
  const paths = advisory.findings.flatMap((f) => f.paths);
  if (
    id === "GHSA-vfj7-8cjw-p6xm" &&
    paths.every((p) => p.includes("firebase-tools")) &&
    patchedBraces()
  )
    console.log(
      `MITIGATED ${id}: committed, lockfile-hashed depth-bound patch; adversarial input verified.`,
    );
  else if (
    id === "GHSA-8988-4f7v-96qf" &&
    advisory.severity === "moderate" &&
    paths.every((p) => p.includes("firebase-tools"))
  )
    console.log(
      `REVIEWED ${id}: Firebase CLI-only telemetry dependency. Not in deployed Functions/browser code. See SECURITY.md; upstream update remains pending.`,
    );
  else {
    blocked = true;
    console.error(
      `BLOCKED ${id}: ${advisory.module_name} (${advisory.severity})`,
    );
  }
}
// The independently packaged deployment must have no moderate/high/critical advisory.
try {
  execFileSync(
    "npm",
    [
      "audit",
      "--prefix",
      "functions/lib",
      "--omit=dev",
      "--audit-level=moderate",
    ],
    { stdio: "inherit" },
  );
} catch {
  blocked = true;
}
if (blocked) process.exit(1);
console.log(
  "Security gate passed with the specifically documented development-tool findings above.",
);
