import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getFunctions } from "firebase-admin/functions";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { onTaskDispatched } from "firebase-functions/v2/tasks";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { setGlobalOptions } from "firebase-functions/v2";
import { defineSecret } from "firebase-functions/params";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import {
  Command,
  type Campaign,
  type Job,
  type Action,
  type GameEvent,
} from "@story/contracts";
import {
  createCampaign,
  character,
  validateIntention,
  resolveRound,
  interpret,
  assert,
  trade,
  GameError,
  locations,
  hiddenMystery,
} from "@story/domain";
import { Settings, ART_BIBLE } from "@story/config";
import { Provider, assembleContext, validAsset } from "@story/ai";
initializeApp();
const db = getFirestore();
const emulator = process.env.FUNCTIONS_EMULATOR === "true";
const region = process.env.REGION || "europe-west1";
const apiKey = defineSecret("STORY_AI_KEY");
setGlobalOptions({
  region,
  maxInstances: 5,
  memory: "256MiB",
  timeoutSeconds: 120,
});
const settings = () => Settings.parse(process.env);
const safeId = (s: unknown) =>
  typeof s === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(s);
function invitation() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(8), (x) => alphabet[x % alphabet.length]).join(
    "",
  );
}
const invitationHash = (code: string) =>
  createHash("sha256").update(code).digest("hex");
