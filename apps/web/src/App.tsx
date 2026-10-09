import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getBlob, ref as storageRef } from "firebase/storage";
import {
  BookOpen,
  Compass,
  Feather,
  Settings,
  Backpack,
  Users,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  Heart,
  Flame,
  Coins,
  LogOut,
  Globe,
  Shield,
  Check,
  Send,
  Leaf,
  Plus,
} from "lucide-react";
import type {
  Campaign,
  Character,
  GameEvent,
  Locale,
  Command,
  Intention,
} from "@story/contracts";
import {
  locations,
  npcs,
  itemNames,
  skillNames,
  pets,
} from "@story/domain/content";
import { derived } from "@story/domain/stats";
import * as fb from "./firebase";
import { copy, errorMessages, localeName } from "./i18n";
import { Scene } from "./Scene";
import { productName } from "./product";
import { OperatorUsage } from "./OperatorUsage";
import { JournalSummaries } from "./JournalSummaries";
import { Portrait } from "./Portrait";
const emptyMentions: Intention["mentions"] = [];
export default function App() {
  const [locale, setLocale] = useState<Locale>(
    () => (localStorage.getItem("story-locale") as Locale) || "es",
  );
  const t = copy[locale];
  const [user, setUser] = useState<User | null>(null),
    [authLoaded, setAuthLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [selected, setSelected] = useState<string | null>(() =>
      sessionStorage.getItem("story-campaign"),
    ),
    [campaign, setCampaign] = useState<Campaign | null>(null),
    [synced, setSynced] = useState(false);
  const [screen, setScreen] = useState<"library" | "create" | "join">(
      "library",
    ),
    [drawer, setDrawer] = useState<string | null>(null),
    [events, setEvents] = useState<GameEvent[]>([]),
    [earlier, setEarlier] = useState<GameEvent[]>([]),
    [cursor, setCursor] = useState<QueryDocumentSnapshot>(),
    [privateData, setPrivateData] = useState<{
      code?: string;
      ambitions?: { text: string; kind: string }[];
    }>({});
  const [draft, setDraft] = useState(""),
    [mentions, setMentions] = useState<Intention["mentions"]>(emptyMentions),
    [picker, setPicker] = useState<"item" | "skill" | null>(null),
    [search, setSearch] = useState(""),
    [ambition, setAmbition] = useState(""),
    [recipient, setRecipient] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [reduced, setReduced] = useState(
      () =>
        localStorage.getItem("story-reduced") === "true" ||
        matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [art, setArt] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null),
    composer = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = productName;
    localStorage.setItem("story-locale", locale);
  }, [locale]);
  useEffect(
    () =>
      fb.onAuthStateChanged(fb.auth, (u) => {
        setUser(u);
        setAuthLoaded(true);
      }),
    [],
  );
  useEffect(() => {
    if (!user) return;
    const off = fb.trackPresence(user.uid);
    const list = onSnapshot(
      query(
        collection(fb.db, "campaigns"),
        where("members", "array-contains", user.uid),
        orderBy("updatedAt", "desc"),
      ),
      (s) => setCampaigns(s.docs.map((d) => d.data() as Campaign)),
      (e) => setError(e.message),
    );
    return () => {
      off();
      list();
    };
  }, [user]);
  useEffect(() => {
    setCampaign(null);
    setSynced(false);
    setEarlier([]);
    if (!selected || !user) return;
    sessionStorage.setItem("story-campaign", selected);
    const a = onSnapshot(
      doc(fb.db, "campaigns", selected),
      { includeMetadataChanges: true },
      (s) => {
        setSynced(!s.metadata.fromCache);
        if (s.exists()) {
          setCampaign(s.data() as Campaign);
          const err = s.data().lastError;
          if (err) setNotice(errorMessages[err]?.[locale] ?? err);
        } else {
          setSelected(null);
          sessionStorage.removeItem("story-campaign");
        }
      },
      (e) => {
        setSynced(false);
        setError(e.message);
      },
    );
    const b = onSnapshot(
      query(
        collection(fb.db, "campaigns", selected, "events"),
        orderBy("sequence", "desc"),
        limit(30),
      ),
      (s) => {
        setEvents(s.docs.map((d) => d.data() as GameEvent));
        setCursor(s.docs.at(-1));
      },
    );
    const c = onSnapshot(
      doc(fb.db, "campaigns", selected, "private", user.uid),
      (s) => setPrivateData(s.data() ?? {}),
    );
    setDraft(localStorage.getItem(`draft-${selected}-${user.uid}`) ?? "");
    try {
      setMentions(
        JSON.parse(
          localStorage.getItem(`draft-mentions-${selected}-${user.uid}`) ??
            "[]",
        ),
      );
    } catch {
      setMentions([]);
    }
    return () => {
      a();
      b();
      c();
    };
  }, [selected, user, locale]);
  useEffect(() => {
    if (selected && user) {
      localStorage.setItem(`draft-${selected}-${user.uid}`, draft);
      localStorage.setItem(
        `draft-mentions-${selected}-${user.uid}`,
        JSON.stringify(mentions),
      );
    }
  }, [draft, mentions, selected, user]);
  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setArt(null);
    if (campaign?.imagePath)
      void getBlob(storageRef(fb.storage, campaign.imagePath))
        .then((b) => {
          if (!cancelled) {
            url = URL.createObjectURL(b);
            setArt(url);
          }
        })
        .catch(() => setArt(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [campaign?.imagePath]);
  useEffect(() => {
    if (drawer) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [drawer]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input,textarea,select,[contenteditable],dialog")
      )
        return;
      const keys: Record<string, string> = {
        i: "inventory",
        j: "journal",
        c: "character",
        k: "skills",
      };
      if (keys[e.key.toLowerCase()] && campaign) {
        e.preventDefault();
        setDrawer(keys[e.key.toLowerCase()]);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [campaign]);
  useEffect(() => {
    const offline = () => setSynced(false);
    window.addEventListener("offline", offline);
    return () => window.removeEventListener("offline", offline);
  }, []);
  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(errorMessages[message]?.[locale] ?? message);
    } finally {
      setBusy(false);
    }
  }
  async function command(c: Command) {
    return fb.send(c);
  }
  function back() {
    setSelected(null);
    setCampaign(null);
    sessionStorage.removeItem("story-campaign");
    setScreen("library");
  }
  async function action(text: string, refs = mentions) {
    if (!campaign || !synced) return;
    await run(async () => {
      await command({
        type: "submit",
        campaignId: campaign.id,
        version: campaign.version,
        intention: { text, mentions: refs },
      });
    });
  }
  const me = campaign && user ? campaign.characters[user.uid] : null;
  const host = campaign?.host === user?.uid;
  const canAct =
    !!campaign && campaign.phase === "collecting" && synced && !busy;
  const mine = campaign && user ? campaign.submitted[user.uid] : null;
  function insert(kind: "item" | "skill", id: string, name: string) {
    setDraft((d) => d.replace(/[@/]$/, "") + name + " ");
    setMentions((m) => [...m.filter((x) => x.id !== id), { kind, id }]);
    setPicker(null);
    composer.current?.focus();
  }
  const title =
    drawer === "settings"
      ? t.settings
      : drawer === "privacy"
        ? t.privacy
        : drawer === "inventory"
          ? t.inventory
          : drawer === "journal"
            ? t.journal
            : drawer === "skills"
              ? t.skills
              : t.character;
  const scene = campaign?.location ?? "square";
  return (
    <div className={`app ${reduced ? "reduced" : ""}`}>
      <header className="topbar">
        <button className="brand" onClick={back} aria-label={productName}>
          <span className="brand-mark">
            <Feather size={24} />
          </span>
          <span>
            {productName}<small>{t.tagline}</small>
          </span>
        </button>
        <nav>
          <button
            className="quiet language"
            onClick={() => setLocale(locale === "es" ? "en" : "es")}
          >
            <Globe size={16} />
            {localeName(locale)}
          </button>
          <button
            className="icon-button"
            aria-label={t.settings}
            onClick={() => setDrawer("settings")}
          >
            <Settings size={19} />
          </button>
          {user && (
            <button
              className="icon-button"
              aria-label={t.signout}
              onClick={() =>
                void run(async () => {
                  await fb.signOut(fb.auth);
                  back();
                })
              }
            >
              <LogOut size={18} />
            </button>
          )}
        </nav>
      </header>
      {error && (
        <div className="banner error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label={t.close}>
            <X size={16} />
          </button>
        </div>
      )}
      {notice && (
        <div className="banner" role="status">
          {notice}
          <button onClick={() => setNotice("")} aria-label={t.close}>
            <X size={16} />
          </button>
        </div>
      )}
      {!authLoaded ? (
        <main className="loading">{t.loading}</main>
      ) : !user ? (
        <main className="welcome">
          <div className="welcome-art">
            <Scene src="/art/square.svg" reduced={reduced} />
            <div className="art-shade" />
          </div>
          <section className="welcome-copy">
            <span className="eyebrow">
              <Sparkles size={14} />
              {t.eyebrow}
            </span>
            <h1>{t.welcome}</h1>
            <p>{t.intro}</p>
            {fb.isDemo ? (
              <>
                <button
                  className="primary large"
                  disabled={busy}
                  onClick={() => void run(() => fb.signInAnonymously(fb.auth))}
                >
                  {busy ? t.loading : t.demo}
                  <ArrowRight size={18} />
                </button>
                <small className="muted demo-note">{t.demoNote}</small>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(() =>
                    fb.signInWithEmailAndPassword(fb.auth, email, password),
                  );
                }}
              >
                <label>
                  {t.email}
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  {t.password}
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>
                <div className="button-row">
                  <button className="primary" disabled={busy || !fb.configured}>
                    {t.login}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void run(async () => {
                        const c = await fb.createUserWithEmailAndPassword(
                          fb.auth,
                          email,
                          password,
                        );
                        await fb.sendEmailVerification(c.user);
                        setNotice(t.verifyNote);
                      })
                    }
                  >
                    {t.signup}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void run(() =>
                      fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()),
                    )
                  }
                >
                  {t.google}
                </button>
                <button
                  type="button"
                  className="quiet"
                  onClick={() =>
                    void run(async () => {
                      await fb.sendPasswordResetEmail(fb.auth, email);
                      setNotice(t.reset);
                    })
                  }
                >
                  {t.reset}
                </button>
                {!fb.configured && <p>{t.noFirebase}</p>}
              </form>
            )}
            <button
              className="quiet privacy-link"
              onClick={() => setDrawer("privacy")}
            >
              {t.privacy}
            </button>
          </section>
        </main>
      ) : !fb.isDemo && !user.emailVerified ? (
        <main className="page">
          <h1>{t.verifyNote}</h1>
          <button
            onClick={() => void run(() => fb.sendEmailVerification(user))}
          >
            {t.verify}
          </button>
          <button
            onClick={() =>
              void run(async () => {
                await user.reload();
                await user.getIdToken(true);
                location.reload();
              })
            }
          >
            {t.refresh}
          </button>
        </main>
      ) : !selected ? (
        <main className="page library">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                STORY MASTER {fb.isDemo ? "· DEMO" : ""}
              </span>
              <h1>{t.library}</h1>
            </div>
            <div className="button-row">
              <button onClick={() => setScreen("join")}>
                <Users size={16} />
                {t.join}
              </button>
              <button className="primary" onClick={() => setScreen("create")}>
                <Plus size={16} />
                {t.new}
              </button>
            </div>
          </div>
          {screen === "create" && (
            <form
              className="card form-card"
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  const r = await command({
                    type: "create",
                    name: String(f.get("name")),
                    locale: f.get("locale") as Locale,
                    capacity: Number(f.get("capacity")),
                    difficulty: f.get("difficulty") as Campaign["difficulty"],
                    tone: f.get("tone") as Campaign["tone"],
                  });
                  setSelected(r.campaignId);
                  setScreen("library");
                });
              }}
            >
              <h2>{t.new}</h2>
              <label>
                {t.name}
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={60}
                  defaultValue={
                    locale === "es"
                      ? "Nuestra primera aventura"
                      : "Our first adventure"
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  {t.capacity}
                  <select name="capacity" defaultValue="2">
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.storyLanguage}
                  <select name="locale" defaultValue={locale}>
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label>
                  {t.difficulty}
                  <select name="difficulty" defaultValue="standard">
                    {(["gentle", "standard", "hard"] as const).map((x) => (
                      <option key={x} value={x}>
                        {t[x]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t.tone}
                  <select name="tone" defaultValue="mystery">
                    {(["wonder", "mystery", "humour"] as const).map((x) => (
                      <option key={x} value={x}>
                        {t[x]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="button-row">
                <button className="primary" disabled={busy}>
                  {t.create}
                </button>
                <button type="button" onClick={() => setScreen("library")}>
                  {t.cancel}
                </button>
              </div>
            </form>
          )}
          {screen === "join" && (
            <form
              className="card form-card"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  const r = await command({
                    type: "join",
                    code: String(f.get("code")).trim().toUpperCase(),
                  });
                  setSelected(r.campaignId);
                  setScreen("library");
                });
              }}
            >
              <h2>{t.join}</h2>
              <label>
                {t.code}
                <input
                  name="code"
                  required
                  minLength={8}
                  maxLength={8}
                  autoCapitalize="characters"
                />
              </label>
              <button className="primary" disabled={busy}>
                {t.join}
              </button>
            </form>
          )}
          <div className="campaign-grid">
            {campaigns.length === 0 && screen === "library" ? (
              <div className="empty-state">
                <Compass size={40} />
                <h2>{t.empty}</h2>
                <p>{t.intro}</p>
              </div>
            ) : (
              campaigns.map((c) => (
                <article className="campaign-card" key={c.id}>
                  <img src={`/art/${c.location}.svg`} alt="" />
                  <div>
                    <span className="eyebrow">
                      {localeName(c.locale)} · {c.members.length}/{c.capacity}{" "}
                      <Users size={12} />
                    </span>
                    <h2>{c.name}</h2>
                    <p>{locations[c.location].name[locale]}</p>
                    <small className="muted">
                      {new Date(c.updatedAt).toLocaleDateString(locale)}
                      {c.phase === "archived" ? ` · ${t.archived}` : ""}
                    </small>
                    <button
                      className="primary"
                      onClick={() => setSelected(c.id)}
                    >
                      {t.continue}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </main>
      ) : !campaign ? (
        <main className="loading">{t.loading}</main>
      ) : campaign.phase === "lobby" ? (
        <main className="page lobby">
          <button className="quiet" onClick={back}>
            <ArrowLeft size={16} />
            {t.back}
          </button>
          <span className="eyebrow">{t.lobby}</span>
          <h1>{campaign.name}</h1>
          <div className="lobby-grid">
            <section className="card">
              <h2>{t.character}</h2>
              {!me ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(() =>
                      command({
                        type: "character",
                        campaignId: campaign.id,
                        name: String(f.get("name")),
                        description: String(f.get("description")),
                        petName: String(f.get("petName")),
                      }),
                    );
                  }}
                >
                  <label>
                    {t.name}
                    <input name="name" required maxLength={40} />
                  </label>
                  <label>
                    {t.description}
                    <textarea
                      name="description"
                      required
                      minLength={5}
                      maxLength={1000}
                      placeholder={t.descriptionHint}
                    />
                  </label>
                  <label>
                    {t.petName}
                    <input
                      name="petName"
                      required
                      maxLength={40}
                      defaultValue={locale === "es" ? "Bruma" : "Mist"}
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    {t.confirm}
                    <Check size={16} />
                  </button>
                </form>
              ) : (
                <>
                  <CharacterCard character={me} locale={locale} />
                  <div className="pet-card">
                    <Leaf />
                    <div>
                      <strong>{me.pet.name}</strong>
                      <p>
                        {
                          pets.find((p) => p.id === me.pet.template)?.name[
                            locale
                          ]
                        }
                      </p>
                      <small>
                        {
                          pets.find((p) => p.id === me.pet.template)?.ability[
                            locale
                          ]
                        }
                      </small>
                    </div>
                  </div>
                </>
              )}
            </section>
            <aside className="card">
              <h2>{t.invite}</h2>
              {host && privateData.code && (
                <>
                  <p className="invite-code" data-testid="invite-code">
                    {privateData.code}
                  </p>
                  <button
                    onClick={() =>
                      void run(() =>
                        navigator.clipboard.writeText(privateData.code!),
                      )
                    }
                  >
                    {t.copy}
                  </button>
                  <button
                    className="quiet"
                    onClick={() =>
                      void run(() =>
                        command({
                          type: "control",
                          campaignId: campaign.id,
                          operation: "rotate",
                        }),
                      )
                    }
                  >
                    {t.rotate}
                  </button>
                </>
              )}
              <Party campaign={campaign} locale={locale} />
              {host ? (
                <button
                  className="primary full"
                  disabled={
                    busy ||
                    !campaign.members.every((m) => campaign.characters[m])
                  }
                  onClick={() =>
                    void run(() =>
                      command({
                        type: "control",
                        campaignId: campaign.id,
                        operation: "start",
                      }),
                    )
                  }
                >
                  {t.start}
                  <ArrowRight size={17} />
                </button>
              ) : (
                <p>{t.waiting}</p>
              )}
            </aside>
          </div>
        </main>
      ) : (
        <main className="adventure">
          <div className="adventure-top">
            <button className="quiet" onClick={back}>
              <ArrowLeft size={15} />
              {campaign.name}
            </button>
            <span className="connection">
              <i className={synced ? "online" : ""} />
              {synced ? t.connected : t.offline}
            </span>
            <span className="muted round">
              {locale === "es" ? "Turno" : "Round"} {campaign.version}
            </span>
          </div>
          <div className="game-grid">
            <section className="story-column">
              <div className="scene">
                <Scene src={art ?? `/art/${scene}.svg`} reduced={reduced} />
                <div className="scene-gradient" />
                <div className="scene-title">
                  <span className="eyebrow">
                    {t.chapter} · {t.quest}
                  </span>
                  <h1>{locations[scene].name[locale]}</h1>
                </div>
                <span className="art-label">{art ? "AI" : t.demoArt}</span>
              </div>
              <section className="narration" aria-live="polite">
                <div className="narrator-mark">
                  <Feather size={18} />
                </div>
                <div>
                  <p className="narrative-text">{campaign.narration}</p>
                  {campaign.imageStatus === "pending" && (
                    <small className="muted">{t.pending}</small>
                  )}
                  {campaign.imageStatus === "failed" && (
                    <small className="muted">{t.artFailed}</small>
                  )}
                </div>
              </section>
              {campaign.phase === "ended" ? (
                <div className="ending card">
                  <Sparkles />
                  <h2>{t.ending}</h2>
                  <p>{t.recap}</p>
                  <button onClick={() => setDrawer("journal")}>
                    {t.journal}
                  </button>
                </div>
              ) : campaign.phase === "paused" ? (
                <div className="card">
                  <h2>{t.paused}</h2>
                  {host && (
                    <button
                      className="primary"
                      onClick={() =>
                        void run(() =>
                          command({
                            type: "control",
                            campaignId: campaign.id,
                            operation: "resume",
                          }),
                        )
                      }
                    >
                      {t.resume}
                    </button>
                  )}
                </div>
              ) : (
                <section className="composer">
                  <div className="suggestions">
                    {(["inspect", "talk", "rest", "pet"] as const).map((k) => (
                      <button
                        key={k}
                        disabled={!canAct}
                        onClick={() => setDraft(t[k])}
                      >
                        {t[k]}
                      </button>
                    ))}
                    {["ruins","forest","inn"].includes(scene) &&
                      (scene==="ruins"?(["attack", "negotiate"] as const):(["attack"] as const)).map((k) => (
                        <button
                          key={k}
                          disabled={!canAct}
                          onClick={() => setDraft(t[k])}
                        >
                          {t[k]}
                        </button>
                      ))}
                    {locations[scene].loot &&
                      !campaign.claimed.includes(locations[scene].loot!) && (
                        <button onClick={() => setDraft(t.take)}>
                          {t.take}
                        </button>
                      )}
                    {scene === "market" && (
                      <button onClick={() => setDraft(t.buy)}>{t.buy}</button>
                    )}
                  </div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void action(draft);
                    }}
                  >
                    <label htmlFor="intent" className="intent-label">
                      {t.intentPrefix}
                    </label>
                    <textarea
                      id="intent"
                      ref={composer}
                      value={draft}
                      maxLength={1200}
                      placeholder={t.intentPlaceholder}
                      onChange={(e) => {
                        setDraft(e.target.value);
                        setPicker(
                          e.target.value.endsWith("@")
                            ? "item"
                            : e.target.value.endsWith("/")
                              ? "skill"
                              : null,
                        );
                      }}
                    />
                    {picker && me && (
                      <div
                        className="mention-picker"
                        aria-label={picker === "item" ? t.inventory : t.skills}
                      >
                        {(picker === "item"
                          ? me.items.map((i) => ({
                              id: i.id,
                              name: itemNames[i.template]?.[locale] ?? i.name,
                            }))
                          : me.skills.map((id) => ({
                              id,
                              name: skillNames[id]?.[locale] ?? id,
                            }))
                        ).map((x) => (
                          <button
                            type="button"
                            key={x.id}
                            onClick={() => insert(picker, x.id, x.name)}
                          >
                            {x.name}
                          </button>
                        ))}
                      </div>
                    )}
                    {mentions.length > 0 && me && (
                      <div className="mention-chips">
                        {mentions.map((m) => (
                          <button
                            type="button"
                            key={m.kind + m.id}
                            aria-label={`${t.close}: ${m.kind === "item" ? (me.items.find((i) => i.id === m.id)?.name ?? m.id) : (skillNames[m.id]?.[locale] ?? m.id)}`}
                            onClick={() =>
                              setMentions((old) =>
                                old.filter((x) => x.id !== m.id),
                              )
                            }
                          >
                            {m.kind === "item"
                              ? (itemNames[
                                  me.items.find((i) => i.id === m.id)
                                    ?.template ?? ""
                                ]?.[locale] ?? m.id)
                              : (skillNames[m.id]?.[locale] ?? m.id)}{" "}
                            <X size={12} />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="composer-bottom">
                      <small>
                        {campaign.phase === "locked" ||
                        campaign.phase === "resolving"
                          ? t.resolving
                          : mine
                            ? t.submitted
                            : t.how}
                      </small>
                      <div className="button-row">
                        {mine && (
                          <button
                            type="button"
                            disabled={!canAct}
                            onClick={() =>
                              void run(() =>
                                command({
                                  type: "retract",
                                  campaignId: campaign.id,
                                  version: campaign.version,
                                }),
                              )
                            }
                          >
                            {t.retract}
                          </button>
                        )}
                        <button
                          type="button"
                          className="quiet"
                          disabled={!canAct}
                          onClick={() => void action(t.wait, [])}
                        >
                          {t.wait}
                        </button>
                        <button
                          className="primary"
                          disabled={!canAct || !draft.trim()}
                        >
                          {t.send}
                          <Send size={16} />
                        </button>
                      </div>
                    </div>
                  </form>
                </section>
              )}
            </section>
            <aside className="side-panel">
              <div className="party-title">
                <span className="eyebrow">{t.party}</span>
                <Users size={16} />
              </div>
              <Party campaign={campaign} locale={locale} />
              <div className="divider" />
              <span className="eyebrow">{t.travel}</span>
              <div className="exits">
                {locations[scene].exits.map((id) => (
                  <button
                    key={id}
                    disabled={!canAct}
                    onClick={() =>
                      setDraft(
                        `${locale === "es" ? "Viajar a" : "Travel to"} ${locations[id].name[locale]}`,
                      )
                    }
                  >
                    <Compass size={16} />
                    {locations[id].name[locale]}
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
              <div className="divider" />
              <div className="drawer-links">
                {[
                  { key: "inventory", icon: Backpack, shortcut: "I" },
                  { key: "journal", icon: BookOpen, shortcut: "J" },
                  { key: "character", icon: Shield, shortcut: "C" },
                  { key: "skills", icon: Sparkles, shortcut: "K" },
                ].map(({ key, icon: Icon, shortcut }) => (
                  <button key={key} onClick={() => setDrawer(key)}>
                    <Icon size={18} />
                    {t[key as "inventory"]}
                    <kbd>{shortcut}</kbd>
                  </button>
                ))}
              </div>
              {me && (
                <div className="companion">
                  <Leaf size={19} />
                  <div>
                    <strong>{me.pet.name}</strong>
                    <small>
                      {me.pet.exhausted ? t.exhausted : t.available}
                    </small>
                  </div>
                </div>
              )}
              <p className="side-note">
                {fb.isDemo ? "DEMO · " : ""}
                {localeName(campaign.locale)} · {t.clues}:{" "}
                {campaign.knownClues.length}/6
              </p>
            </aside>
          </div>
        </main>
      )}
      <dialog
        ref={dialogRef}
        className="drawer"
        onCancel={() => setDrawer(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDrawer(null);
        }}
      >
        <div className="drawer-content">
          <div className="drawer-heading">
            <h2>{title}</h2>
            <button
              className="icon-button"
              onClick={() => setDrawer(null)}
              aria-label={t.close}
            >
              <X />
            </button>
          </div>
          {drawer === "settings" && (
            <>
              <label>
                {t.interfaceLanguage}
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as Locale)}
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={reduced}
                  onChange={(e) => {
                    setReduced(e.target.checked);
                    localStorage.setItem(
                      "story-reduced",
                      String(e.target.checked),
                    );
                  }}
                />
                {t.reduced}
              </label>
              <p className="muted">{t.mute}</p>
              {campaign && host && (
                <OperatorUsage campaignId={campaign.id} locale={locale} />
              )}
              {campaign && (
                <>
                  <label>
                    {t.storyLanguage}
                    <select
                      value={campaign.locale}
                      disabled={!host || busy}
                      onChange={(e) =>
                        void run(() =>
                          command({
                            type: "language",
                            campaignId: campaign.id,
                            locale: e.target.value as Locale,
                          }),
                        )
                      }
                    >
                      <option value="es">Español</option>
                      <option value="en">English</option>
                    </select>
                  </label>
                  {!host && <small>{t.hostOnly}</small>}
                  {host && (
                    <div className="stack">
                      {campaign.phase === "collecting" && (
                        <button
                          onClick={() =>
                            void run(() =>
                              command({
                                type: "control",
                                campaignId: campaign.id,
                                operation: "pause",
                              }),
                            )
                          }
                        >
                          {t.pause}
                        </button>
                      )}
                      {campaign.imageStatus === "failed" && (
                        <button
                          onClick={() =>
                            void run(() =>
                              command({
                                type: "control",
                                campaignId: campaign.id,
                                operation: "retry-art",
                              }),
                            )
                          }
                        >
                          {t.retry}
                        </button>
                      )}
                      <button
                        onClick={() =>
                          void run(async () => {
                            await command({
                              type: "control",
                              campaignId: campaign.id,
                              operation: "archive",
                            });
                            setDrawer(null);
                            back();
                          })
                        }
                      >
                        {t.archive}
                      </button>
                      <button
                        className="danger"
                        onClick={() => {
                          if (confirm(t.deleteConfirm))
                            void run(async () => {
                              await command({
                                type: "delete",
                                campaignId: campaign.id,
                                confirmation: "DELETE",
                              });
                              setDrawer(null);
                              back();
                            });
                        }}
                      >
                        {t.delete}
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() =>
                      void run(async () => {
                        const es = await getDocs(
                          query(
                            collection(
                              fb.db,
                              "campaigns",
                              campaign.id,
                              "events",
                            ),
                            orderBy("sequence"),
                          ),
                        );
                        const blob = new Blob(
                          [
                            JSON.stringify(
                              {
                                campaign,
                                events: es.docs.map((d) => d.data()),
                                private: privateData,
                              },
                              null,
                              2,
                            ),
                          ],
                          { type: "application/json" },
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `story-master-${campaign.id}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      })
                    }
                  >
                    {t.export}
                  </button>
                </>
              )}
              <button className="quiet" onClick={() => setDrawer("privacy")}>
                {t.privacy}
              </button>
            </>
          )}
          {drawer === "privacy" && <p>{t.privacyText}</p>}
          {drawer === "character" && me && (
            <CharacterCard character={me} locale={locale} />
          )}
          {drawer === "skills" && me && (
            <>
              <p className="muted">{t.skillHelp}</p>
              {me.skills.map((id) => (
                <button
                  className="skill-row"
                  key={id}
                  onClick={() => {
                    insert("skill", id, skillNames[id]?.[locale] ?? id);
                    setDrawer(null);
                  }}
                >
                  <Sparkles size={18} />
                  {skillNames[id]?.[locale] ?? id}
                </button>
              ))}
            </>
          )}
          {drawer === "inventory" && me && campaign && (
            <>
              <p className="gold">
                <Coins size={18} />
                {me.gold} {t.gold}
              </p>
              {me.items.map((i) => (
                <div className="item-row" key={i.id}>
                  <div className="item-icon">
                    <Backpack size={22} />
                  </div>
                  <div>
                    <strong>
                      {itemNames[i.template]?.[locale] ?? i.name}
                      {i.equipped ? " ✓" : ""}
                    </strong>
                    <small>
                      {i.weight} kg · {i.value} {t.gold}
                    </small>
                    <div className="button-row">
                      {["tonic", "herb"].includes(i.template) ? (
                        <button
                          disabled={!canAct}
                          onClick={() => {
                            setDrawer(null);
                            void action(
                              locale === "es" ? "Usar tónico" : "Use tonic",
                              [{ kind: "item", id: i.id }],
                            );
                          }}
                        >
                          {t.use}
                        </button>
                      ) : (
                        ["sword", "cloak"].includes(i.template) && (
                          <button
                            disabled={!canAct}
                            onClick={() => {
                              setDrawer(null);
                              void action("equip", [
                                { kind: "item", id: i.id },
                              ]);
                            }}
                          >
                            {t.equip}
                          </button>
                        )
                      )}
                      {scene === "market" && !i.equipped && (
                        <button
                          disabled={!canAct}
                          onClick={() => {
                            setDrawer(null);
                            void action("sell", [{ kind: "item", id: i.id }]);
                          }}
                        >
                          {t.sell}
                        </button>
                      )}
                      {!i.equipped && campaign.members.length > 1 && (
                        <button
                          disabled={!recipient || !canAct}
                          onClick={() =>
                            void run(() =>
                              command({
                                type: "trade",
                                campaignId: campaign.id,
                                operation: "offer",
                                itemId: i.id,
                                to: recipient,
                              }),
                            )
                          }
                        >
                          {t.trade}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {campaign.members.length > 1 && (
                <label>
                  {t.recipient}
                  <select
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  >
                    <option value="">—</option>
                    {campaign.members
                      .filter((id) => id !== user?.uid)
                      .map((id) => (
                        <option key={id} value={id}>
                          {campaign.characters[id]?.name}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {campaign.trade && (
                <div className="card">
                  <p>
                    {campaign.characters[campaign.trade.from]?.name} →{" "}
                    {campaign.characters[campaign.trade.to]?.name}
                  </p>
                  {campaign.trade.to === user?.uid && (
                    <button
                      onClick={() =>
                        void run(() =>
                          command({
                            type: "trade",
                            campaignId: campaign.id,
                            operation: "accept",
                            itemId: campaign.trade!.itemId,
                            to: user!.uid,
                          }),
                        )
                      }
                    >
                      {t.accept}
                    </button>
                  )}
                  <button
                    onClick={() =>
                      void run(() =>
                        command({
                          type: "trade",
                          campaignId: campaign.id,
                          operation: "cancel",
                          itemId: campaign.trade!.itemId,
                          to: user!.uid,
                        }),
                      )
                    }
                  >
                    {t.decline}
                  </button>
                </div>
              )}
            </>
          )}
          {drawer === "journal" && campaign && (
            <>
              <label>
                {t.search}
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <h3>{t.clues}</h3>
              {campaign.knownClues.map((id) => (
                <p className="clue" key={id}>
                  <Compass size={16} />
                  {campaign.discoveries[id]?.[locale] ?? id}
                </p>
              ))}
              <h3>{t.knownPeople}</h3>
              {campaign.knownClues.map((id) => {
                const loc = Object.values(locations).find(
                  (l) => l.clue === id,
                )!;
                return (
                  <p key={id}>
                    <strong>{npcs[loc.npc].name}</strong> ·{" "}
                    {npcs[loc.npc].appearance[locale]}
                  </p>
                );
              })}
              <h3>{t.ambitions}</h3>
              {privateData.ambitions?.map((a, i) => (
                <p className="clue" key={i}>
                  {a.text}
                  <small>{t.desire}</small>
                </p>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await command({
                      type: "ambition",
                      campaignId: campaign.id,
                      text: ambition,
                    });
                    setAmbition("");
                  });
                }}
              >
                <input
                  aria-label={t.ambitions}
                  value={ambition}
                  onChange={(e) => setAmbition(e.target.value)}
                  placeholder={t.ambitionPlaceholder}
                  maxLength={300}
                />
                <button disabled={busy || !ambition.trim()}>{t.save}</button>
              </form>
              <JournalSummaries campaignId={campaign.id} locale={locale} />
              <h3>{t.events}</h3>
              {[...events, ...earlier]
                .filter((e) =>
                  e.text.toLowerCase().includes(search.toLowerCase()),
                )
                .map((e) => (
                  <article className="journal-event" key={e.id}>
                    <small>
                      #{e.sequence} · {locations[e.location].name[locale]}
                    </small>
                    <p>{e.text}</p>
                    {e.roll !== null && (
                      <details>
                        <summary>{t.roll}</summary>d20: {e.roll}
                      </details>
                    )}
                  </article>
                ))}
              {events.length === 0 && <p>{t.emptyJournal}</p>}
              {cursor && (
                <button
                  onClick={() =>
                    void run(async () => {
                      const s = await getDocs(
                        query(
                          collection(fb.db, "campaigns", campaign.id, "events"),
                          orderBy("sequence", "desc"),
                          startAfter(cursor),
                          limit(30),
                        ),
                      );
                      setEarlier((old) => [
                        ...old,
                        ...s.docs.map((d) => d.data() as GameEvent),
                      ]);
                      setCursor(s.docs.at(-1));
                    })
                  }
                >
                  {t.more}
                </button>
              )}
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
function Party({
  campaign: c,
  locale,
}: {
  campaign: Campaign;
  locale: Locale;
}) {
  const t = copy[locale];
  return (
    <div className="party">
      {c.members.map((uid, index) => {
        const ch = c.characters[uid];
        return (
          <div className="party-member" key={uid}>
            <div className={`avatar avatar-${index}`}>
              <span>{ch?.name[0] ?? "?"}</span>
            </div>
            <div className="member-info">
              <strong>{ch?.name ?? t.notReady}</strong>
              <small>
                {ch
                  ? `${t.level} ${ch.level} · ${c.submitted[uid] ? t.ready : t.available}`
                  : t.notReady}
              </small>
              {ch && (
                <div
                  className="health-bar"
                  aria-label={`${t.health}: ${ch.hp}/${derived(ch.attributes).health}`}
                >
                  <span
                    style={{
                      width: `${(ch.hp / derived(ch.attributes).health) * 100}%`,
                    }}
                  />
                </div>
              )}
            </div>
            {c.submitted[uid] && <Check size={16} className="ready-icon" />}
          </div>
        );
      })}
    </div>
  );
}
function CharacterCard({
  character: c,
  locale,
}: {
  character: Character;
  locale: Locale;
}) {
  const t = copy[locale];
  const d = derived(c.attributes);
  return (
    <>
      <div className="character-title">
        <div className="avatar large-avatar">
          <Portrait path={c.portraitPath} name={c.name} />
        </div>
        <div>
          <h3>{c.name}</h3>
          <small>
            {t.level} {c.level} · {c.xp} XP
          </small>
        </div>
      </div>
      <p>{c.description}</p>
      <div className="resource-grid">
        <span>
          <Heart size={16} />
          {c.hp}/{d.health}
          <small>{t.health}</small>
        </span>
        <span>
          <Flame size={16} />
          {c.stamina}/{d.stamina}
          <small>{t.stamina}</small>
        </span>
        <span>
          <Sparkles size={16} />
          {c.mana}/{d.mana}
          <small>{t.mana}</small>
        </span>
      </div>
      <div className="attributes">
        {Object.entries(c.attributes).map(([key, value]) => (
          <div key={key}>
            <span>
              {(
                {
                  Strength: "Fuerza",
                  Agility: "Agilidad",
                  Endurance: "Resistencia",
                  Intelligence: "Inteligencia",
                  Perception: "Percepción",
                  Willpower: "Voluntad",
                  Charisma: "Carisma",
                  Empathy: "Empatía",
                  Arcana: "Arcano",
                  Luck: "Suerte",
                } as Record<string, string>
              )[key] && locale === "es"
                ? (
                    {
                      Strength: "Fuerza",
                      Agility: "Agilidad",
                      Endurance: "Resistencia",
                      Intelligence: "Inteligencia",
                      Perception: "Percepción",
                      Willpower: "Voluntad",
                      Charisma: "Carisma",
                      Empathy: "Empatía",
                      Arcana: "Arcano",
                      Luck: "Suerte",
                    } as Record<string, string>
                  )[key]
                : key}
            </span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </>
  );
}
