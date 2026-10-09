import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldPath } from "firebase-admin/firestore";
const project = process.env.GCLOUD_PROJECT;
if (!project) throw new Error("Set GCLOUD_PROJECT explicitly");
if (!project.startsWith("demo-") && !process.argv.includes("--apply"))
  throw new Error(
    "Review/export staging first, then pass --apply to run the additive migration",
  );
initializeApp({ projectId: project });
const db = getFirestore();
let cursor = null,
  count = 0;
do {
  let q = db.collection("campaigns").orderBy(FieldPath.documentId()).limit(100);
  if (cursor) q = q.startAfter(cursor);
  const page = await q.get();
  if (page.empty) break;
  for (const d of page.docs) {
    await db.runTransaction(async (tx) => {
      const s = await tx.get(d.ref);
      if (s.data().schemaVersion > 1)
        throw new Error("Newer schema requires a newer migrator");
      const missing = {};
      if (!s.data().schemaVersion) missing.schemaVersion = 1;
      if (!s.data().discoveries) missing.discoveries = {};
      if (!s.data().clueSources) missing.clueSources = {};
      if (!s.data().relationships) missing.relationships = {};
      if (!s.data().skirmishes) missing.skirmishes = {};
      if (Object.keys(missing).length) tx.update(d.ref, missing);
    });
    count++;
  }
  cursor = page.docs.at(-1);
} while (cursor);
console.log("Checked campaigns:", count);