const makeJob = (c: Campaign, kind: Job["kind"], seed: number): Job => ({
  campaignId: c.id,
  kind,
  version: c.version,
  sceneVersion: c.sceneVersion,
  status: "pending",
  seed,
  fence: 0,
  leaseUntil: 0,
  attempts: 0,
  createdAt: Date.now(),
});
export const command = onCall(
  {
    enforceAppCheck: !emulator,
    cors: emulator ? true : (process.env.ALLOWED_ORIGINS?.split(",") ?? false),
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in first");
    if (!emulator && !request.auth.token.email_verified)
      throw new HttpsError("permission-denied", "Verify your email");
    if (!emulator && settings().AI_MODE !== "live")
      throw new HttpsError(
        "failed-precondition",
        "Configure live mode before using the deployed backend",
      );
    const parsed = Command.safeParse(request.data?.command);
    const requestId = request.data?.requestId;
    if (!parsed.success || !safeId(requestId))
      throw new HttpsError("invalid-argument", "Invalid command");
    const cmd = parsed.data;
    const uid = request.auth.uid;
    const now = Date.now();
    const id = "campaignId" in cmd ? cmd.campaignId : randomUUID();
    if (!safeId(id))
      throw new HttpsError("invalid-argument", "Invalid campaign");
    const code = invitation();
    const seed = randomBytes(4).readUInt32LE();
    try {
      await db.runTransaction(async (tx) => {
        const ref = db.doc(`rates/${uid}`);
        const s = await tx.get(ref);
        const window = Math.floor(now / 60000);
        const count = s.data()?.window === window ? s.data()!.count : 0;
        assert(count < (cmd.type === "join" ? 10 : 60), "rate-limited");
        tx.set(ref, { window, count: count + 1 });
      });
      if (cmd.type === "delete") {
        await db.runTransaction(async (tx) => {
          const ref = db.doc(`campaigns/${id}`),
            deletion = db.doc(`deletions/${id}`);
          const [s, old] = await Promise.all([tx.get(ref), tx.get(deletion)]);
          if (old.exists) {
            assert(old.data()!.host === uid, "permission-denied");
            return;
          }
          const c = s.data() as Campaign;
          assert(c?.host === uid, "permission-denied");
          assert(!["locked", "resolving"].includes(c.phase), "round-busy");
          tx.update(ref, { phase: "archived" });
          tx.create(deletion, {
            campaignId: id,
            host: uid,
            status: "pending",
            createdAt: now,
            waitUntil: now,
          });
        });
        return { campaignId: id };
      }
      return await db.runTransaction(async (tx) => {
        const receiptRef = db.doc(`receipts/${uid}_${requestId}`);
        const receipt = await tx.get(receiptRef);
        const commandHash = createHash("sha256")
          .update(JSON.stringify(cmd))
          .digest("hex");
        if (receipt.exists) {
          assert(
            receipt.data()!.commandHash === commandHash,
            "idempotency-key-reused",
          );
          return receipt.data()!.result;
        }
        let cid = id;
        let result: Record<string, unknown> = { campaignId: id };
        if (cmd.type === "create") {
          const inviteRef = db.doc(`invitations/${invitationHash(code)}`);
          assert(!(await tx.get(inviteRef)).exists, "invite-collision");
          const c = createCampaign(
            id,
            uid,
            cmd.name,
            cmd.locale,
            cmd.capacity,
            cmd.difficulty,
            cmd.tone,
            now,
          );
          tx.create(db.doc(`campaigns/${id}`), c);
          tx.create(db.doc(`campaigns/${id}/hidden/world`), hiddenMystery);
          tx.create(inviteRef, {
            campaignId: id,
            expiresAt: now + 86400000,
            host: uid,
          });
          tx.set(db.doc(`campaigns/${id}/private/${uid}`), {
            code,
            ambitions: [],
          });
          result = { campaignId: id, code };
        } else if (cmd.type === "join") {
          const inv = await tx.get(
            db.doc(`invitations/${invitationHash(cmd.code)}`),
          );
          assert(
            inv.exists && inv.data()!.expiresAt > now,
            "invalid-invitation",
          );
          cid = inv.data()!.campaignId;
          const ref = db.doc(`campaigns/${cid}`);
          const snap = await tx.get(ref);
          assert(snap.exists, "invalid-invitation");
          const c = snap.data() as Campaign;
          if (!c.members.includes(uid)) {
            assert(c.phase === "lobby", "already-started");
            assert(c.members.length < c.capacity, "campaign-full");
            c.members.push(uid);
            c.updatedAt = now;
            tx.set(ref, { ...c, lastError: null });
            tx.set(db.doc(`campaigns/${cid}/private/${uid}`), {
              ambitions: [],
            });
          }
          result = { campaignId: cid };
        } else {
          const ref = db.doc(`campaigns/${id}`);
          const snap = await tx.get(ref);
          assert(snap.exists, "campaign-not-found");
          let c = snap.data() as Campaign;
          assert(c.members.includes(uid), "permission-denied");
          if (cmd.type === "character") {
            assert(c.phase === "lobby", "already-started");
            c.characters[uid] = character(
              uid,
              cmd.name,
              cmd.description,
              cmd.petName,
              seed,
              c.locale,
            );
            tx.create(db.doc(`jobs/${id}_portrait_${requestId}`), {
              ...makeJob(c, "portrait", seed),
              subjectUid: uid,
            });
          }
          if (cmd.type === "submit") {
            assert(c.phase === "collecting", "round-busy");
            assert(c.version === cmd.version, "stale-version");
            validateIntention(c, uid, cmd.intention);
            assert(
              Object.keys(c.submitted).length < 4 || !!c.submitted[uid],
              "round-full",
            );
            c.submitted[uid] = cmd.intention;
            if (c.members.every((m) => c.submitted[m])) {
              c.phase = "locked";
              tx.create(
                db.doc(`jobs/${id}_round_${c.version}_${requestId}`),
                makeJob(c, "round", seed),
              );
            }
          }
          if (cmd.type === "retract") {
            assert(
              c.phase === "collecting" && c.version === cmd.version,
              "round-busy",
            );
            delete c.submitted[uid];
          }
          if (cmd.type === "language") {
            assert(c.host === uid, "host-only");
            assert(
              ["lobby", "collecting", "paused"].includes(c.phase) &&
                !Object.keys(c.submitted).length,
              "round-busy",
            );
            c.locale = cmd.locale;
            c.narration = locations[c.location].description[c.locale];
          }
          if (cmd.type === "trade")
            c = trade(c, uid, cmd.operation, cmd.itemId, cmd.to);
          if (cmd.type === "ambition") {
            const privateRef = db.doc(`campaigns/${id}/private/${uid}`);
            const data = await tx.get(privateRef);
            const old = data.data()?.ambitions ?? [];
            assert(old.length < 20, "ambition-limit");
            tx.set(
              privateRef,
              {
                ambitions: [
                  ...old,
                  { text: cmd.text, kind: "desire", createdAt: now },
                ],
              },
              { merge: true },
            );
          }
          if (cmd.type === "control") {
            assert(c.host === uid, "host-only");
            const op = cmd.operation;
            if (op === "start") {
              assert(
                c.phase === "lobby" && c.members.every((m) => c.characters[m]),
                "characters-not-ready",
              );
              c.phase = "collecting";
              tx.create(
                db.doc(`jobs/${id}_image_${c.sceneVersion}`),
                makeJob(c, "image", seed),
              );
            }
            if (op === "pause") {
              assert(c.phase === "collecting", "round-busy");
              c.phase = "paused";
            }
            if (op === "resume") {
              assert(c.phase === "paused", "not-paused");
              c.phase = "collecting";
            }
            if (op === "archive") {
              assert(!["locked", "resolving"].includes(c.phase), "round-busy");
              c.phase = "archived";
            }
            if (op === "rotate") {
              const privateRef = db.doc(`campaigns/${id}/private/${uid}`);
              const data = await tx.get(privateRef);
              const old = data.data()?.code;
              const newRef = db.doc(`invitations/${invitationHash(code)}`);
              assert(!(await tx.get(newRef)).exists, "invite-collision");
              if (old) tx.delete(db.doc(`invitations/${invitationHash(old)}`));
              tx.create(newRef, {
                campaignId: id,
                expiresAt: now + 86400000,
                host: uid,
              });
              tx.set(privateRef, { code }, { merge: true });
              result.code = code;
            }
            if (op === "retry-art") {
              assert(c.imageStatus === "failed", "image-not-failed");
              tx.create(
                db.doc(`jobs/${id}_image_retry_${requestId}`),
                makeJob(c, "image", seed),
              );
              c.imageStatus = "pending";
            }
          }
          c.updatedAt = now;
          tx.set(ref, { ...c, lastError: null });
        }
        tx.create(receiptRef, {
          commandHash,
          result,
          createdAt: now,
          expiresAt: new Date(now + 7 * 86400000),
        });
        return result;
      });
    } catch (e) {
      if (e instanceof GameError)
        throw new HttpsError(
          e.code === "permission-denied"
            ? "permission-denied"
            : "failed-precondition",
          e.code,
        );
      throw new HttpsError(
        "internal",
        "Command failed; retry with the same request ID",
      );
    }
  },
);
async function claim(jobId: string) {
  const ref = db.doc(`jobs/${jobId}`);
  return db.runTransaction(async (tx) => {
    const s = await tx.get(ref);
    if (!s.exists) return null;
    const j = s.data() as Job;
    if (
      ["done", "uncertain", "failed"].includes(j.status) ||
      j.leaseUntil > Date.now()
    )
      return null;
    const cs = await tx.get(db.doc(`campaigns/${j.campaignId}`));
    if (!cs.exists || cs.data()!.phase === "archived") {
      tx.update(ref, { status: "done" });
      return null;
    }
    const current = cs.data() as Campaign;
    if (
      j.kind === "round" &&
      current.phase === "locked" &&
      current.version === j.version
    ) {
      current.phase = "resolving";
      tx.update(cs.ref, { phase: "resolving" });
    }
    const fence = j.fence + 1;
    tx.update(ref, {
      status: "running",
      fence,
      leaseUntil: Date.now() + 110000,
      attempts: j.attempts + 1,
    });
    return { job: { ...j, fence }, campaign: current };
  });
}
export async function budget(
  cid: string,
  jobId: string,
  kind: "text" | "image" = "text",
) {
  const config = settings();
  const reserve =
    kind === "image"
      ? config.IMAGE_RESERVATION_USD
      : config.TEXT_RESERVATION_USD;
  assert(
    reserve > 0 && config.DAILY_BUDGET_USD > 0 && config.SESSION_BUDGET_USD > 0,
    "configure-cost-limits",
  );
  const day = new Date().toISOString().slice(0, 10);
  const key = `${cid}_${day}`;
  return db.runTransaction(async (tx) => {
    const r = db.doc(`usage/${key}`),
      total = db.doc(`usage/${cid}_total`),
      jobRef = db.doc(`reservations/${jobId}`);
    const [s, t, j] = await Promise.all([
      tx.get(r),
      tx.get(total),
      tx.get(jobRef),
    ]);
    assert(!j.exists, "paid-attempt-already-reserved");
    const used = s.data()?.requests ?? 0;
    const daily = s.data()?.reservedUSD ?? 0,
      session = t.data()?.reservedUSD ?? 0;
    assert(
      used < config.DAILY_AI_REQUEST_LIMIT &&
        daily + reserve <= config.DAILY_BUDGET_USD &&
        session + reserve <= config.SESSION_BUDGET_USD,
      "budget-exhausted",
    );
    assert((t.data()?.active ?? 0) < 2, "provider-concurrency-limit");
    assert((t.data()?.circuitUntil ?? 0) < Date.now(), "provider-circuit-open");
    tx.set(
      r,
      {
        requests: used + 1,
        campaignId: cid,
        date: day,
        reservedUSD: daily + reserve,
      },
      { merge: true },
    );
    tx.set(
      total,
      {
        campaignId: cid,
        reservedUSD: session + reserve,
        active: (t.data()?.active ?? 0) + 1,
      },
      { merge: true },
    );
    tx.create(jobRef, {
      campaignId: cid,
      createdAt: Date.now(),
      status: "reserved",
      reservedUSD: reserve,
    });
  });
}
export async function settle(cid: string, jobId: string, ok: boolean) {
  await db.runTransaction(async (tx) => {
    const ref = db.doc(`usage/${cid}_total`),
      reservation = db.doc(`reservations/${jobId}`);
    const [s, r] = await Promise.all([tx.get(ref), tx.get(reservation)]);
    if (!r.exists || r.data()!.status !== "reserved") return;
    const failures = ok ? 0 : (s.data()?.failures ?? 0) + 1;
    tx.set(
      ref,
      {
        active: Math.max(0, (s.data()?.active ?? 1) - 1),
        failures,
        circuitUntil: failures >= 3 ? Date.now() + 300000 : 0,
      },
      { merge: true },
    );
    tx.update(reservation, {
      status: ok ? "completed-estimate" : "uncertain",
      settledAt: Date.now(),
    });
  });
}
async function retrieveMemory(c: Campaign, provider: Provider) {
  const ref = db.collection(`campaigns/${c.id}/memories`);
  try {
    const embedding = await provider.embed(
      `Current location ${c.location}; known clues ${c.knownClues.join(",")}`,
    );
    const result = await ref
      .where("visibility", "==", "shared")
      .findNearest({
        vectorField: "embedding",
        queryVector: FieldValue.vector(embedding),
        limit: 4,
        distanceMeasure: "COSINE",
      })
      .get();
    return result.docs.map((d) => String(d.data().text));
  } catch {
    const result = await ref
      .where("visibility", "==", "shared")
      .orderBy("createdAt", "desc")
      .limit(4)
      .get();
    return result.docs.map((d) => String(d.data().text));
  }
}
export async function work(
  jobId: string,
  providerFactory: () => Provider = () =>
    new Provider(settings(), apiKey.value()),
) {
  if (!safeId(jobId)) throw new Error("invalid-job");
  const claimed = await claim(jobId);
  if (!claimed) return;
  const { job, campaign: c } = claimed;
  const ref = db.doc(`jobs/${jobId}`);
  let paid = false;
  const startedAt = Date.now();
  try {
    const prior = await db.doc(`reservations/${jobId}`).get();
    if (prior.exists) {
      paid = true;
      throw new GameError("paid-attempt-uncertain");
    }
    if (job.kind === "round") {
      if (
        c.version !== job.version ||
        !["locked", "resolving"].includes(c.phase)
      ) {
        await ref.update({ status: "done" });
        return;
      }
      const actions: Record<string, Action> = {};
      const ambiguous: Record<string, string> = {};
      for (const uid of c.members) {
        const action = interpret(c.submitted[uid].text, c);
        if (action) actions[uid] = action;
        else ambiguous[uid] = c.submitted[uid].text;
      }
      if (Object.keys(ambiguous).length) {
        assert(settings().AI_MODE === "live", "clarification-needed");
        await budget(c.id, jobId);
        paid = true;
        Object.assign(
          actions,
          await providerFactory().interpretParty(
            ambiguous,
            assembleContext(c, []),
          ),
        );
      }
      for (const uid of c.members) {
        assert(
          actions[uid] && actions[uid].target !== "clarification",
          "clarification-needed",
        );
        const mention = c.submitted[uid].mentions.find(
          (m) => m.kind === "item",
        );
        if (mention) actions[uid].itemId = mention.id;
      }
      const resolved = resolveRound(c, actions, job.seed, Date.now());
      await db.runTransaction(async (tx) => {
        const [js, cs] = await Promise.all([
          tx.get(ref),
          tx.get(db.doc(`campaigns/${c.id}`)),
        ]);
        assert(
          js.data()?.fence === job.fence && js.data()?.status === "running",
          "lost-lease",
        );
        assert(
          cs.data()?.version === job.version &&
            ["locked", "resolving"].includes(cs.data()?.phase),
          "stale-version",
        );
        tx.set(db.doc(`campaigns/${c.id}`), resolved.campaign);
        for (const e of resolved.events)
          tx.create(db.doc(`campaigns/${c.id}/events/${e.id}`), e);
        tx.update(ref, { status: "done", leaseUntil: 0 });
        tx.create(
          db.doc(`jobs/${c.id}_presentation_${resolved.campaign.version}`),
          makeJob(resolved.campaign, "presentation", job.seed),
        );
        if (resolved.campaign.sceneVersion !== c.sceneVersion)
          tx.create(
            db.doc(`jobs/${c.id}_image_${resolved.campaign.sceneVersion}`),
            makeJob(resolved.campaign, "image", job.seed),
          );
        if (resolved.campaign.version % 5 === 0 || resolved.campaign.ending)
          tx.create(
            db.doc(`jobs/${c.id}_summary_${resolved.campaign.version}`),
            makeJob(resolved.campaign, "summary", job.seed),
          );
      });
    } else if (job.kind === "portrait") {
      const uid = job.subjectUid;
      assert(uid && c.characters[uid], "character-required");
      if (settings().AI_MODE === "mock") {
        await ref.update({ status: "done", leaseUntil: 0 });
        return;
      }
      await budget(c.id, jobId, "image");
      paid = true;
      const bytes = await providerFactory().portrait(
        c.characters[uid].description,
      );
      const path = `campaigns/${c.id}/portrait-${uid}-${job.seed}.png`;
      await getStorage()
        .bucket()
        .file(path)
        .save(bytes, {
          contentType: "image/png",
          metadata: { cacheControl: "private,max-age=3600" },
        });
      await db.runTransaction(async (tx) => {
        const [js, cs] = await Promise.all([
          tx.get(ref),
          tx.get(db.doc(`campaigns/${c.id}`)),
        ]);
        assert(js.data()?.fence === job.fence, "lost-lease");
        if (
          cs.exists &&
          cs.data()!.characters[uid]?.portraitVersion === job.seed
        )
          tx.update(cs.ref, { [`characters.${uid}.portraitPath`]: path });
        tx.update(ref, { status: "done", leaseUntil: 0 });
      });
    } else if (job.kind === "summary") {
      const ev = await db
        .collection(`campaigns/${c.id}/events`)
        .orderBy("sequence", "desc")
        .limit(20)
        .get();
      const context = assembleContext(
        c,
        ev.docs.map((d) => d.data() as GameEvent).reverse(),
      );
      let summary = {
        text: context.events
          .map((e) => e.text)
          .join(" ")
          .slice(0, 1500),
        sourceIds: context.events.map((e) => e.id),
      };
      let embedding: number[] | null = null;
      if (settings().AI_MODE === "live") {
        await budget(c.id, jobId);
        paid = true;
        const p = providerFactory();
        summary = await p.summarize(context);
        embedding = await p.embed(summary.text);
      }
      await db.runTransaction(async (tx) => {
        const js = await tx.get(ref);
        assert(js.data()?.fence === job.fence, "lost-lease");
        tx.set(db.doc(`campaigns/${c.id}/memories/${job.version}`), {
          ...summary,
          visibility: "shared",
          createdAt: Date.now(),
          location: c.location,
          ...(embedding ? { embedding: FieldValue.vector(embedding) } : {}),
        });
        tx.set(db.doc(`campaigns/${c.id}/summaries/${job.version}`), {
          ...summary,
          version: job.version,
          createdAt: Date.now(),
        });
        tx.update(ref, { status: "done", leaseUntil: 0 });
      });
    } else if (job.kind === "image") {
      if (c.sceneVersion !== job.sceneVersion) {
        await ref.update({ status: "done", leaseUntil: 0, obsolete: true });
        return;
      }
      if (settings().AI_MODE === "mock") {
        await db.runTransaction(async (tx) => {
          const [js, cs] = await Promise.all([
            tx.get(ref),
            tx.get(db.doc(`campaigns/${c.id}`)),
          ]);
          assert(js.data()?.fence === job.fence, "lost-lease");
          if (cs.exists && validAsset(cs.data() as Campaign, job))
            tx.update(cs.ref, { imageStatus: "demo" });
          tx.update(ref, { status: "done", leaseUntil: 0 });
        });
        return;
      }
      const descriptor = {
        location: c.location,
        description:
          locations[c.location].description[c.locale] +
          (c.ending
            ? ` Resolution: ${c.ending}. The bell is silent and the spring calm.`
            : ""),
        locale: c.locale,
      };
      const hash = createHash("sha256")
        .update(
          JSON.stringify({
            descriptor,
            artBible: ART_BIBLE,
            model: settings().IMAGE_MODEL,
            quality: "medium",
          }),
        )
        .digest("hex");
      const cacheRef = db.doc(`campaigns/${c.id}/assets/${hash}`);
      const cached = await cacheRef.get();
      let path = cached.data()?.path as string | undefined;
      if (!path) {
        await budget(c.id, jobId, "image");
        paid = true;
        const bytes = await providerFactory().image(descriptor);
        path = `campaigns/${c.id}/${hash}.png`;
        await getStorage()
          .bucket()
          .file(path)
          .save(bytes, {
            contentType: "image/png",
            metadata: { cacheControl: "private,max-age=3600" },
          });
      }
      await db.runTransaction(async (tx) => {
        const [js, cs] = await Promise.all([
          tx.get(ref),
          tx.get(db.doc(`campaigns/${c.id}`)),
        ]);
        assert(
          js.data()?.fence === job.fence && js.data()?.status === "running",
          "lost-lease",
        );
        assert(
          cs.exists && cs.data()!.phase !== "archived",
          "campaign-unavailable",
        );
        tx.set(cacheRef, {
          path,
          hash,
          sceneVersion: job.sceneVersion,
          createdAt: Date.now(),
        });
        if (validAsset(cs.data() as Campaign, job)) {
          tx.update(cs.ref, { imagePath: path, imageStatus: "ready" });
          tx.set(db.doc(`campaigns/${c.id}/events/asset-${jobId}`), {
            id: `asset-${jobId}`,
            campaignId: c.id,
            sequence: job.version * 100 + 90,
            kind: "system",
            text:
              c.locale === "es"
                ? "La ilustración de la escena está disponible."
                : "The scene illustration is ready.",
            actor: null,
            roll: null,
            sourceIds: [],
            location: c.location,
            createdAt: Date.now(),
          });
        }
        tx.update(ref, { status: "done", leaseUntil: 0 });
      });
    } else {
      // Narration is independent from artwork. A failed image never discards text.
      if (settings().AI_MODE === "mock" || c.version !== job.version) {
        await ref.update({ status: "done", leaseUntil: 0 });
        return;
      }
      await budget(c.id, jobId);
      paid = true;
      const provider = providerFactory();
      const ev = await db
        .collection(`campaigns/${c.id}/events`)
        .where("sequence", "<", (job.version + 1) * 100)
        .orderBy("sequence", "desc")
        .limit(12)
        .get();
      const context = assembleContext(
        c,
        ev.docs.map((x) => x.data() as GameEvent).reverse(),
      );
      context.facts.push(...(await retrieveMemory(c, provider)));
      const narration = await provider.narrate(context);
      await db.runTransaction(async (tx) => {
        const [js, cs] = await Promise.all([
          tx.get(ref),
          tx.get(db.doc(`campaigns/${c.id}`)),
        ]);
        assert(
          js.data()?.fence === job.fence && js.data()?.status === "running",
          "lost-lease",
        );
        if (
          cs.exists &&
          cs.data()!.version === job.version &&
          cs.data()!.phase !== "archived"
        )
          tx.update(cs.ref, { narration: narration.narrative.text });
        tx.update(ref, {
          status: "done",
          leaseUntil: 0,
          latencyMs: narration.latencyMs,
          providerRequestId: narration.requestId,
          usage: narration.usage ?? null,
        });
      });
    }
  } catch (e) {
    const code = e instanceof GameError ? e.code : "provider-or-worker-failed";
    const retryable =
      !paid &&
      ["provider-concurrency-limit", "provider-circuit-open"].includes(code) &&
      job.attempts < 5;
    await db.runTransaction(async (tx) => {
      const [js, cs] = await Promise.all([
        tx.get(ref),
        tx.get(db.doc(`campaigns/${job.campaignId}`)),
      ]);
      if (js.data()?.fence !== job.fence) return;
      tx.update(ref, {
        status: retryable ? "pending" : paid ? "uncertain" : "failed",
        leaseUntil: retryable ? Date.now() + 15000 : 0,
        error: code,
      });
      if (cs.exists && !retryable) {
        const current = cs.data() as Campaign;
        if (
          job.kind === "round" &&
          current.version === job.version &&
          ["locked", "resolving"].includes(current.phase)
        ) {
          tx.update(cs.ref, {
            phase: "collecting",
            submitted: {},
            lastError: code,
          });
        } else if (
          job.kind === "image" &&
          current.sceneVersion === job.sceneVersion
        )
          tx.update(cs.ref, { imageStatus: "failed" });
      }
    });
  } finally {
    const final = await ref.get();
    if (final.data()?.fence === job.fence) {
      if (final.data()?.status === "done")
        await ref.update({
          durationMs: Date.now() - startedAt,
          queueWaitMs: startedAt - job.createdAt,
          completedAt: Date.now(),
        });
      if (paid) await settle(c.id, jobId, final.data()?.status === "done");
    }
  }
}
export const dispatchJob = onDocumentCreated(
  { document: "jobs/{jobId}", secrets: emulator ? [] : [apiKey] },
  async (event) => {
    const id = event.params.jobId;
    if (emulator) {
      await work(id);
      await db.doc(`jobs/${id}`).update({ dispatchedAt: Date.now() });
      return;
    }
    await getFunctions()
      .taskQueue(`locations/${region}/functions/processJob`)
      .enqueue({ jobId: id }, { dispatchDeadlineSeconds: 120 });
    await db.doc(`jobs/${id}`).update({ dispatchedAt: Date.now() });
  },
);
export const processJob = onTaskDispatched(
  {
    retryConfig: {
      maxAttempts: 3,
      minBackoffSeconds: 10,
      maxBackoffSeconds: 60,
    },
    rateLimits: { maxConcurrentDispatches: 3, maxDispatchesPerSecond: 2 },
    secrets: emulator ? [] : [apiKey],
  },
  async (request) => {
    await work(request.data.jobId);
  },
);
export const recoverJobs = onSchedule(
  { schedule: "every 5 minutes", secrets: emulator ? [] : [apiKey] },
  async () => {
    const pending = await db
      .collection("jobs")
      .where("status", "in", ["pending", "running"])
      .where("leaseUntil", "<=", Date.now())
      .orderBy("leaseUntil")
      .limit(40)
      .get();
    const deletions = await db
      .collection("deletions")
      .where("status", "==", "pending")
      .limit(10)
      .get();
    for (const d of deletions.docs) await purgeCampaign(d.id);
    for (const s of pending.docs) {
      const j = s.data() as Job;
      if (j.leaseUntil < Date.now())
        await getFunctions()
          .taskQueue(`locations/${region}/functions/processJob`)
          .enqueue({ jobId: s.id }, { dispatchDeadlineSeconds: 120 });
    }
  },
);
export async function purgeCampaign(id: string) {
  const requestRef = db.doc(`deletions/${id}`),
    record = await requestRef.get();
  if (!record.exists || record.data()!.status === "done") return;
  const ref = db.doc(`campaigns/${id}`),
    c = await ref.get();
  if (c.exists && c.data()!.host !== record.data()!.host)
    throw new Error("permission-denied");
  const active = await db
    .collection("jobs")
    .where("campaignId", "==", id)
    .where("status", "in", ["pending", "running"])
    .limit(100)
    .get();
  let waitUntil = record.data()!.waitUntil ?? 0;
  for (const j of active.docs) {
    waitUntil = Math.max(waitUntil, j.data().leaseUntil ?? 0);
    await j.ref.update({ status: "done", fence: FieldValue.increment(1) });
  }
  await requestRef.update({ waitUntil });
  if (active.size === 100 || waitUntil > Date.now()) return;
  await getStorage()
    .bucket()
    .deleteFiles({ prefix: `campaigns/${id}/` });
  await db.recursiveDelete(ref);
  let more = false;
  for (const collection of ["jobs", "invitations", "reservations", "usage"]) {
    const docs = await db
      .collection(collection)
      .where("campaignId", "==", id)
      .limit(100)
      .get();
    if (docs.size === 100) more = true;
    const batch = db.batch();
    for (const d of docs.docs) batch.delete(d.ref);
    await batch.commit();
  }
  if (!more)
    await requestRef.update({ status: "done", completedAt: Date.now() });
}
export const deleteCampaign = onDocumentCreated(
  { document: "deletions/{id}", retry: true },
  async (event) => {
    await purgeCampaign(event.params.id);
  },
);
export const health = onCall(
  { enforceAppCheck: !emulator },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in");
    return { schemaVersion: 1, aiMode: settings().AI_MODE, region, emulator };
  },
);

