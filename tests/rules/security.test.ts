import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFile } from "node:fs/promises";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-story-master",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: await readFile("firestore.rules", "utf8"),
    },
    database: {
      host: "127.0.0.1",
      port: 9000,
      rules: await readFile("database.rules.json", "utf8"),
    },
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: await readFile("storage.rules", "utf8"),
    },
  });
  await env.withSecurityRulesDisabled(async (c) => {
    await c
      .firestore()
      .doc("campaigns/rules-a")
      .set({ members: ["alice", "bob"] });
    await c
      .firestore()
      .doc("campaigns/rules-b")
      .set({ members: ["mallory"] });
    await c
      .firestore()
      .doc("campaigns/rules-a/events/1")
      .set({ text: "visible outcome" });
    await c
      .firestore()
      .doc("campaigns/rules-a/hidden/world")
      .set({ culprit: "secret" });
    await c
      .firestore()
      .doc("campaigns/rules-a/private/alice")
      .set({ ambitions: ["private"] });
    await c
      .storage()
      .ref("campaigns/rules-a/scene.png")
      .put(new Uint8Array([1, 2, 3]));
  });
});
afterAll(async () => {
  await env?.cleanup();
});
describe("database authorization", () => {
  it("allows member shared state and events", async () => {
    await assertSucceeds(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc("campaigns/rules-a")
        .get(),
    );
    await assertSucceeds(
      env
        .authenticatedContext("bob")
        .firestore()
        .doc("campaigns/rules-a/events/1")
        .get(),
    );
  });
  it("denies nonmembers and unauthenticated readers", async () => {
    await assertFails(
      env
        .authenticatedContext("mallory")
        .firestore()
        .doc("campaigns/rules-a")
        .get(),
    );
    await assertFails(
      env.unauthenticatedContext().firestore().doc("campaigns/rules-a").get(),
    );
  });
  it("denies hidden state even to members", async () => {
    await assertFails(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc("campaigns/rules-a/hidden/world")
        .get(),
    );
  });
  it("denies client canonical writes", async () => {
    await assertFails(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc("campaigns/rules-a")
        .update({ gold: 999 }),
    );
    await assertFails(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc("jobs/fake")
        .set({ kind: "round" }),
    );
  });
  it("keeps ambitions private", async () => {
    await assertSucceeds(
      env
        .authenticatedContext("alice")
        .firestore()
        .doc("campaigns/rules-a/private/alice")
        .get(),
    );
    await assertFails(
      env
        .authenticatedContext("bob")
        .firestore()
        .doc("campaigns/rules-a/private/alice")
        .get(),
    );
  });
  it("allows only own ephemeral presence", async () => {
    await assertSucceeds(
      env
        .authenticatedContext("alice")
        .database()
        .ref("presence/alice/session")
        .set({ online: true, at: 1 }),
    );
    await assertFails(
      env
        .authenticatedContext("bob")
        .database()
        .ref("presence/alice/session")
        .set({ online: false, at: 2 }),
    );
    await assertFails(
      env
        .authenticatedContext("alice")
        .database()
        .ref("presence/alice/session")
        .set({ online: true, at: 1, gold: 999 }),
    );
  });
  it("denies cross campaign assets and all browser uploads", async () => {
    await assertFails(
      env
        .authenticatedContext("mallory")
        .storage()
        .ref("campaigns/rules-a/scene.png")
        .getMetadata(),
    );
    await assertFails(
      Promise.resolve(
        env
          .authenticatedContext("alice")
          .storage()
          .ref("campaigns/rules-a/fake.png")
          .put(new Uint8Array([1])),
      ),
    );
  });
  it("allows members to access private artwork", async () => {
    const metadata = await assertSucceeds(
      env
        .authenticatedContext("alice")
        .storage()
        .ref("campaigns/rules-a/scene.png")
        .getMetadata(),
    );
    expect(metadata.size).toBe(3);
  });
});
