import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { build } from "esbuild";
import { createRequire } from "node:module";
if (
  process.env.GCLOUD_PROJECT &&
  !process.env.GCLOUD_PROJECT.startsWith("demo-")
)
  throw new Error("Seed is restricted to demo projects");
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
initializeApp({ projectId: "demo-story-master" });
const db = getFirestore();
const reset = process.argv.includes("--reset");
const ref = db.doc("templates/briarhollow-v1");
const campaignRef = db.doc("campaigns/demo-briarhollow-v1");
if ((await ref.get()).exists && (await campaignRef.get()).exists && !reset) {
  console.log("Seed v1 already present; no changes.");
  process.exit(0);
}
await ref.set({
  schemaVersion: 1,
  name: "The Bell Beneath the Well",
  locales: ["es", "en"],
  seed: 42,
  locations: ["square", "tavern", "market", "inn", "forest", "ruins"],
});
// Bundle the same domain engine used by callable commands, without a second rules implementation.
const bundle = await build({
  entryPoints: ["packages/domain/src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const domainModule = { exports: {} };
new Function("exports", "module", "require", bundle.outputFiles[0].text)(
  domainModule.exports,
  domainModule,
  createRequire(import.meta.url),
);
const { createCampaign, character, hiddenMystery } = domainModule.exports;
if (reset && (await campaignRef.get()).exists) {
  const jobs = await db
    .collection("jobs")
    .where("campaignId", "==", campaignRef.id)
    .get();
  if (jobs.docs.some((d) => ["pending", "running"].includes(d.data().status)))
    throw new Error("Demo has active jobs; wait for them before resetting");
  await db.recursiveDelete(campaignRef);
  for (const job of jobs.docs) await job.ref.delete();
}
const campaign = createCampaign(
  campaignRef.id,
  "demo-alba",
  "Demo · La campana bajo el pozo",
  "es",
  2,
  "gentle",
  "wonder",
  0,
);
campaign.members = ["demo-alba", "demo-bruno"];
for (const [i, name] of ["alba", "bruno"].entries()) {
  const uid = "demo-" + name;
  const account = {
    email: `${name}@story-master.test`,
    password: "StoryMaster-demo42!",
    displayName: name,
    emailVerified: true,
  };
  try {
    await getAuth().getUser(uid);
    await getAuth().updateUser(uid, account);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
    await getAuth().createUser({ uid, ...account });
  }
  campaign.characters[uid] = character(
    uid,
    name,
    "Explorador del bosque",
    i ? "Luna" : "Brasa",
    42 + i,
    "es",
  );
}
campaign.phase = "collecting";
await campaignRef.set(campaign);
await campaignRef.collection("hidden").doc("world").set(hiddenMystery);
for (const uid of campaign.members)
  await campaignRef.collection("private").doc(uid).set({ ambitions: [] });
console.log(
  "Demo v1 seeded with seed 42. Emulator-only accounts: alba@story-master.test and bruno@story-master.test; password: StoryMaster-demo42!",
);
