// config.js — the single source of truth for tuning.
// Change behaviour HERE, not with magic numbers scattered across modules.

export const CONFIG = {
  render: {
    // Bloom (UnrealBloomPass) — the HDR glow that makes lasers/streaks "pop".
    bloom: { strength: 0.9, radius: 0.6, threshold: 0.2 },
    pixelRatioCap: 2,        // clamp devicePixelRatio so high-DPI phones stay fast
    fov: 72,                 // base vertical FOV (deg); boost widens it for speed punch
    fovBoost: 88,            // FOV at full throttle/boost
    near: 0.1,
    far: 2000,
  },

  // Rail flight: the ship flies "forward" automatically; the WORLD streams toward
  // the camera. These tune how that streaming feels.
  flight: {
    cruiseSpeed: 60,         // world units/sec the field streams at, at rest
    boostSpeed: 200,         // streaming speed while boosting
    speedLerp: 2.5,          // how fast current speed eases toward target (per sec)
    bankAmount: 0.35,        // max roll (rad) applied from look yaw-rate (banking)
    bankLerp: 4.0,
    shakeOnBoost: 0.4,       // camera micro-shake intensity while boosting
  },

  // Rushing-particle streak field — the primary "sense of speed" seller.
  speedField: {
    count: 600,              // number of streaks
    radius: 90,              // cylinder radius the streaks spawn within
    depth: 900,              // length of the streaming corridor (-Z ahead)
    minStreak: 0.6,          // streak length at cruise (world units)
    maxStreak: 16,           // streak length at full boost
    color: 0x9fdcff,
    near: 6,                 // recycle once a streak passes this far behind camera (+Z)
  },

  starfield: {
    count: 1500,
    radius: 800,             // distant sphere of stars for parallax depth
    size: 2.2,
    color: 0xcfe6ff,
  },

  // Look / aiming via the on-screen virtual joystick.
  input: {
    turnRate: 2.9,           // rad/sec at full joystick deflection (snappy aiming)
    pitchClamp: 1.2,         // max up/down look (rad)
    autoFire: true,          // hold FIRE to keep shooting
  },

  // Large-scale battle backdrop you fly through (capital ships, distant dogfights).
  // Kept dim and to the PERIPHERY so it reads as a backdrop, never as live threats.
  armada: {
    capitalShips: 7,         // huge ships drifting in the corridor
    fighterSwarm: 150,       // distant dogfighting specks
    swarmRadius: 340,
    swarmMinRadiusFrac: 0.5, // keep the swarm out of the central play cone
    corridorDepth: 1100,
    flakInterval: 0.7,       // avg seconds between distant explosions
  },

  audio: {
    masterVolume: 0.9,
    musicVolume: 0.55,
    sfxVolume: 0.9,
    engineVolume: 0.35,
    musicCrossfadeMs: 1200,
  },

  // Gameplay constants used by combat/spawner/score (wired in the next slice).
  player: {
    maxShield: 120,
    maxHull: 100,
    shieldRegenDelay: 1.8,   // sec without damage before shield regenerates
    shieldRegenRate: 26,     // shield points/sec (recovers faster between hits)
    fireCooldown: 0.14,      // sec between shots
    projectileSpeed: 320,
    projectileDamage: 25,
    boostCooldown: 2.5,
    boostDuration: 0.9,
    iFramesOnBoost: 0.6,
    hitRadius: 2.6,          // how close a bolt/enemy must get to hit the player
  },

  // Aim assist so touch aiming feels good (generous, but not full auto-aim).
  aim: {
    assistCone: 0.22,        // radians: assists targets near the crosshair
    assistStrength: 0.62,    // 0..1 nudge of the shot toward the locked target
    range: 165,
  },

  weaponFeel: {
    recoilKick: 0.06,        // camera pitch kick per shot (rad)
    recoilReturn: 8,         // how fast recoil eases back (per sec)
    muzzleFlashMs: 60,
    shakeOnHit: 0.5,         // camera shake when the player takes a hit
    haptics: {               // navigator.vibrate patterns (ms), mobile only
      fire: 12,
      hit: [0, 40, 30, 60],
      explosion: [0, 60, 40, 120],
      boost: 25,
    },
  },

  enemy: {
    projectileSpeed: 120,
    projectileDamage: 8,
    contactDamage: 12,      // damage if an enemy collides with the player
    despawnDistance: 140,   // recycle enemies that fly far past the player
  },

  difficulty: {
    baseEnemiesPerWave: 3,
    enemiesPerWaveGrowth: 1, // +N enemies each wave
    bossEveryWaves: 4,
    enemySpeedGrowth: 0.05,  // +5% enemy speed per wave
  },

  // Boss ("Choir") phases — escalate as its HP drops. Index by phase-1 (0,1,2).
  boss: {
    phase2At: 0.66,          // HP fraction entering phase 2
    phase3At: 0.33,          // HP fraction entering phase 3 (enraged)
    speedMul: [1.0, 1.45, 2.0],   // strafe speed multiplier per phase
    fireMul: [1.0, 1.7, 2.6],     // fire-rate multiplier per phase
    spreadByPhase: [1, 3, 5],     // bolts per volley per phase
    spreadAngle: 0.5,        // total fan width of a spread volley (rad)
    escortsByPhase: [0, 3, 4],    // escorts summoned on entering each phase
    coreColor: [0xff7849, 0xffae3d, 0xff2a2a], // hotter as it rages
  },
};
