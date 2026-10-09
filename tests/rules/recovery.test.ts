import { beforeAll, it, expect } from "vitest";
import { createRequire } from "node:module";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createCampaign, character } from "../../packages/domain/src/index";
import { randomUUID } from "node:crypto";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "demo-story-master";
process.env.FIREBASE_CONFIG = JSON.stringify({
  projectId: "demo-story-master",
  storageBucket: "demo-story-master.appspot.com",
});
process.env.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
process.env.FUNCTIONS_EMULATOR = "true";
process.env.DAILY_BUDGET_USD = "1";
process.env.SESSION_BUDGET_USD = "1";
process.env.TEXT_RESERVATION_USD = "0.4";
process.env.IMAGE_RESERVATION_USD = "0.5";
let worker: {
  work: (id: string, factory?: () => unknown) => Promise<void>;
  budget: (cid: string, id: string) => Promise<void>;
  settle: (cid: string, id: string, ok: boolean) => Promise<void>;
};
beforeAll(() => {
  if (!getApps().length) initializeApp({ projectId: "demo-story-master" });
  worker = createRequire(import.meta.url)("../../functions/lib/index.cjs");
});
it("duplicate worker delivery and expired lease produce one commit", async () => {
  const id = "recovery-" + randomUUID();
  const c = createCampaign(
    id,
    "a",
    "Recovery",
    "en",
    1,
    "standard",
    "mystery",
    0,
  );
  c.characters.a = character("a", "A", "ranger", "Fox", 42, "en");
  c.phase = "locked";
  c.submitted.a = { text: "inspect", mentions: [] };
  const db = getFirestore();
  await db.doc(`campaigns/${id}`).set(c);
  const jobId = id + "_round_0";
  await db.doc(`jobs/${jobId}`).set({
    campaignId: id,
    kind: "round",
    version: 0,
    sceneVersion: 0,
    status: "running",
    seed: 42,
    fence: 3,
    leaseUntil: 1,
    attempts: 1,
    createdAt: 0,
  });
  await Promise.all([worker.work(jobId), worker.work(jobId)]);
  expect((await db.doc(`campaigns/${id}`).get()).data()?.version).toBe(1);
  expect((await db.collection(`campaigns/${id}/events`).get()).size).toBe(1);
  await worker.work(jobId);
  expect((await db.doc(`campaigns/${id}`).get()).data()?.version).toBe(1);
});
it("concurrent budget reservations cannot overdraw daily or session limits", async () => {
  const cid = "budget-" + randomUUID();
  const jobs = ["a", "b", "c", "d"].map((x) => cid + x);
  const results = await Promise.allSettled(
    jobs.map((id) => worker.budget(cid, id)),
  );
  expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(2);
  const total = (await getFirestore().doc(`usage/${cid}_total`).get()).data()!;
  expect(total.reservedUSD).toBeCloseTo(0.8);
  expect(total.active).toBe(2);
  for (const id of jobs) await worker.settle(cid, id, true);
  expect(
    (await getFirestore().doc(`usage/${cid}_total`).get()).data()?.active,
  ).toBe(0);
});
async function prepareImage() {
  const id = "image-" + randomUUID();
  const c = createCampaign(
    id,
    "a",
    "Image isolation",
    "en",
    1,
    "standard",
    "mystery",
    0,
  );
  c.phase = "collecting";
  c.characters.a = character("a", "A", "ranger", "Fox", 42, "en");
  c.version = 7;
  const ref = getFirestore().doc(`campaigns/${id}`);
  await ref.set(c);
  const jobId = id + "_image";
  const job = getFirestore().doc(`jobs/${jobId}`);
  await job.set({
    campaignId: id,
    kind: "image",
    version: 7,
    sceneVersion: 0,
    status: "done",
    seed: 42,
    fence: 0,
    leaseUntil: 0,
    attempts: 0,
    createdAt: Date.now(),
  });
  const end = Date.now() + 20000;
  while (!(await job.get()).data()?.dispatchedAt) {
    if (Date.now() > end) throw new Error("Emulator dispatcher not ready");
    await new Promise((r) => setTimeout(r, 50));
  }
  await job.update({ status: "pending" });
  return { id, ref, job, jobId };
}
it("image failures never replay mechanics or loot", async () => {
  const { ref, job, jobId } = await prepareImage();
  process.env.AI_MODE = "live";
  try {
    await worker.work(jobId, () => ({
      image: async () => {
        throw new Error("provider timeout");
      },
    }));
    expect((await ref.get()).data()?.version).toBe(7);
    expect((await ref.get()).data()?.imageStatus).toBe("failed");
    expect((await job.get()).data()?.status).toBe("uncertain");
    expect(
      (await getFirestore().collection(`${ref.path}/events`).get()).size,
    ).toBe(0);
  } finally {
    process.env.AI_MODE = "mock";
  }
});
it("a delayed old-scene image is cached but cannot replace current artwork", async () => {
  const { ref, job, jobId } = await prepareImage();
  let release: () => void = () => {};
  let entered: () => void = () => {};
  const started = new Promise<void>((r) => {
    entered = r;
  });
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  process.env.AI_MODE = "live";
  try {
    const running = worker.work(jobId, () => ({
      image: async () => {
        entered();
        await gate;
        return png;
      },
    }));
    await started;
    await ref.update({ sceneVersion: 1, location: "forest", imagePath: null });
    release();
    await running;
    expect((await ref.get()).data()?.imagePath).toBeNull();
    expect((await ref.get()).data()?.version).toBe(7);
    expect((await job.get()).data()?.status).toBe("done");
    expect(
      (await getFirestore().collection(`${ref.path}/assets`).get()).size,
    ).toBe(1);
  } finally {
    release();
    process.env.AI_MODE = "mock";
  }
});
