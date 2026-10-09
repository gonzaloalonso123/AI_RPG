import { beforeAll, describe, it, expect } from "vitest";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.GCLOUD_PROJECT = "demo-story-master";
if (!getApps().length) initializeApp({ projectId: "demo-story-master" });
const db = getFirestore();
let alice: { token: string; uid: string },
  bob: { token: string; uid: string },
  mallory: { token: string; uid: string },
  cid: string;
async function identity() {
  const r = await fetch(
    "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    },
  );
  const x = await r.json();
  return { token: x.idToken as string, uid: x.localId as string };
}
async function call(
  who: { token: string },
  command: unknown,
  requestId = randomUUID(),
) {
  const r = await fetch(
    "http://127.0.0.1:5001/demo-story-master/europe-west1/command",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + who.token,
      },
      body: JSON.stringify({ data: { command, requestId } }),
    },
  );
  return { status: r.status, data: await r.json() };
}
async function eventually(f: () => Promise<boolean>) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (await f()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("Expected state not reached");
}
beforeAll(async () => {
  [alice, bob, mallory] = await Promise.all([
    identity(),
    identity(),
    identity(),
  ]);
  const result = await call(alice, {
    type: "create",
    name: "Integration test",
    locale: "en",
    capacity: 2,
    difficulty: "standard",
    tone: "mystery",
  });
  expect(result.status).toBe(200);
  cid = result.data.result.campaignId;
  await call(bob, { type: "join", code: result.data.result.code });
  for (const [u, name] of [
    [alice, "Alice"],
    [bob, "Bob"],
  ] as const)
    await call(u, {
      type: "character",
      campaignId: cid,
      name,
      description: "A curious ranger",
      petName: "Mist",
    });
  await call(alice, { type: "control", campaignId: cid, operation: "start" });
});
describe("Admin SDK command authorization and durable coordinator", () => {
  it("rejects a nonmember even though Admin SDK bypasses rules", async () => {
    const r = await call(mallory, {
      type: "submit",
      campaignId: cid,
      version: 0,
      intention: { text: "wait", mentions: [] },
    });
    expect(r.status).toBe(403);
  });
  it("duplicate requests commit exactly one shared turn", async () => {
    const a = {
      type: "submit",
      campaignId: cid,
      version: 0,
      intention: { text: "inspect", mentions: [] },
    };
    const id = randomUUID();
    const r = await Promise.all([call(alice, a, id), call(alice, a, id)]);
    expect(r.every((x) => x.status === 200)).toBe(true);
    const bId = randomUUID();
    await Promise.all([call(bob, a, bId), call(bob, a, bId)]);
    await eventually(
      async () =>
        (await db.doc(`campaigns/${cid}`).get()).data()?.version === 1,
    );
    const c = (await db.doc(`campaigns/${cid}`).get()).data()!;
    expect(c.knownClues).toEqual(["cage"]);
    const events = await db.collection(`campaigns/${cid}/events`).get();
    expect(
      events.docs.filter((d) => d.data().kind === "discovery"),
    ).toHaveLength(1);
  });
  it("stale submissions do not mutate state", async () => {
    const r = await call(alice, {
      type: "submit",
      campaignId: cid,
      version: 0,
      intention: { text: "take", mentions: [] },
    });
    expect(r.status).toBe(400);
    expect((await db.doc(`campaigns/${cid}`).get()).data()?.version).toBe(1);
  });
  it("failed interpretation can be corrected in the same version", async () => {
    for (const u of [alice, bob])
      await call(u, {
        type: "submit",
        campaignId: cid,
        version: 1,
        intention: { text: "a wildly ambiguous request", mentions: [] },
      });
    await eventually(
      async () =>
        (await db.doc(`campaigns/${cid}`).get()).data()?.lastError ===
        "clarification-needed",
    );
    for (const u of [alice, bob]) {
      const r = await call(u, {
        type: "submit",
        campaignId: cid,
        version: 1,
        intention: { text: "wait", mentions: [] },
      });
      expect(r.status).toBe(200);
    }
    await eventually(
      async () =>
        (await db.doc(`campaigns/${cid}`).get()).data()?.version === 2,
    );
  });
  it("does not allow a nonhost to change the story language", async () => {
    const r = await call(bob, {
      type: "language",
      campaignId: cid,
      locale: "es",
    });
    expect(r.status).toBe(400);
  });
  it("host can change story language independently of player interface", async () => {
    const r = await call(alice, {
      type: "language",
      campaignId: cid,
      locale: "es",
    });
    expect(r.status).toBe(200);
    expect((await db.doc(`campaigns/${cid}`).get()).data()?.locale).toBe("es");
  });
  it("failed invitation guesses still consume the rate limit", async () => {
    const statuses = [];
    for (let i = 0; i < 11; i++)
      statuses.push(
        (await call(mallory, { type: "join", code: "ABCDEFGH" })).data.error
          ?.message,
      );
    expect(statuses).toContain("rate-limited");
  });
});
