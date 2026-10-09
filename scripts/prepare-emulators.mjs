import { createRequire } from "node:module";
import { existsSync, createReadStream, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const {
  getDownloadDetails,
} = require("firebase-tools/lib/emulator/downloadableEmulators.js");
for (const name of ["firestore", "database", "storage"]) {
  const details = getDownloadDetails(name);
  if (!existsSync(details.downloadPath))
    execFileSync("pnpm", ["exec", "firebase", `setup:emulators:${name}`], {
      stdio: "inherit",
    });
  const hash = createHash("md5");
  for await (const chunk of createReadStream(details.downloadPath))
    hash.update(chunk);
  if (
    statSync(details.downloadPath).size !== details.opts.expectedSize ||
    hash.digest("hex") !== details.opts.expectedChecksum
  )
    throw new Error(
      `Invalid ${name} artifact: remove the cached file and reinstall with Firebase CLI`,
    );
  console.log(`Verified Firebase CLI-pinned ${name} artifact`);
}
