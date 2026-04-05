export const TOTAL_CAMPAIGN_LEVELS = 50;
export const STORAGE_KEY = "circle-sum-challenge-progress-v2";

export type Mode = "campaign" | "endless";
export type Direction = "clockwise" | "anticlockwise";
export type ResultState =
  | "idle"
  | "preview"
  | "active"
  | "success"
  | "wrong"
  | "timeout";
export type Intensity = "calm" | "spark" | "charge" | "storm" | "nova";

export type MessageState = Exclude<ResultState, "idle"> | "idle";

export type LevelConfig = {
  level: number;
  count: number;
  digitMin: number;
  digitMax: number;
  minValue: number;
  maxValue: number;
  tricky: boolean;
  timeLimit: number;
  intensity: Intensity;
  name: string;
  trickyChance: number;
};

export type RoundData = {
  numbers: number[];
  startIndex: number;
  direction: Direction;
  pathIndices: number[];
  pathValues: number[];
  runningTotals: number[];
  correctSum: number;
};

export type ProgressStats = {
  roundsPlayed: number;
  correctAnswers: number;
  totalResponseMs: number;
};

export type Progress = {
  bestScore: number;
  unlockedLevel: number;
  bestStreak: number;
  bestEndlessWave: number;
  soundEnabled: boolean;
  sfxVolume: number;
  musicVolume: number;
  stats: ProgressStats;
};

export type TraceItem = {
  stepLabel: string;
  valueLabel: string;
  totalLabel: string;
  variant: "success" | "failure";
};

export const DIRECTIONS: Record<
  Direction,
  { label: string; short: string; arrow: string }
> = {
  clockwise: { label: "Clockwise", short: "CW", arrow: "↻" },
  anticlockwise: { label: "Anti-clockwise", short: "CCW", arrow: "↺" },
};

export const TRICKY_VALUES = [
  8, 9, 17, 18, 19, 27, 28, 29, 37, 38, 39, 47, 48, 49, 58, 68, 78, 79, 87,
  88, 89, 98, 99, 107, 108, 109, 117, 118, 119, 127, 128, 129, 147, 148, 149,
  178, 187, 188, 189, 198, 199, 207, 208, 209, 217, 218, 219, 227, 228, 229,
  247, 248, 249, 278, 287, 288, 289, 298, 299, 307, 308, 309, 347, 348, 349,
  378, 387, 388, 389, 398, 399, 407, 408, 409, 447, 448, 449, 478, 487, 488,
  489, 498, 499,
];

export const DEFAULT_PROGRESS: Progress = {
  bestScore: 0,
  unlockedLevel: 1,
  bestStreak: 0,
  bestEndlessWave: 0,
  soundEnabled: true,
  sfxVolume: 0.8,
  musicVolume: 0.35,
  stats: {
    roundsPlayed: 0,
    correctAnswers: 0,
    totalResponseMs: 0,
  },
};

const createLevel = (
  level: number,
  count: number,
  digitMin: number,
  digitMax: number,
  minValue: number,
  maxValue: number,
  tricky: boolean,
  timeLimit: number,
  intensity: Intensity,
  name: string,
  trickyChance: number
): LevelConfig => ({
  level,
  count,
  digitMin,
  digitMax,
  minValue,
  maxValue,
  tricky,
  timeLimit,
  intensity,
  name,
  trickyChance,
});

