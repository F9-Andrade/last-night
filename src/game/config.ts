/** Gameplay tuning for the local vertical slice. Durations are simulation seconds. */
export const BALANCE = {
  cycle: { day: 180, dusk: 30, preparation: 30, dawn: 10, silence: 3 },
  player: { hp: 100, walk: 4.6, sprint: 7.5, stamina: 100, drain: 27, recover: 19 },
  pistol: { name: 'Pistola improvisada', magazine: 12, damage: 34, cooldown: .23, reload: 1.35, range: 26, spread: .021 },
  inventory: { capacity: 18, ammo: 72, med: 1, wood: 2, scrap: 1 },
  interaction: { range: 2.5, search: .75, heal: 2.4, healAmount: 45, build: 1.2, repair: 2, dismantle: 1 },
  base: { hp: 1000, repairCost: 4, repairAmount: 120, repairTime: 3, rareRepair: 250 },
  barricade: { hp: 300, wood: 6, scrap: 2, repairWood: 1, repairScrap: 1, repairAmount: 90 },
  walker: { hp: 90, speed: 1.15, speedPerDay: .06, maxSpeedBonus: .45, playerDamage: 9, baseDamage: 24, barricadeDamage: 18, attackInterval: 1.1, playerRange: 1.25, chaseNight: 8, chaseDay: 15, capacity: 40, separation: 1.1 },
  horde: { first: 18, perDay: 6, maximum: 60, waveGap: 13, spawnInterval: 2, minimumInterval: 1.2, spawnDistance: 31, dayCap: 5, dayInterval: 35 },
  combat: { multipliers: { HEAD: 3, TORSO: 1, ARMS: .65, LEGS: .7 }, woundLimit: 6, corpseLimit: 80, corpseLifetime: 30, corpseFade: 4, legSlow: 2.5, stagger: .28, particles: 100, cameraKick: .07 },
  audio: { voices: 16, ambientMin: 20, ambientRange: 22, walkerRange: 15 },
  noise: { shot: 30, sprint: 7, alarm: 42, search: 20, memory: 7 },
  exploration: { activation: 27, groupLimit: 3 },
  reward: { scrap: 3, rare: 1, restock: .5 },
};
