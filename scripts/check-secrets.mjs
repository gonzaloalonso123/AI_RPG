import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const names = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
let failed = false;
for (const f of names) {
  if (/lock|PRODUCT_SPEC/.test(f)) continue;
  let text;
  try {
    text = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  if (
    /sk-(?:proj-)?[A-Za-z0-9_-]{32,}|-----BEGIN (?:RSA )?PRIVATE KEY-----|"private_key"\s*:\s*"-----/.test(
      text,
    )
  ) {
    console.error("Potential credential in", f);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("No matching credential patterns in repository files.");
