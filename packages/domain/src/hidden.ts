import type { Words } from "./content";
export const clues: Record<string, Words> = {
  cage: {
    es: "Mira vio que los animales seguían el tañido del pozo; no fueron robados.",
    en: "Mira saw the animals follow the well’s chime; they were not stolen.",
  },
  song: {
    es: "Ada recuerda una canción: «Devuelve la voz prestada y quedará saldada la deuda».",
    en: "Ada remembers a song: “Return the borrowed voice and the debt is paid.”",
  },
  chain: {
    es: "Oren rompió la cadena al reparar el pozo. El bronce pertenecía a un antiguo pacto.",
    en: "Oren broke the chain while repairing the well. The bronze belonged to an ancient pact.",
  },
  ledger: {
    es: "El registro confirma un pacto: la aldea cuidaría el manantial a cambio de agua limpia.",
    en: "The ledger records a pact: the village would tend the spring in return for clean water.",
  },
  roots: {
    es: "Rowan descubrió que las raíces reaccionan al sonido, no a la violencia.",
    en: "Rowan discovered that the roots respond to sound, not violence.",
  },
  oath: {
    es: "El guardián quiere restaurar el pacto. La campana retiene las voces para pedir ayuda.",
    en: "The warden wants the pact restored. The bell holds the voices to ask for help.",
  },
};
export const hiddenMystery = {
  cause:
    "Oren accidentally broke the covenant chain while repairing the village well. Eiran bound voices and called animals to draw attention to the poisoned spring.",
  peace: "Discover three clues and renew the pact at the ruins.",
  combat:
    "Defeat the root guardian; the voices return, but the spring needs tending.",
  inn: "Tess retains ownership. Restoration is an ambition, never an automatic reward.",
};
