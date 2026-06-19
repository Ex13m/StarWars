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

  // Look / aiming. In AR the device gyro drives this; drag is the desktop fallback.
  input: {
    dragSensitivity: 0.0035, // rad per pixel when dragging (no-gyro fallback)
    pitchClamp: 1.2,         // max up/down look (rad)
    smoothing: 12,           // higher = snappier look
    autoFire: true,          // hold to keep firing
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
    maxShield: 100,
    maxHull: 100,
    shieldRegenDelay: 3.0,   // sec without damage before shield regenerates
    shieldRegenRate: 14,     // shield points/sec
    fireCooldown: 0.14,      // sec between shots
    projectileSpeed: 320,
    projectileDamage: 25,
    boostCooldown: 2.5,
    boostDuration: 0.9,
    iFramesOnBoost: 0.6,
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

  difficulty: {
    baseEnemiesPerWave: 4,
    enemiesPerWaveGrowth: 2, // +N enemies each wave
    bossEveryWaves: 4,
    enemySpeedGrowth: 0.06,  // +6% enemy speed per wave
  },
};
