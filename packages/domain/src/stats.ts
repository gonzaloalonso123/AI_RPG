import type { Attributes } from "@story/contracts";
export const derived = (a: Attributes) => ({
  health: 20 + a.Endurance * 2,
  stamina: 10 + a.Agility,
  mana: 6 + a.Arcana,
  defence: Math.floor(a.Endurance / 4),
  initiative: a.Agility + Math.floor(a.Perception / 3),
  carry: 15 + a.Strength * 2,
});
