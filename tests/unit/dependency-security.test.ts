import { it, expect } from "vitest";
import { createRequire } from "node:module";
const root = createRequire(import.meta.url),
  cli = createRequire(root.resolve("firebase-tools/package.json")),
  watcher = createRequire(cli.resolve("chokidar"));
const braces = watcher("braces") as (s: string) => string[];
it("bounds adversarial glob nesting without breaking ordinary file patterns", () => {
  expect(braces("src/{one,two}.ts")).toEqual(["src/(one|two).ts"]);
  expect(() => braces("{".repeat(4000) + "x" + "}".repeat(4000))).toThrow(
    /safe depth/,
  );
});
