// Koju's first playable stats are provisional and intended for playtesting.
export const CLASH_ZERO_CONFIG = Object.freeze({
  selectedCharacterId: "koju",
  characterProfiles: Object.freeze({
    koju: Object.freeze({
      maxHp: 110,
      moveSpeed: 250,
      attack: Object.freeze({
        damage: 28,
        range: 48,
        cooldownMs: 420,
      }),
      dash: Object.freeze({
        speed: 700,
        durationMs: 170,
        cooldownMs: 900,
      }),
      dodge: Object.freeze({
        perfectWindowMs: 140,
        invulnerabilityMs: 300,
      }),
    }),
  }),
  trainingTarget: Object.freeze({
    maxHp: 100,
    moveSpeed: 175,
    aggroRange: 420,
    attackDamage: 12,
    attackRange: 78,
    attackWindupMs: 620,
    attackCooldownMs: 1450,
  }),
});