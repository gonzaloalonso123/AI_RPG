import {
  ATTRIBUTES,
  type Attributes,
  type Campaign,
  type Character,
  type GameEvent,
  type Action,
  type Locale,
  type Item,
  type Intention,
} from "@story/contracts";
import { locations, itemNames, pets, skillNames } from "./content";
import { clues } from "./hidden";
export { hiddenMystery } from "./hidden";
export * from "./content";
export class GameError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function assert(ok: unknown, code: string): asserts ok {
  if (!ok) throw new GameError(code);
}
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function attributes(seed: number, description = ""): Attributes {
  const random = rng(seed);
  const values = Object.fromEntries(
    ATTRIBUTES.map((k) => [k, 3]),
  ) as Attributes;
  let left = 60;
  while (left) {
    const themes = description.toLowerCase();
    const preferred = /mage|mago|magia|wizard/.test(themes)
      ? ["Arcana", "Intelligence", "Willpower"]
      : /ranger|explor|bosque|forest/.test(themes)
        ? ["Perception", "Agility", "Empathy"]
        : /warrior|guerrer|knight/.test(themes)
          ? ["Strength", "Endurance", "Willpower"]
          : ATTRIBUTES;
    const pool = random() < 0.55 ? preferred : ATTRIBUTES;
    const k = pool[
      Math.floor(random() * pool.length)
    ] as (typeof ATTRIBUTES)[number];
    if (values[k] < 16) {
      values[k]++;
      left--;
    }
  }
  return values;
}
export { derived } from "./stats";
import { derived } from "./stats";
export function item(template: string, id: string, locale: Locale): Item {
  return {
    id,
    template,
    name: itemNames[template]?.[locale] ?? template,
    quantity: 1,
    weight: template === "sword" ? 3 : 1,
    value: template === "silver-bell" ? 15 : template === "tonic" ? 5 : 3,
    tags:
      template === "cloak"
        ? ["absorbent", "flammable"]
        : template === "herb"
          ? ["edible"]
          : ["metallic"],
    equipped: template === "sword",
    rarity: template === "silver-bell" ? "uncommon" : "common",
  };
}
export function character(
  uid: string,
  name: string,
  description: string,
  petName: string,
  seed: number,
  locale: Locale,
): Character {
  const a = attributes(seed, description);
  const d = derived(a);
  return {
    uid,
    name,
    description,
    portraitPath: null,
    portraitVersion: seed,
    attributes: a,
    hp: d.health,
    stamina: d.stamina,
    mana: d.mana,
    gold: 12,
    xp: 0,
    level: 1,
    items: ["sword", "cloak", "tonic"].map((t, i) =>
      item(t, uid + "-" + i, locale),
    ),
    skills: ["strike", "observe"],
    practice: 0,
    pet: {
      name: petName,
      template: pets[seed % pets.length].id,
      bond: 0,
      exhausted: false,
    },
    status: [],
  };
}
export function createCampaign(
  id: string,
  uid: string,
  name: string,
  locale: Locale,
  capacity: number,
  difficulty: Campaign["difficulty"],
  tone: Campaign["tone"],
  now: number,
): Campaign {
  return {
    schemaVersion: 1,
    id,
    name,
    host: uid,
    members: [uid],
    capacity,
    locale,
    difficulty,
    tone,
    phase: "lobby",
    version: 0,
    sceneVersion: 0,
    location: "square",
    characters: {},
    submitted: {},
    knownClues: [],
    discoveries: {},
    clueSources: {},
    relationships: {},
    claimed: [],
    enemyHp: difficulty === "gentle" ? 24 : difficulty === "hard" ? 42 : 32,
    skirmishes: {},
    ending: null,
    time: 0,
    createdAt: now,
    updatedAt: now,
    narration: locations.square.description[locale],
    imagePath: null,
    imageStatus: "demo",
    merchantStock: 8,
    trade: null,
  };
}
export function interpret(text: string, c: Campaign): Action | null {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/999|ignore.*rules|ignora.*reglas|give me|dame.*oro/.test(t)) return null;
  for (const [id, loc] of Object.entries(locations)) {
    if (
      /viaj|travel/.test(t) &&
      Object.values(loc.name).some((n) =>
        t.includes(
          n
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
        ),
      )
    )
      return { kind: "travel", target: id };
  }
  const travel: Record<string, string[]> = {
    square: ["plaza", "square"],
    tavern: ["taberna", "tavern"],
    market: ["mercado", "market", "smith"],
    inn: ["posada", "inn"],
    forest: ["bosque", "forest"],
    ruins: ["ruinas", "ruins"],
  };
  for (const [target, names] of Object.entries(travel))
    if (
      names.some((n) => t.includes(n)) &&
      /ir|viaj|camin|go |travel|walk|visit/.test(t)
    )
      return { kind: "travel", target };
  for (const [id, names] of Object.entries(skillNames))
    if (
      Object.values(names).some(
        (n) =>
          t.trim() ===
          n
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, ""),
      )
    )
      return { kind: "skill", skillId: id, target: "" };
  const pairs: [RegExp, Action["kind"]][] = [
    [/huir|escap|flee/, "escape"],
    [/soltar|drop/, "drop"],
    [/esper|wait/, "wait"],
    [/descans|dorm|rest|sleep/, "rest"],
    [/negoci|pacto|negot|pact/, "negotiate"],
    [/atac|golpe|attack|strike/, "attack"],
    [/compr|buy/, "buy"],
    [/vend|sell/, "sell"],
    [/equip/, "equip"],
    [/tomar|recog|take|loot|coger/, "take"],
    [/tonico|tonic|curar|heal|usar|use /, "use"],
    [/mascota|pet |olfate|sniff/, "pet"],
    [/ayud|assist|help/, "assist"],
    [/habl|convers|pregunt|talk|ask/, "talk"],
    [/mirar|observ|investig|inspect|look|exam/, "inspect"],
  ];
  for (const [pattern, kind] of pairs)
    if (pattern.test(t))
      return {
        kind,
        target:
          kind === "take"
            ? (locations[c.location].loot ?? "")
            : kind === "talk"
              ? locations[c.location].npc
              : "",
      };
  return null;
}
export function validateIntention(c: Campaign, uid: string, intent: Intention) {
  assert(c.characters[uid], "character-required");
  for (const m of intent.mentions)
    assert(
      m.kind === "item"
        ? c.characters[uid].items.some((i) => i.id === m.id)
        : c.characters[uid].skills.includes(m.id),
      "unknown-mention",
    );
}
export function resolveRound(
  input: Campaign,
  actions: Record<string, Action>,
  seed: number,
  now: number,
): { campaign: Campaign; events: GameEvent[] } {
  const c = structuredClone(input);
  const random = rng(seed);
  const es = c.locale === "es";
  const events: GameEvent[] = [];
  const say = (a: string, b: string) => (es ? a : b);
  const event = (
    text: string,
    uid: string | null = null,
    roll: number | null = null,
    kind: GameEvent["kind"] = "outcome",
  ) =>
    events.push({
      id: `${c.version + 1}-${events.length}`,
      campaignId: c.id,
      sequence: (c.version + 1) * 100 + events.length,
      kind,
      text,
      actor: uid,
      roll,
      sourceIds: [],
      location: c.location,
      createdAt: now,
    });
  assert(
    c.members.every((uid) => actions[uid] && c.characters[uid]),
    "missing-actions",
  );
  const targets = c.members
    .map((uid) => actions[uid])
    .filter((a) => a.kind === "travel")
    .map((a) => a.target);
  if (targets.length) {
    assert(
      targets.length === c.members.length && new Set(targets).size === 1,
      "travel-consent",
    );
    const dest = targets[0] as keyof typeof locations;
    assert(locations[c.location].exits.includes(dest), "invalid-exit");
    c.location = dest;
    c.sceneVersion++;
    c.imagePath = null;
    c.imageStatus = "pending";
    event(locations[dest].description[c.locale]);
  } else if (
    c.members.some(
      (id) =>
        actions[id].kind === "escape" ||
        (actions[id].kind === "skill" && actions[id].skillId === "sneak"),
    )
  ) {
    assert(["ruins","forest","inn"].includes(c.location), "no-enemy");
    assert(
      c.members.every(
        (id) =>
          ["escape", "wait"].includes(actions[id].kind) ||
          (actions[id].kind === "skill" && actions[id].skillId === "sneak"),
      ),
      "travel-consent",
    );
    for (const uid of c.members) {
      if (actions[uid].kind === "skill") {
        assert(c.characters[uid].skills.includes("sneak"), "unknown-skill");
        assert(c.characters[uid].mana >= 3, "no-mana");
        c.characters[uid].mana -= 3;
      }
    }
    c.location = c.location==="ruins"?"forest":"square";
    c.sceneVersion++;
    c.imagePath = null;
    event(
      say(
        "El grupo se retira por el sendero.",
        "The party retreats along the path.",
      ),
    );
  } else {
    const order = [...c.members].sort(
      (a, b) =>
        derived(c.characters[b].attributes).initiative -
          derived(c.characters[a].attributes).initiative ||
        c.characters[b].attributes.Luck - c.characters[a].attributes.Luck ||
        a.localeCompare(b),
    );
    for (const uid of order) {
      const ch = c.characters[uid];
      const a = { ...actions[uid] };
      const d = derived(ch.attributes);
      const label = ch.name;
      const loc = locations[c.location];
      const discover = () => {
        if (!c.knownClues.includes(loc.clue)) {
          c.knownClues.push(loc.clue);
          c.discoveries[loc.clue] = clues[loc.clue];
          event(clues[loc.clue][c.locale], uid, null, "discovery");
          c.clueSources[loc.clue] = events.at(-1)!.id;
          c.relationships[loc.npc] = Math.min(
            10,
            (c.relationships[loc.npc] ?? 0) + 1,
          );
          for (const member of Object.values(c.characters)) {
            member.xp += 5;
            member.practice++;
          }
        } else {
          event(
            say("Recuerdas: ", "You remember: ") + clues[loc.clue][c.locale],
            uid,
          );
          if (c.clueSources[loc.clue])
            events.at(-1)!.sourceIds = [c.clueSources[loc.clue]];
        }
      };

      if (a.kind === "skill") {
        assert(a.skillId && ch.skills.includes(a.skillId), "unknown-skill");
        if (a.skillId === "strike") a.kind = "attack";
        else if (a.skillId === "observe") a.kind = "inspect";
        else if (a.skillId === "companion") a.kind = "pet";
        else {
          assert(ch.mana >= 3, "no-mana");
          ch.mana -= 3;
          if (a.skillId === "mend") {
            ch.hp = Math.min(d.health, ch.hp + 8);
            event(
              label +
                say(
                  " usa Alivio: +8 salud como máximo.",
                  " uses Mend: up to +8 health.",
                ),
              uid,
            );
            continue;
          }
          if (a.skillId === "ward") {
            ch.status = ch.status.filter((s) => !s.startsWith("ward:"));
            ch.status.push("ward:2");
            event(
              label +
                say(
                  " levanta un amparo por dos turnos.",
                  " raises a ward for two rounds.",
                ),
              uid,
            );
            continue;
          }
          if (a.skillId === "sneak") a.kind = "escape";
          else if (a.skillId === "persuade") a.kind = "negotiate";
          else if (a.skillId === "spark") a.kind = "attack";
          else throw new GameError("unknown-skill");
        }
      }
      switch (a.kind) {
        case "escape":
          assert(["ruins","forest","inn"].includes(c.location), "no-enemy");
          assert(
            c.members.every(
              (id) =>
                ["escape", "wait"].includes(actions[id].kind) ||
                (actions[id].kind === "skill" &&
                  actions[id].skillId === "sneak"),
            ),
            "travel-consent",
          );
          c.location = c.location==="ruins"?"forest":"square";
          c.sceneVersion++;
          c.imagePath = null;
          event(
            say(
              "El grupo se retira por el sendero.",
              "The party retreats along the path.",
            ),
            uid,
          );
          break;
        case "drop": {
          const i = ch.items.find((i) => i.id === a.itemId && !i.equipped);
          assert(i, "invalid-item");
          ch.items = ch.items.filter((x) => x.id !== i.id);
          event(label + say(" deja atrás ", " leaves behind ") + i.name, uid);
          break;
        }
        case "wait":
          event(label + say(" espera y escucha.", " waits and listens."), uid);
          break;
        case "inspect":
        case "talk":
          assert(
            !a.target || a.target === loc.npc || a.target === c.location,
            "invalid-target",
          );
          discover();
          break;
        case "pet":
          if (ch.pet.exhausted) {
            event(
              say(
                "Tu compañero necesita descansar.",
                "Your companion needs rest.",
              ),
              uid,
            );
            break;
          }
          {
            const fresh = !c.knownClues.includes(loc.clue);
            discover();
            ch.pet.exhausted = true;
            if (fresh) ch.pet.bond = Math.min(10, ch.pet.bond + 1);
          }
          break;
        case "assist":
          event(
            label +
              say(
                " prepara una ayuda (+2 como máximo).",
                " prepares assistance (+2 maximum).",
              ),
            uid,
          );
          break;
        case "take": {
          const template = loc.loot;
          assert(!a.target || a.target === template, "invalid-target");
          if (!template || c.claimed.includes(template)) {
            event(
              say(
                "No queda ningún objeto disponible.",
                "No unclaimed item remains.",
              ),
              uid,
            );
            break;
          }
          assert(
            ch.items.reduce((s, i) => s + i.weight * i.quantity, 0) + 1 <=
              d.carry,
            "overweight",
          );
          ch.items.push(item(template, c.id + "-" + template, c.locale));
          c.claimed.push(template);
          event(
            label +
              say(" obtiene ", " acquires ") +
              itemNames[template][c.locale],
            uid,
          );
          break;
        }
        case "rest":
          assert((c.location!=="ruins"||c.ending)&&(!c.skirmishes[c.location]||c.skirmishes[c.location].defeated),"threatened");
          ch.hp = d.health;
          ch.stamina = d.stamina;
          ch.mana = d.mana;
          ch.status = [];
          ch.pet.exhausted = false;
          event(
            label + say(" recupera fuerzas.", " recovers their strength."),
            uid,
          );
          break;
        case "use": {
          const target = ch.items.find((i) =>
            a.itemId
              ? i.id === a.itemId
              : ["tonic", "herb"].includes(i.template),
          );
          assert(
            target && ["tonic", "herb"].includes(target.template),
            "invalid-item",
          );
          ch.hp = Math.min(d.health, ch.hp + 15);
          ch.items = ch.items.filter((i) => i.id !== target.id);
          event(
            label +
              say(
                " recupera salud con un remedio.",
                " restores health with a remedy.",
              ),
            uid,
          );
          break;
        }
        case "equip": {
          const target = ch.items.find((i) => i.id === a.itemId);
          assert(
            target && ["sword", "cloak"].includes(target.template),
            "invalid-item",
          );
          target.equipped = !target.equipped;
          event(label + say(" cambia su equipo.", " changes equipment."), uid);
          break;
        }
        case "buy":
          assert(c.location === "market" && c.merchantStock > 0, "no-stock");
          assert(ch.gold >= 5, "insufficient-gold");
          assert(ch.items.length < 30, "inventory-full");
          ch.gold -= 5;
          c.merchantStock--;
          ch.items.push(item("tonic", `${uid}-b${c.version}`, c.locale));
          event(
            label +
              say(
                " compra un tónico por 5 monedas.",
                " buys a tonic for 5 coins.",
              ),
            uid,
          );
          break;
        case "sell": {
          assert(c.location === "market", "wrong-location");
          const i = ch.items.find((i) => i.id === a.itemId && !i.equipped);
          assert(i, "invalid-item");
          ch.gold += Math.floor(i.value / 2);
          ch.items = ch.items.filter((x) => x.id !== i.id);
          event(label + say(" vende un objeto.", " sells an item."), uid);
          break;
        }
        case "negotiate":
          assert(c.location === "ruins", "wrong-location");
          if (c.knownClues.length < 3) {
            event(
              say(
                "El guardián pide comprender el pacto. Busca tres pistas.",
                "The warden asks you to understand the pact. Find three clues.",
              ),
              uid,
            );
            break;
          }
          c.ending = "peace";
          event(
            say(
              "Renováis el pacto. La campana devuelve las voces; los animales vuelven a casa. Zarzavilla vuelve a cantar.",
              "You renew the pact. The bell returns the voices; the animals go home. Briarhollow sings again.",
            ),
            uid,
          );
          break;
        case "attack": {
          if (c.ending) {
            event(
              say(
                "El encuentro ya ha terminado.",
                "The encounter has already ended.",
              ),
              uid,
            );
            break;
          }
          assert(["ruins","forest","inn"].includes(c.location), "no-enemy");
          const lesser=c.location!=='ruins';
          const encounter=lesser?(c.skirmishes[c.location]??={hp:Math.ceil((c.location==='forest'?12:18)*(c.difficulty==='hard'?1.3:c.difficulty==='gentle'?.75:1)),defeated:false}):null;
          if(encounter?.defeated){event(say('La amenaza ya está resuelta.','This threat is already resolved.'),uid);break;}
          assert(ch.stamina >= 2, "no-stamina");
          ch.stamina -= 2;
          const roll = 1 + Math.floor(random() * 20);
          const assist = c.members.some(
            (other) => other !== uid && actions[other].kind === "assist",
          )
            ? 2
            : 0;
          const score =
            roll + Math.floor((ch.attributes.Strength - 10) / 2) + assist;
          const damage =
            score >= 15
              ? 8 + Math.floor(ch.attributes.Strength / 3)
              : score >= 10
                ? 5
                : score >= 7
                  ? 3
                  : 0;
          if(encounter)encounter.hp=Math.max(0,encounter.hp-damage);else c.enemyHp=Math.max(0,c.enemyHp-damage);
          event(
            `${label}: ${say("tirada", "roll")} ${roll}, ${say("daño", "damage")} ${damage}.`,
            uid,
            roll,
          );
          ch.practice++;
          if(encounter&&encounter.hp===0){encounter.defeated=true;for(const member of Object.values(c.characters)){member.xp+=10;member.gold+=3;}c.sceneVersion++;c.imagePath=null;c.imageStatus='pending';event(say('La sombra se disipa. Cada compañero obtiene 3 monedas y 10 XP.','The shadow disperses. Each companion receives 3 coins and 10 XP.'),uid);}
          else if (!encounter&&c.enemyHp === 0) {
            c.ending = "battle";
            event(
              say(
                "El guardián se disuelve. Las voces regresan, pero el manantial necesitará cuidados.",
                "The warden dissolves. The voices return, but the spring will need care.",
              ),
              uid,
            );
          } else {
            const loss = Math.max(
              0,
              (c.difficulty === "gentle" ? 3 : c.location==='forest'?3:c.location==='inn'?4:5) -
                d.defence -
                (ch.status.some((s) => s.startsWith("ward:")) ? 3 : 0),
            );
            ch.hp = Math.max(0, ch.hp - loss);
            event(
              label +
                say(` pierde ${loss} de salud.`, ` loses ${loss} health.`),
              uid,
            );
          }
          break;
        }
      }
    }
  }
  if (c.members.some((uid) => c.characters[uid].hp === 0) && !c.ending) {
    c.location = "tavern";
    c.sceneVersion++;
    c.imagePath = null;
    for (const ch of Object.values(c.characters)) {
      ch.hp = Math.max(1, Math.floor(derived(ch.attributes).health / 2));
      ch.gold = Math.max(0, ch.gold - 2);
    }
    event(
      say(
        "Ada os encuentra y os lleva a la taberna. Podéis descansar e intentarlo de nuevo.",
        "Ada finds you and brings you to the tavern. You can rest and try again.",
      ),
    );
  }
  if (c.ending) {
    c.sceneVersion++;
    c.imagePath = null;
    c.imageStatus = "pending";
    for (const ch of Object.values(c.characters)) {
      ch.xp += 25;
      ch.gold += 10;
    }
    c.phase = "ended";
  } else c.phase = "collecting";
  for (const ch of Object.values(c.characters)) {
    for (const [threshold, id] of [
      [3, "mend"],
      [5, "ward"],
      [7, "sneak"],
      [9, "persuade"],
      [11, "spark"],
      [13, "companion"],
    ] as const) {
      if (ch.practice >= threshold && !ch.skills.includes(id)) {
        ch.skills.push(id);
        event(
          ch.name + say(" aprende ", " learns ") + skillNames[id][c.locale],
          ch.uid,
        );
      }
    }
    const nextLevel = Math.min(10, 1 + Math.floor(ch.xp / 25));
    while (ch.level < nextLevel) {
      ch.level++;
      const strongest = [...ATTRIBUTES]
        .sort((a, b) => ch.attributes[b] - ch.attributes[a])
        .find((k) => ch.attributes[k] < 20);
      if (strongest) ch.attributes[strongest]++;
      event(
        ch.name + say(" alcanza el nivel ", " reaches level ") + ch.level,
        ch.uid,
      );
    }
    ch.status = ch.status.flatMap((s) => {
      const [name, n] = s.split(":");
      return Number(n) > 1 ? [name + ":" + (Number(n) - 1)] : [];
    });
  }
  c.version++;
  c.time += Object.values(actions).some((a) => a.kind === "rest") ? 60 : 5;
  c.submitted = {};
  c.trade = null;
  c.updatedAt = now;
  c.narration = events.map((e) => e.text).join("\n");
  return { campaign: c, events };
}
export function trade(
  campaign: Campaign,
  uid: string,
  operation: "offer" | "accept" | "cancel",
  itemId: string,
  to: string,
): Campaign {
  const c = structuredClone(campaign);
  assert(
    c.phase === "collecting" && Object.keys(c.submitted).length === 0,
    "round-busy",
  );
  assert(c.members.includes(uid), "permission-denied");
  if (operation === "offer") {
    assert(c.members.includes(to) && to !== uid, "invalid-target");
    assert(
      c.characters[uid].items.some((i) => i.id === itemId && !i.equipped),
      "invalid-item",
    );
    c.trade = { from: uid, to, itemId, version: c.version };
  } else {
    const t = c.trade;
    assert(t && t.itemId === itemId && t.version === c.version, "stale-trade");
    if (operation === "cancel") {
      assert(uid === t.from || uid === t.to, "permission-denied");
      c.trade = null;
    } else {
      assert(uid === t.to, "permission-denied");
      const item = c.characters[t.from].items.find(
        (i) => i.id === t.itemId && !i.equipped,
      );
      assert(item, "invalid-item");
      assert(
        c.characters[uid].items.reduce((s, i) => s + i.weight * i.quantity, 0) +
          item.weight <=
          derived(c.characters[uid].attributes).carry,
        "overweight",
      );
      c.characters[t.from].items = c.characters[t.from].items.filter(
        (i) => i.id !== item.id,
      );
      c.characters[uid].items.push(item);
      c.trade = null;
      c.version++;
    }
  }
  return c;
}
