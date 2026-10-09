import "./read-env.mjs";
// Read-only staging checks; no resource creation and no credential values in output.
import { execFileSync } from "node:child_process";
import { applicationDefault } from "firebase-admin/app";
import { readFileSync } from "node:fs";
const project = process.env.GCLOUD_PROJECT,
  region = process.env.REGION || "europe-west1";
if (!project || project.startsWith("demo-"))
  throw new Error("Set a real staging GCLOUD_PROJECT explicitly");
let failed = false;
const check = (name, ok) => {
  console.log(`${ok ? "PASS" : "BLOCKED"} ${name}`);
  if (!ok) failed = true;
};
function gcloud(args) {
  return JSON.parse(
    execFileSync("gcloud", [...args, "--project", project, "--format=json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
}
const enabled = new Set(
  gcloud(["services", "list", "--enabled"]).map((x) => x.config.name),
);
for (const api of [
  "cloudfunctions.googleapis.com",
  "run.googleapis.com",
  "firestore.googleapis.com",
  "cloudtasks.googleapis.com",
  "cloudscheduler.googleapis.com",
  "secretmanager.googleapis.com",
  "storage.googleapis.com",
  "eventarc.googleapis.com",
])
  check(api, enabled.has(api));
const database = gcloud([
  "firestore",
  "databases",
  "describe",
  "--database=(default)",
]);
check("Firestore Native mode", database.type === "FIRESTORE_NATIVE");
check("European Firestore location", /^eur|^europe/.test(database.locationId));
const indexes = gcloud([
  "firestore",
  "indexes",
  "composite",
  "list",
  "--database=(default)",
]);
const declared = JSON.parse(
  readFileSync("firestore.indexes.json", "utf8"),
).indexes;
for (const expected of declared)
  check(
    `Index ${expected.collectionGroup}: ${expected.fields.map((f) => f.fieldPath).join(",")}`,
    indexes.some(
      (index) =>
        index.name.includes(
          "/collectionGroups/" + expected.collectionGroup + "/",
        ) &&
        index.state === "READY" &&
        expected.fields.every((f) =>
          index.fields.some(
            (actual) =>
              actual.fieldPath === f.fieldPath &&
              (f.order
                ? actual.order === f.order
                : f.arrayConfig
                  ? actual.arrayConfig === f.arrayConfig
                  : false),
          ),
        ),
    ),
  );
check(
  "Memory vector index",
  indexes.some(
    (index) =>
      index.name.includes("/collectionGroups/memories/") &&
      index.state === "READY" &&
      index.fields.some(
        (f) =>
          f.fieldPath === "embedding" && f.vectorConfig?.dimension === 1536,
      ),
  ),
);
const queue = gcloud([
  "tasks",
  "queues",
  "describe",
  "processJob",
  "--location",
  region,
]);
check("Queue is running", queue.state === "RUNNING");
check(
  "Queue concurrency bounded",
  queue.rateLimits?.maxConcurrentDispatches <= 3,
);
check("Queue retries bounded", queue.retryConfig?.maxAttempts <= 3);
const worker = gcloud([
  "functions",
  "describe",
  "processJob",
  "--gen2",
  "--region",
  region,
]);
check("Node 22 runtime", worker.buildConfig?.runtime === "nodejs22");
check("Function instance cap", worker.serviceConfig?.maxInstanceCount <= 5);
check(
  "Secret binding present",
  worker.serviceConfig?.secretEnvironmentVariables?.some(
    (x) => x.key === "STORY_AI_KEY",
  ),
);
const token = await applicationDefault().getAccessToken();
for (const release of [
  "cloud.firestore",
  `firebase.storage/${process.env.VITE_FIREBASE_STORAGE_BUCKET || project + ".appspot.com"}`,
]) {
  const r = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${project}/releases/${release}`,
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  check(`Rules release ${release}`, r.ok);
}
if (process.env.VITE_FIREBASE_DATABASE_URL) {
  const url = new URL(
    "/.settings/rules.json",
    process.env.VITE_FIREBASE_DATABASE_URL,
  );
  if (
    url.protocol !== "https:" ||
    !/\.firebasedatabase\.app$|\.firebaseio\.com$/.test(url.hostname)
  )
    throw new Error("Expected a Firebase RTDB HTTPS endpoint");
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(15000),
  });
  check("RTDB rules accessible", r.ok);
}
console.log(
  "Manual staging checks still required: email/Google flows, App Check rejection, task invoker IAM, RTDB namespace rules, private Storage CORS, real model access and two-browser play. Rules release existence does not prove rules content matches this checkout.",
);
if (failed) process.exitCode = 1;
