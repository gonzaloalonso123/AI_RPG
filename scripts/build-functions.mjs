import { build } from "esbuild";
import { mkdir, copyFile } from "node:fs/promises";
await mkdir("functions/lib", { recursive: true });
await build({
  entryPoints: ["functions/src/index.ts"],
  outfile: "functions/lib/index.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  external: [
    "firebase-admin",
    "firebase-admin/*",
    "firebase-functions",
    "firebase-functions/*",
  ],
});
await copyFile('functions/runtime-package.json','functions/lib/package.json');
await copyFile(
  "functions/runtime-package-lock.json",
  "functions/lib/package-lock.json",
);
