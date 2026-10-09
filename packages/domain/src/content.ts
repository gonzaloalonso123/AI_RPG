import type { Locale, LocationId } from "@story/contracts";
export type Words = { es: string; en: string };
export const words = (locale: Locale, s: Words) => s[locale];
export const locations: Record<
  LocationId,
  {
    name: Words;
    description: Words;
    exits: LocationId[];
    npc: string;
    clue: string;
    loot: string | null;
  }
> = {
  square: {
    name: { es: "Plaza de Zarzavilla", en: "Briarhollow Square" },
    description: {
      es: "Llegas antes del ocaso. La taberna está llena, pero nadie habla. Junto al pozo, una niña sostiene una jaula vacía. Tu compañero se niega a cruzar la plaza.",
      en: "You arrive just before sunset. The tavern is crowded, but nobody is speaking. Beside the well, a child holds an empty cage. Your companion refuses to cross the square.",
    },
    exits: ["tavern", "market", "inn", "forest"],
    npc: "mira",
    clue: "cage",
    loot: null,
  },
  tavern: {
    name: { es: "La brasa quieta", en: "The Quiet Ember" },
    description: {
      es: "El olor a romero y leña invade la sala. Una campana de latón yace envuelta en un paño sobre la barra.",
      en: "Rosemary and woodsmoke fill the room. A brass bell lies wrapped in cloth on the bar.",
    },
    exits: ["square"],
    npc: "ada",
    clue: "song",
    loot: null,
  },
  market: {
    name: { es: "Mercado de las cenizas", en: "Ash Market" },
    description: {
      es: "Bajo toldos de lino, la herrera trabaja en silencio. Hay vendas y tónicos a la venta.",
      en: "Beneath linen awnings, the smith works in silence. Bandages and tonics are for sale.",
    },
    exits: ["square"],
    npc: "oren",
    clue: "chain",
    loot: null,
  },
  inn: {
    name: { es: "La posada abandonada", en: "The Abandoned Inn" },
    description: {
      es: "La hiedra rodea una puerta azul. Dentro, el libro de huéspedes aguarda junto a un hogar apagado.",
      en: "Ivy curls around a blue door. Inside, a guestbook waits beside a cold hearth.",
    },
    exits: ["square", "forest"],
    npc: "tess",
    clue: "ledger",
    loot: "lantern",
  },
  forest: {
    name: { es: "Sendero del bosque", en: "Forest Path" },
    description: {
      es: "Entre los abedules, pequeñas luces marcan un sendero hacia las ruinas. Algo araña la piedra.",
      en: "Between the birches, tiny lights mark a path to the ruins. Something scratches at the stone.",
    },
    exits: ["square", "inn", "ruins"],
    npc: "rowan",
    clue: "roots",
    loot: "herb",
  },
  ruins: {
    name: { es: "La campana bajo el pozo", en: "The Bell Beneath the Well" },
    description: {
      es: "Raíces rodean una campana sumergida. Una figura de corteza custodia su cadena rota. Espera una respuesta.",
      en: "Roots embrace a sunken bell. A figure of bark guards its broken chain. It waits for an answer.",
    },
    exits: ["forest"],
    npc: "warden",
    clue: "oath",
    loot: "silver-bell",
  },
};
export const npcs: Record<
  string,
  { name: string; appearance: Words; motive: Words }
> = {
  mira: {
    name: "Mira",
    appearance: { es: "Niña de bufanda roja", en: "Child in a red scarf" },
    motive: { es: "Encontrar a su mirlo", en: "Find her blackbird" },
  },
  ada: {
    name: "Ada",
    appearance: {
      es: "Tabernera de trenzas plateadas",
      en: "Innkeeper with silver braids",
    },
    motive: { es: "Proteger a sus vecinos", en: "Protect her neighbours" },
  },
  oren: {
    name: "Oren",
    appearance: {
      es: "Herrera con guantes de cuero",
      en: "Smith in leather gloves",
    },
    motive: { es: "Reparar su error", en: "Repair her mistake" },
  },
  tess: {
    name: "Tess",
    appearance: {
      es: "Archivera de abrigo verde",
      en: "Archivist in a green coat",
    },
    motive: {
      es: "Recuperar la posada legalmente",
      en: "Restore the inn lawfully",
    },
  },
  rowan: {
    name: "Rowan",
    appearance: {
      es: "Guardabosques de capa remendada",
      en: "Ranger in a patched cloak",
    },
    motive: { es: "Sanar el bosque", en: "Heal the forest" },
  },
  warden: {
    name: "Eiran",
    appearance: {
      es: "Guardián de corteza y luz",
      en: "Warden of bark and light",
    },
    motive: { es: "Renovar el pacto del agua", en: "Renew the water pact" },
  },
};
export const enemies = [
  { id: "rootling", hp: 12, damage: 3 },
  { id: "echo", hp: 18, damage: 4 },
  { id: "warden", hp: 32, damage: 5 },
];
export const itemNames: Record<string, Words> = {
  sword: { es: "Espada de viajero", en: "Traveller’s sword" },
  cloak: { es: "Capa de lana", en: "Wool cloak" },
  tonic: { es: "Tónico de romero", en: "Rosemary tonic" },
  lantern: { es: "Farol de latón", en: "Brass lantern" },
  herb: { es: "Hierba de luna", en: "Moon herb" },
  "silver-bell": { es: "Campana de plata", en: "Silver bell" },
};
export const skillNames: Record<string, Words> = {
  strike: { es: "Golpe firme", en: "Steady strike" },
  observe: { es: "Ojo atento", en: "Keen eye" },
  mend: { es: "Alivio", en: "Mend" },
  ward: { es: "Amparo", en: "Ward" },
  sneak: { es: "Paso de sombra", en: "Shadow step" },
  persuade: { es: "Voz serena", en: "Calm voice" },
  spark: { es: "Chispa", en: "Spark" },
  companion: { es: "Vínculo", en: "Bond" },
};
export const pets = [
  {
    id: "fox",
    name: { es: "Zorro de musgo", en: "Moss fox" },
    ability: {
      es: "Encuentra una pista; necesita descansar después.",
      en: "Finds one clue; needs rest afterwards.",
    },
  },
  {
    id: "owl",
    name: { es: "Búho de ceniza", en: "Ash owl" },
    ability: {
      es: "Detecta rastros ocultos; necesita descansar después.",
      en: "Spots hidden traces; needs rest afterwards.",
    },
  },
  {
    id: "otter",
    name: { es: "Nutria de río", en: "River otter" },
    ability: {
      es: "Rastrea sonidos del agua; necesita descansar después.",
      en: "Tracks sounds in water; needs rest afterwards.",
    },
  },
];
