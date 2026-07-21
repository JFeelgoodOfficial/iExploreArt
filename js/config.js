// Global configuration & quality tiers.

export const BRAND = {
  paper: 0xf6f1e8,
  paperLight: 0xfbf8f3,
  ink: 0x1e1a17,
  muted: 0x6f675f,
  teal: 0x2f6f73,
  terracotta: 0xb46f3d,
  card: 0xfffdf9,
};

export const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Opt-in dynamic-resolution governor. Off by default: the fixed per-tier
// pixel ratio plus the steady-state optimisations hold frame time on target
// hardware, and stepping the ratio mid-session is itself a brief hitch and a
// visible resolution shift. Flip on if a struggling device needs the fallback.
export const ADAPTIVE_DPR = false;

export function detectTier() {
  if (IS_TOUCH) return TIERS.low;
  return TIERS.high;
}

export const TIERS = {
  high: {
    name: 'high',
    pixelRatio: 2,
    shadowSize: 2048,
    glassTransmission: true,
    bloom: true,
    vignette: true,
    motes: 300,
    flowers: 320,
    anisotropy: 8,
  },
  low: {
    name: 'low',
    pixelRatio: 1.5,
    shadowSize: 1024,
    glassTransmission: false,
    bloom: true,
    vignette: false,
    motes: 120,
    flowers: 160,
    anisotropy: 4,
  },
};

export const PLAYER = {
  radius: 0.35,
  eyeHeight: 1.65,
  walkSpeed: 3.0,
  runSpeed: 5.2,
  ySmoothing: 12,          // exponential smoothing rate for stair climbs
  interactDistance: 3.6,
};
