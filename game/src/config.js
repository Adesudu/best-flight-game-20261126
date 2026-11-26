// Ridgeline Run — configuration: every tunable number of the game in one place.
// Units: world distance in metres, speeds in m/s, altitudes in metres (HUD shows knots/feet).
export const VIEW = { width: 1280, height: 720 };

export const COURSE = {
  segmentLength: 100,
  segmentCount: 340,
  drawDistance: 110,
  valleyHalfWidth: 900,
  riverHalfWidth: 190,
  runwayHalfWidth: 170,
  cameraDepth: 0.84,
  cameraHeight: 26,
  runwayStartSegments: 8,
  runwayEndSegments: 14,
};

export const PLANE = {
  maxSpeed: 210,
  cruiseSpeed: 132,
  minSpeed: 46,
  accel: 46,
  boostAccel: 78,
  brakeAccel: 95,
  steerRate: 620, // lateral m/s at full bank
  climbRate: 74, // m/s at full pitch
  sinkRate: 96,
  maxBank: 0.62, // radians of visual bank
  maxPitch: 0.22,
  fuelCapacity: 100,
  fuelDrain: 0.55, // per second at cruise throttle
  fuelBoostDrain: 1.5, // extra per second while boosting
  fuelRingRefill: 38,
  lives: 3,
  ringRadius: 30,
  nearMissRadius: 52,
  groundClearance: 3,
};

export const SCORE = {
  ring: 100,
  fuelRing: 50,
  nearMiss: 25,
  checkpoint: 150,
  landing: 500,
  timeBonusPerSecond: 12,
  ringRunTarget: 12,
  courierTarget: 1,
};

export const MISSIONS = [
  {
    id: 'rings',
    name: 'Ring Run',
    tag: 'MISSION 1',
    blurb: 'Thread 12 sky rings down the valley. Every ring is 100 points — miss one and it costs you the perfect run.',
    goal: 'Fly through 12 rings before the valley ends.',
    rings: 12,
    fuelRings: 4,
    fuelDrain: 1.0,
    winText: 'RING RUN COMPLETE',
  },
  {
    id: 'courier',
    name: 'Valley Courier',
    tag: 'MISSION 2',
    blurb: 'Carry the mail to the strip at the far end. Gentle hands: come in slow, wings level, and put her down on the runway.',
    goal: 'Land on the far runway. Touch down slow and level.',
    rings: 6,
    fuelRings: 5,
    fuelDrain: 0.9,
    winText: 'DELIVERY COMPLETE',
  },
  {
    id: 'fuel',
    name: 'Fuel Run',
    tag: 'MISSION 3',
    blurb: 'A long valley, a thirsty engine. Green rings are fuel — chain them together and beat the clock to the far end.',
    goal: 'Reach the far end before the tanks run dry.',
    rings: 8,
    fuelRings: 9,
    fuelDrain: 1.7,
    winText: 'FUEL RUN COMPLETE',
  },
];

// Dawn palette: one coherent look for sky, terrain and instruments.
export const PALETTE = {
  skyTop: '#1d2f57',
  skyMid: '#7d6a8c',
  skyHorizon: '#ff9a4d',
  sunCore: '#ffe9b0',
  sunGlow: 'rgba(255, 170, 80, 0.55)',
  fog: '#e8a06a',
  groundA: '#5d7a43',
  groundB: '#54703c',
  rockA: '#7a6a58',
  rockB: '#6e6050',
  snowA: '#e8ecf2',
  snowB: '#d8dee8',
  riverA: '#3f7fa8',
  riverB: '#3a7398',
  runway: '#4a4a52',
  runwayLine: '#e8e8d8',
  ring: '#ffd23e',
  ringFuel: '#3ddc78',
  ringGlow: 'rgba(255, 210, 62, 0.5)',
  planeBody: '#e8543a',
  planeWing: '#f2ede2',
  planeTrim: '#2b3a55',
  hudPanel: 'rgba(8, 14, 24, 0.62)',
  hudGreen: '#7dffa8',
  hudAmber: '#ffc46b',
  hudRed: '#ff6b5e',
  hudText: '#eef4ff',
  hudDim: '#9fb2cc',
};

export const KEYS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  boost: ['ShiftLeft', 'ShiftRight'],
  brake: ['Space'],
  pause: ['KeyP', 'Escape'],
  mute: ['KeyM'],
  restart: ['KeyR'],
  confirm: ['Enter'],
};