export const operatorUsage = onCall(
  {
    enforceAppCheck: !emulator,
    cors: emulator ? true : (process.env.ALLOWED_ORIGINS?.split(",") ?? false),
  },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in");
    const cid = request.data?.campaignId;
    if (!safeId(cid))
      throw new HttpsError("invalid-argument", "Invalid campaign");
    const c = await db.doc(`campaigns/${cid}`).get();
    if (c.data()?.host !== request.auth.uid)
      throw new HttpsError("permission-denied", "Host only");
    const [usage, jobs] = await Promise.all([
      db.doc(`usage/${cid}_total`).get(),
      db
        .collection("jobs")
        .where("campaignId", "==", cid)
        .orderBy("createdAt", "desc")
        .limit(100)
        .get(),
    ]);
    const times = jobs.docs
      .map((d) => d.data().durationMs)
      .filter((x) => typeof x === "number")
      .sort((a, b) => a - b);
    const percentile = (p: number) =>
      times.length
        ? times[Math.min(times.length - 1, Math.ceil(times.length * p) - 1)]
        : null;
    return {
      reservedUSD: usage.data()?.reservedUSD ?? 0,
      costKind: "estimate",
      active: usage.data()?.active ?? 0,
      jobs: jobs.size,
      failures: jobs.docs.filter((d) =>
        ["failed", "uncertain"].includes(d.data().status),
      ).length,
      tokens: jobs.docs.reduce(
        (n, d) => n + (d.data().usage?.total_tokens ?? 0),
        0,
      ),
      medianMs: percentile(0.5),
      p95Ms: percentile(0.95),
      sampleSize: times.length,
    };
  },
);