export const CAMPAIGN_LEVELS: LevelConfig[] = [
  createLevel(1, 5, 1, 1, 1, 9, false, 24, "calm", "Starter Ring", 0),
  createLevel(2, 5, 1, 1, 1, 9, false, 23, "calm", "Starter Ring II", 0),
  createLevel(3, 6, 1, 1, 1, 9, false, 22, "calm", "Low Orbit", 0),
  createLevel(4, 6, 1, 1, 1, 9, false, 21, "calm", "Clean Sweep", 0),
  createLevel(5, 7, 1, 1, 1, 9, false, 21, "calm", "Seven Pulse", 0),
  createLevel(6, 7, 1, 1, 1, 9, false, 20, "calm", "Steady Loop", 0),
  createLevel(7, 8, 1, 1, 1, 9, false, 19, "spark", "Wide Ring", 0.08),
  createLevel(8, 8, 1, 1, 1, 9, true, 18, "spark", "Bright Trap", 0.2),
  createLevel(9, 9, 1, 1, 1, 9, true, 17, "spark", "Neon Nines", 0.24),
  createLevel(10, 9, 1, 1, 1, 9, true, 16, "spark", "Beginner Finale", 0.3),
  createLevel(11, 8, 2, 2, 10, 24, false, 21, "spark", "Double Digits", 0),
  createLevel(12, 8, 2, 2, 10, 29, false, 20, "spark", "Pulse Step", 0.04),
  createLevel(13, 9, 2, 2, 10, 29, false, 19, "spark", "Split Focus", 0.08),
  createLevel(14, 9, 2, 2, 12, 34, true, 19, "spark", "Trap Seeds", 0.18),
  createLevel(15, 10, 2, 2, 12, 39, false, 18, "charge", "Ten Count", 0.08),
  createLevel(16, 10, 2, 2, 15, 44, false, 17, "charge", "Wide Tally", 0.12),
  createLevel(
    17,
    10,
    2,
    2,
    18,
    49,
    true,
    17,
    "charge",
    "Forty Nine Drift",
    0.22
  ),
  createLevel(18, 11, 2, 2, 18, 54, false, 16, "charge", "Dense Orbit", 0.14),
  createLevel(19, 11, 2, 2, 20, 59, true, 16, "charge", "Crossfire", 0.24),
  createLevel(
    20,
    11,
    2,
    2,
    22,
    64,
    true,
    15,
    "charge",
    "Easy-Medium Boss",
    0.28
  ),
  createLevel(21, 10, 2, 2, 25, 69, false, 18, "charge", "Hot Start", 0.1),
  createLevel(22, 10, 2, 2, 28, 74, true, 17, "charge", "Late Sevens", 0.18),
  createLevel(
    23,
    11,
    2,
    2,
    30,
    79,
    false,
    17,
    "storm",
    "Mirror Pressure",
    0.12
  ),
  createLevel(
    24,
    11,
    2,
    2,
    32,
    84,
    true,
    16,
    "storm",
    "Crowded Arc",
    0.22
  ),
  createLevel(
    25,
    12,
    2,
    2,
    35,
    89,
    false,
    16,
    "storm",
    "Long Circuit",
    0.14
  ),
  createLevel(
    26,
    12,
    2,
    2,
    38,
    94,
    true,
    15,
    "storm",
    "Trick Split",
    0.24
  ),
  createLevel(
    27,
    12,
    2,
    2,
    40,
    99,
    true,
    15,
    "storm",
    "Ninety Nine Heat",
    0.28
  ),
  createLevel(
    28,
    13,
    2,
    3,
    45,
    109,
    true,
    15,
    "storm",
    "Mixed Threshold",
    0.24
  ),
  createLevel(
    29,
    13,
    2,
    3,
    48,
    119,
    true,
    14,
    "storm",
    "Charge Breaker",
    0.27
  ),
  createLevel(
    30,
    13,
    2,
    3,
    50,
    129,
    true,
    14,
    "storm",
    "Medium Finale",
    0.3
  ),
  createLevel(31, 11, 2, 3, 55, 139, false, 17, "storm", "Hard Reset", 0.12),
  createLevel(
    32,
    12,
    2,
    3,
    60,
    149,
    true,
    16,
    "storm",
    "Flicker Maze",
    0.22
  ),
  createLevel(
    33,
    12,
    2,
    3,
    65,
    159,
    false,
    16,
    "storm",
    "Dense Sparks",
    0.16
  ),
  createLevel(
    34,
    12,
    2,
    3,
    70,
    169,
    true,
    15,
    "nova",
    "Flash Chamber",
    0.24
  ),
  createLevel(
    35,
    13,
    2,
    3,
    75,
    179,
    false,
    15,
    "nova",
    "Tight Orbit",
    0.18
  ),
  createLevel(
    36,
    13,
    2,
    3,
    80,
    189,
    true,
    14,
    "nova",
    "Crowded Charge",
    0.26
  ),
  createLevel(
    37,
    13,
    2,
    3,
    85,
    199,
    false,
    14,
    "nova",
    "Century Edge",
    0.18
  ),
  createLevel(38, 14, 2, 3, 90, 219, true, 14, "nova", "Overload", 0.27),
  createLevel(39, 14, 2, 3, 95, 239, true, 13, "nova", "Shock Spiral", 0.29),
  createLevel(
    40,
    14,
    2,
    3,
    100,
    259,
    true,
    13,
    "nova",
    "Hard Finale",
    0.32
  ),
  createLevel(
    41,
    12,
    3,
    3,
    110,
    279,
    false,
    16,
    "nova",
    "Triple Entry",
    0.12
  ),
  createLevel(
    42,
    12,
    3,
    3,
    120,
    299,
    true,
    15,
    "nova",
    "Triple Trap",
    0.22
  ),
  createLevel(
    43,
    13,
    3,
    3,
    130,
    319,
    true,
    15,
    "nova",
    "Heavy Flow",
    0.24
  ),
  createLevel(
    44,
    13,
    3,
    3,
    140,
    349,
    true,
    14,
    "nova",
    "Cranked Orbit",
    0.26
  ),
  createLevel(45, 13, 3, 3, 150, 379, true, 14, "nova", "Redline", 0.28),
  createLevel(
    46,
    14,
    3,
    3,
    160,
    409,
    true,
    13,
    "nova",
    "Signal Burn",
    0.3
  ),
  createLevel(
    47,
    14,
    3,
    3,
    170,
    439,
    true,
    13,
    "nova",
    "Flash Flood",
    0.32
  ),
  createLevel(
    48,
    14,
    3,
    3,
    180,
    469,
    true,
    12,
    "nova",
    "Near Maximum",
    0.34
  ),
  createLevel(49, 14, 3, 3, 190, 499, true, 12, "nova", "Last Stand", 0.36),
  createLevel(50, 14, 3, 3, 210, 549, true, 12, "nova", "Final Orbit", 0.38),
];

export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const pickRandom = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

export const capitalize = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export const formatLevelNumber = (value: number) => String(value).padStart(2, "0");

export const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
