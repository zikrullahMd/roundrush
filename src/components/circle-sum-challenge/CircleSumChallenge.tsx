"use client";

import type { CSSProperties } from "react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { AudioManager, audioConfig, type AudioType } from "./audio";
import styles from "./CircleSumChallenge.module.css";
import {
  CAMPAIGN_LEVELS,
  DEFAULT_PROGRESS,
  DIRECTIONS,
  STORAGE_KEY,
  TOTAL_CAMPAIGN_LEVELS,
  TRICKY_VALUES,
  capitalize,
  clamp,
  clone,
  formatLevelNumber,
  pickRandom,
  randomBetween,
  shuffleArray,
  wait,
  type Direction,
  type LevelConfig,
  type MessageState,
  type Mode,
  type Progress,
  type ResultState,
  type RoundData,
  type TraceItem,
} from "./config";
import {
  fetchMemeBatch,
  memeConfig,
  type MemeItem,
  type MemeOutcome,
} from "./meme";
import { loadProgress as serverLoadProgress, saveProgress as serverSaveProgress } from "@/app/actions";

type Screen = "start" | "game";
type ParticleType = "success" | "wrong" | "timeout";

type MessageCopy = {
  state: MessageState;
  kicker: string;
  title: string;
  text: string;
};

type CenterCopy = {
  phase: string;
  prompt: string;
  subPrompt: string;
};

type Particle = {
  id: number;
  type: ParticleType;
  x: number;
  y: number;
};

type MemeOverlayState = {
  visible: boolean;
  outcome: MemeOutcome | null;
  status: "idle" | "loading" | "ready" | "error";
  meme: MemeItem | null;
};

type GameState = {
  screen: Screen;
  mode: Mode;
  currentLevelNumber: number;
  currentConfig: LevelConfig | null;
  currentRound: RoundData | null;
  score: number;
  streak: number;
  comboMultiplier: number;
  fullRoundMs: number;
  remainingMs: number;
  isActive: boolean;
  isPaused: boolean;
  isPreviewing: boolean;
  resultState: ResultState;
  message: MessageCopy;
  center: CenterCopy;
  traceTitle: string;
  traceMeta: string;
  traceItems: TraceItem[];
  answer: string;
  previewIndex: number | null;
  stageEffect: "" | ParticleType;
  particles: Particle[];
};

const INITIAL_MESSAGE: MessageCopy = {
  state: "idle",
  kicker: "Status",
  title: "Round ready.",
  text: "Watch the orbit preview, then enter the final total.",
};

const INITIAL_CENTER_COPY: CenterCopy = {
  phase: "Stand By",
  prompt: "Choose a mode to start",
  subPrompt: "The preview will animate before input unlocks.",
};

const INITIAL_MEME_OVERLAY: MemeOverlayState = {
  visible: false,
  outcome: null,
  status: "idle",
  meme: null,
};

function createInitialGameState(): GameState {
  return {
    screen: "start",
    mode: "campaign",
    currentLevelNumber: 1,
    currentConfig: null,
    currentRound: null,
    score: 0,
    streak: 0,
    comboMultiplier: 1,
    fullRoundMs: 0,
    remainingMs: 0,
    isActive: false,
    isPaused: false,
    isPreviewing: false,
    resultState: "idle",
    message: INITIAL_MESSAGE,
    center: INITIAL_CENTER_COPY,
    traceTitle: "No resolved round yet",
    traceMeta: "Submit an answer to reveal the traversal order and running total.",
    traceItems: [],
    answer: "",
    previewIndex: null,
    stageEffect: "",
    particles: [],
  };
}

function loadProgressFromStorage(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return clone(DEFAULT_PROGRESS);
    }

    const parsed = JSON.parse(raw) as Partial<Progress>;
    return {
      ...clone(DEFAULT_PROGRESS),
      ...parsed,
      stats: {
        ...clone(DEFAULT_PROGRESS).stats,
        ...(parsed.stats || {}),
      },
    };
  } catch (error) {
    console.warn("Failed to load Circle Sum Challenge progress.", error);
    return clone(DEFAULT_PROGRESS);
  }
}

function getDigitCount(value: number) {
  return String(Math.abs(value)).length;
}

function matchesDigitRange(value: number, levelConfig: LevelConfig) {
  const digits = getDigitCount(value);
  return digits >= levelConfig.digitMin && digits <= levelConfig.digitMax;
}

function canUseValue(
  value: number,
  levelConfig: LevelConfig,
  usedCounts: Map<number, number>,
  repeatCap: number
) {
  return (
    value >= levelConfig.minValue &&
    value <= levelConfig.maxValue &&
    matchesDigitRange(value, levelConfig) &&
    (usedCounts.get(value) || 0) < repeatCap
  );
}

function getTrickyPool(levelConfig: LevelConfig) {
  return TRICKY_VALUES.filter(
    (value) =>
      value >= levelConfig.minValue &&
      value <= levelConfig.maxValue &&
      matchesDigitRange(value, levelConfig)
  );
}

function getInterestingValues(
  minValue: number,
  maxValue: number,
  levelConfig: LevelConfig
) {
  const interestingValues: number[] = [];

  for (let value = minValue; value <= maxValue; value += 1) {
    if (!matchesDigitRange(value, levelConfig)) {
      continue;
    }

    const text = String(value);
    const lastDigit = Number(text[text.length - 1]);
    const repeatedDigits = /(\d)\1/.test(text);
    const punchyEnding = [0, 7, 8, 9].includes(lastDigit);
    const mirrored = text.length >= 2 && text[0] === text[text.length - 1];

    if (repeatedDigits || punchyEnding || mirrored || TRICKY_VALUES.includes(value)) {
      interestingValues.push(value);
    }
  }

  return interestingValues;
}

function generateValue(
  bucket: [number, number],
  levelConfig: LevelConfig,
  usedCounts: Map<number, number>,
  repeatCap: number,
  attempts = 55
) {
  const [bucketMin, bucketMax] = bucket;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let value: number | null = null;
    const specialChance = levelConfig.level >= 12 ? 0.32 : 0.16;

    if (Math.random() < specialChance) {
      const interestingValues = getInterestingValues(
        bucketMin,
        bucketMax,
        levelConfig
      ).filter((candidate) =>
        canUseValue(candidate, levelConfig, usedCounts, repeatCap)
      );

      if (interestingValues.length > 0) {
        value = pickRandom(interestingValues);
      }
    }

    if (value === null) {
      value = randomBetween(bucketMin, bucketMax);
    }

    if (!canUseValue(value, levelConfig, usedCounts, repeatCap)) {
      continue;
    }

    return value;
  }

  return null;
}

function pickFromPool(
  pool: number[],
  bucket: [number, number],
  levelConfig: LevelConfig,
  usedCounts: Map<number, number>,
  repeatCap: number
) {
  const [bucketMin, bucketMax] = bucket;
  const bucketMatches = pool.filter(
    (value) =>
      value >= bucketMin &&
      value <= bucketMax &&
      canUseValue(value, levelConfig, usedCounts, repeatCap)
  );

  if (bucketMatches.length > 0) {
    return pickRandom(bucketMatches);
  }

  const fallback = pool.filter((value) =>
    canUseValue(value, levelConfig, usedCounts, repeatCap)
  );

  return fallback.length > 0 ? pickRandom(fallback) : null;
}

// Number generation deliberately mixes low, mid, and high values so each ring
// feels designed rather than purely random, while still injecting harder traps.
function generateNumbers(levelConfig: LevelConfig) {
  const numbers: number[] = [];
  const usedCounts = new Map<number, number>();
  const trickyPool = getTrickyPool(levelConfig);
  const repeatCap = levelConfig.level <= 10 ? 2 : 1;
  const trickyTarget = levelConfig.tricky
    ? Math.max(1, Math.round(levelConfig.count * levelConfig.trickyChance))
    : 0;

  const range = levelConfig.maxValue - levelConfig.minValue;
  const lowMax = Math.floor(levelConfig.minValue + range * 0.28);
  const midMin = Math.floor(levelConfig.minValue + range * 0.24);
  const midMax = Math.floor(levelConfig.minValue + range * 0.68);
  const highMin = Math.floor(levelConfig.minValue + range * 0.62);
  const buckets: [number, number][] = [
    [levelConfig.minValue, lowMax],
    [midMin, midMax],
    [highMin, levelConfig.maxValue],
  ];

  let trickyPlaced = 0;

  for (let slot = 0; slot < levelConfig.count; slot += 1) {
    const bucket = buckets[slot % buckets.length];
    const mustUseTricky =
      trickyPlaced < trickyTarget &&
      levelConfig.count - slot <= trickyTarget - trickyPlaced;
    const shouldUseTricky =
      levelConfig.tricky &&
      trickyPool.length > 0 &&
      (mustUseTricky || Math.random() < 0.5);

    let value =
      shouldUseTricky
        ? pickFromPool(trickyPool, bucket, levelConfig, usedCounts, repeatCap)
        : null;

    if (value === null) {
      value = generateValue(bucket, levelConfig, usedCounts, repeatCap);
    }

    if (value === null) {
      value = generateValue(
        [levelConfig.minValue, levelConfig.maxValue],
        levelConfig,
        usedCounts,
        repeatCap,
        90
      );
    }

    if (value === null) {
      value = levelConfig.minValue;
    }

    if (TRICKY_VALUES.includes(value)) {
      trickyPlaced += 1;
    }

    numbers.push(value);
    usedCounts.set(value, (usedCounts.get(value) || 0) + 1);
  }

  if (
    levelConfig.tricky &&
    trickyPool.length > 0 &&
    !numbers.some((value) => TRICKY_VALUES.includes(value))
  ) {
    numbers[randomBetween(0, numbers.length - 1)] = pickRandom(trickyPool);
  }

  if (levelConfig.digitMax > levelConfig.digitMin) {
    const hasUpperDigit = numbers.some(
      (value) => getDigitCount(value) === levelConfig.digitMax
    );

    if (!hasUpperDigit) {
      const replacementIndex = numbers.findIndex(
        (value) => getDigitCount(value) === levelConfig.digitMin
      );
      const forcedUpper = generateValue(
        [
          Math.max(levelConfig.minValue, 10 ** (levelConfig.digitMax - 1)),
          levelConfig.maxValue,
        ],
        levelConfig,
        new Map<number, number>(),
        repeatCap,
        100
      );

      if (replacementIndex >= 0 && forcedUpper !== null) {
        numbers[replacementIndex] = forcedUpper;
      }
    }
  }

  return shuffleArray(numbers);
}

function generateLevelData(levelConfig: LevelConfig): RoundData {
  const numbers = generateNumbers(levelConfig);
  const startIndex = randomBetween(0, numbers.length - 1);
  const direction: Direction = Math.random() < 0.5 ? "clockwise" : "anticlockwise";
  const pathIndices: number[] = [];
  const pathValues: number[] = [];
  const runningTotals: number[] = [];
  const step = direction === "clockwise" ? 1 : -1;

  let runningTotal = 0;
  for (let move = 0; move < numbers.length; move += 1) {
    const index = (startIndex + move * step + numbers.length) % numbers.length;
    pathIndices.push(index);
    pathValues.push(numbers[index]);
    runningTotal += numbers[index];
    runningTotals.push(runningTotal);
  }

  return {
    numbers,
    startIndex,
    direction,
    pathIndices,
    pathValues,
    runningTotals,
    correctSum: runningTotal,
  };
}

function buildEndlessConfig(wave: number): LevelConfig {
  const base = CAMPAIGN_LEVELS[Math.min(wave - 1, CAMPAIGN_LEVELS.length - 1)];
  const overflow = Math.max(0, wave - CAMPAIGN_LEVELS.length);
  const digitMin = wave > 32 ? 3 : base.digitMin;
  const digitMax = wave > 20 ? 3 : base.digitMax;
  const minValue = Math.max(
    digitMin === 3 ? 100 : base.minValue,
    base.minValue + overflow * 8
  );
  const maxValue = base.maxValue + overflow * 12;

  return {
    ...base,
    level: wave,
    count: clamp(base.count + Math.floor(overflow / 5), 8, 16),
    digitMin,
    digitMax,
    minValue,
    maxValue,
    tricky: true,
    timeLimit: Math.max(10, base.timeLimit - Math.floor(overflow / 7)),
    intensity: overflow > 12 ? "nova" : base.intensity,
    name: `Endless Wave ${formatLevelNumber(wave)}`,
    trickyChance: clamp((base.trickyChance || 0.2) + overflow * 0.01, 0.18, 0.52),
  };
}

function calculateAward(
  levelConfig: LevelConfig,
  remainingSeconds: number,
  streakCount: number
) {
  const base = 110 + levelConfig.level * 14 + levelConfig.count * 10;
  const timeBonus = Math.round(remainingSeconds * 16);
  const streakBonus = Math.max(0, streakCount - 1) * 25;
  const comboMultiplier = 1 + Math.min(streakCount - 1, 8) * 0.05;
  const total = Math.round((base + timeBonus + streakBonus) * comboMultiplier);

  return { base, timeBonus, streakBonus, comboMultiplier, total };
}

function calculatePenalty(levelConfig: LevelConfig, timedOut: boolean) {
  const basePenalty = 16 + Math.round(levelConfig.level * 1.6);
  return timedOut ? basePenalty + 12 : basePenalty;
}

function sanitizeInput(rawValue: string) {
  const cleaned = rawValue.replace(/[^\d-]/g, "");
  if (cleaned.startsWith("-")) {
    return `-${cleaned.slice(1).replace(/-/g, "")}`;
  }

  return cleaned.replace(/-/g, "");
}

function buildTraceData(round: RoundData, resultState: ResultState): TraceItem[] {
  const variant = resultState === "success" ? "success" : "failure";

  return round.pathValues.map((value, index) => ({
    stepLabel: index === 0 ? "Start" : `Step ${index + 1}`,
    valueLabel: index === 0 ? `${value}` : `+ ${value}`,
    totalLabel: `Running total ${round.runningTotals[index]}`,
    variant,
  }));
}

function buildParticles(type: ParticleType, seedRef: { current: number }) {
  const particleCount = type === "success" ? 26 : 18;

  return Array.from({ length: particleCount }, (_, index) => {
    seedRef.current = (seedRef.current || 0) + 1;
    const angle = (Math.PI * 2 * index) / particleCount;
    const distance = randomBetween(80, 220);

    return {
      id: seedRef.current || index,
      type,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
    };
  });
}

export default function CircleSumChallenge() {
  const [game, setGameState] = useState<GameState>(() => createInitialGameState());
  const [progress, setProgressState] = useState<Progress>(() =>
    clone(DEFAULT_PROGRESS)
  );
  const [memeOverlay, setMemeOverlay] =
    useState<MemeOverlayState>(INITIAL_MEME_OVERLAY);
  const [viewportWidth, setViewportWidth] = useState(1280);
  const answerInputRef = useRef<HTMLInputElement | null>(null);
  const timerRef = useRef<{ intervalId: number | null; anchorMs: number; startedAt: number }>({
    intervalId: null,
    anchorMs: 0,
    startedAt: 0,
  });
  const roundTokenRef = useRef(0);
  const queuedTimeoutsRef = useRef<number[]>([]);
  const particleSeedRef = useRef(0);
  const gameRef = useRef(game);
  const progressRef = useRef(progress);
  const audioRef = useRef<AudioManager | null>(null);
  const memePoolsRef = useRef<Record<MemeOutcome, MemeItem[]>>({
    correct: [],
    wrong: [],
  });
  const memeFetchRef = useRef<Record<MemeOutcome, Promise<void> | null>>({
    correct: null,
    wrong: null,
  });
  const memeHideTimeoutRef = useRef<number | null>(null);
  const memeRequestIdRef = useRef(0);
  const memeClipRef = useRef<HTMLAudioElement | null>(null);

  if (!audioRef.current) {
    audioRef.current = new AudioManager();
  }

  function syncGame(next: GameState | ((current: GameState) => GameState)) {
    const resolved = typeof next === "function" ? next(gameRef.current) : next;
    gameRef.current = resolved;
    setGameState(resolved);
  }

  function patchGame(patch: Partial<GameState>) {
    syncGame((current) => ({
      ...current,
      ...patch,
    }));
  }

  function syncProgress(next: Progress | ((current: Progress) => Progress)) {
    const resolved =
      typeof next === "function" ? next(progressRef.current) : next;
    progressRef.current = resolved;
    setProgressState(resolved);
  }

  function queueTimeout(callback: () => void, ms: number) {
    const timeoutId = window.setTimeout(() => {
      queuedTimeoutsRef.current = queuedTimeoutsRef.current.filter(
        (queuedId) => queuedId !== timeoutId
      );
      callback();
    }, ms);

    queuedTimeoutsRef.current.push(timeoutId);
    return timeoutId;
  }

  function clearQueuedTimeouts() {
    queuedTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    queuedTimeoutsRef.current = [];
  }

  const initGame = useEffectEvent(() => {
    // Optimistically load from localstorage first
    const localProgress = loadProgressFromStorage();
    syncProgress(localProgress);
    audioRef.current?.setMuted(!localProgress.soundEnabled);
    audioRef.current?.setSfxVolume(localProgress.sfxVolume);
    audioRef.current?.setMusicVolume(localProgress.musicVolume);

    // Then try loading from the server
    serverLoadProgress()
      .then((serverProgress) => {
        if (serverProgress) {
          syncProgress(serverProgress);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverProgress));
          audioRef.current?.setMuted(!serverProgress.soundEnabled);
          audioRef.current?.setSfxVolume(serverProgress.sfxVolume);
          audioRef.current?.setMusicVolume(serverProgress.musicVolume);
        }
      })
      .catch((err) => {
        console.warn("Failed to sync initial progress from server", err);
      });
  });

  function loadProgress() {
    return loadProgressFromStorage();
  }

  function saveProgress(nextProgress?: Progress) {
    const payload = nextProgress ?? progressRef.current;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    serverSaveProgress(payload).catch((err) => {
      console.warn("Failed to sync progress to server.", err);
    });
  }

  function updateScore(nextScore: number, nextStreak: number, nextCombo: number) {
    patchGame({
      score: nextScore,
      streak: nextStreak,
      comboMultiplier: nextCombo,
    });
  }

  function playSound(type: AudioType) {
    return audioRef.current?.play(type) ?? null;
  }

  function clearMemeHideTimeout() {
    if (memeHideTimeoutRef.current !== null) {
      window.clearTimeout(memeHideTimeoutRef.current);
      memeHideTimeoutRef.current = null;
    }
  }

  function hideMemeOverlay() {
    clearMemeHideTimeout();
    memeRequestIdRef.current += 1;
    setMemeOverlay(INITIAL_MEME_OVERLAY);

    // Stop the meme audio clip
    if (memeClipRef.current) {
      memeClipRef.current.pause();
      memeClipRef.current.currentTime = 0;
      memeClipRef.current = null;
    }

    // If the player got the answer correct, advance to the next level immediately
    if (gameRef.current.resultState === "success") {
      goToNextLevel();
    }
  }

  // Prefetch a small meme pool so the popup can appear immediately with the sound.
  async function warmMemePool(outcome: MemeOutcome) {
    if (memePoolsRef.current[outcome].length >= memeConfig.minPoolSize) {
      return;
    }

    if (memeFetchRef.current[outcome]) {
      return memeFetchRef.current[outcome];
    }

    const fetchPromise = fetchMemeBatch(outcome)
      .then((memes) => {
        if (memes.length > 0) {
          memePoolsRef.current[outcome].push(...memes);
        }
      })
      .catch((error) => {
        console.warn(`Failed to load ${outcome} memes.`, error);
      })
      .finally(() => {
        memeFetchRef.current[outcome] = null;
      });

    memeFetchRef.current[outcome] = fetchPromise;
    return fetchPromise;
  }

  function scheduleMemeOverlayHide(
    clip: HTMLAudioElement | null,
    requestId: number
  ) {
    clearMemeHideTimeout();

    const closeOverlay = () => {
      if (requestId !== memeRequestIdRef.current) {
        return;
      }
      setMemeOverlay(INITIAL_MEME_OVERLAY);
    };

    if (clip) {
      // Close 120ms after the audio clip actually finishes — no timer cap
      clip.addEventListener("ended", () => {
        clearMemeHideTimeout();
        memeHideTimeoutRef.current = window.setTimeout(closeOverlay, 120);
      }, { once: true });

      // If the audio errors (e.g. network failure), close immediately
      clip.addEventListener("error", () => {
        clearMemeHideTimeout();
        closeOverlay();
      }, { once: true });

      // Absolute safety guard: if audio never ends or errors after 30s, close anyway
      memeHideTimeoutRef.current = window.setTimeout(closeOverlay, 30_000);
    } else {
      // No audio — fall back to default display duration
      memeHideTimeoutRef.current = window.setTimeout(closeOverlay, memeConfig.displayDurationMs);
    }
  }

  async function showResultMeme(
    outcome: MemeOutcome,
    clip: HTMLAudioElement | null
  ) {
    const requestId = memeRequestIdRef.current + 1;
    memeRequestIdRef.current = requestId;

    setMemeOverlay({
      visible: true,
      outcome,
      status: "loading",
      meme: null,
    });

    let nextMeme = memePoolsRef.current[outcome].shift() ?? null;
    if (!nextMeme) {
      await warmMemePool(outcome);
      nextMeme = memePoolsRef.current[outcome].shift() ?? null;
    }

    if (requestId !== memeRequestIdRef.current) {
      return;
    }

    setMemeOverlay({
      visible: true,
      outcome,
      status: nextMeme ? "ready" : "error",
      meme: nextMeme,
    });

    memeClipRef.current = clip;
    scheduleMemeOverlayHide(clip, requestId);
    void warmMemePool(outcome);
  }

  function getModeRoundLabel(levelNumber = gameRef.current.currentLevelNumber) {
    return gameRef.current.mode === "campaign"
      ? `Level ${formatLevelNumber(levelNumber)}`
      : `Wave ${formatLevelNumber(levelNumber)}`;
  }

  function startMode(mode: Mode, forcedLevel?: number) {
    audioRef.current?.markUserGesture();
    stopTimer();
    clearQueuedTimeouts();
    hideMemeOverlay();
    roundTokenRef.current += 1;

    const startingLevel =
      forcedLevel ??
      (mode === "campaign"
        ? clamp(progressRef.current.unlockedLevel, 1, TOTAL_CAMPAIGN_LEVELS)
        : 1);

    syncGame({
      ...createInitialGameState(),
      screen: "game",
      mode,
      currentLevelNumber: startingLevel,
    });

    audioRef.current?.startBgm();
    void loadLevel(startingLevel, mode);
  }

  async function loadLevel(levelNumber: number, forcedMode?: Mode) {
    stopTimer();
    clearQueuedTimeouts();
    hideMemeOverlay();
    roundTokenRef.current += 1;
    const roundToken = roundTokenRef.current;

    const mode = forcedMode ?? gameRef.current.mode;
    const levelConfig =
      mode === "campaign"
        ? CAMPAIGN_LEVELS[levelNumber - 1]
        : buildEndlessConfig(levelNumber);
    const roundData = generateLevelData(levelConfig);

    syncGame((current) => ({
      ...current,
      screen: "game",
      mode,
      currentLevelNumber: levelNumber,
      currentConfig: levelConfig,
      currentRound: roundData,
      fullRoundMs: levelConfig.timeLimit * 1000,
      remainingMs: levelConfig.timeLimit * 1000,
      isActive: false,
      isPaused: false,
      isPreviewing: true,
      resultState: "preview",
      message: {
        state: "preview",
        kicker: "Preview",
        title: "Preview incoming.",
        text: "Track the orbit now. Input unlocks after the traversal preview finishes.",
      },
      center: {
        phase: "Orbit Preview",
        prompt: `${mode === "campaign" ? "Level" : "Wave"} ${formatLevelNumber(levelNumber)} loading`,
        subPrompt: "Watch the ring light up before the timer starts.",
      },
      traceTitle: "No resolved round yet",
      traceMeta:
        "Submit an answer to reveal the traversal order and running total.",
      traceItems: [],
      answer: "",
      previewIndex: null,
      stageEffect: "",
      particles: [],
      comboMultiplier: 1 + Math.min(current.streak, 8) * 0.05,
    }));

    await wait(420);
    if (roundToken !== roundTokenRef.current) {
      return;
    }

    await animatePreview(roundToken, roundData, levelConfig);
    if (roundToken !== roundTokenRef.current) {
      return;
    }

    patchGame({
      isPreviewing: false,
      isActive: true,
      resultState: "active",
      message: {
        state: "active",
        kicker: "Live",
        title: "Timer live.",
        text: "Add every node once in the shown direction, then submit the final total.",
      },
      center: {
        phase: "Add the Orbit",
        prompt: "Lock the total",
        subPrompt:
          "You only need the final sum. The glow closes when you loop back to the start.",
      },
      previewIndex: null,
    });

    startTimer(levelConfig.timeLimit);
    queueTimeout(() => {
      answerInputRef.current?.focus();
    }, 30);
  }

  async function animatePreview(
    roundToken: number,
    roundData: RoundData,
    levelConfig: LevelConfig
  ) {
    const previewDelay = clamp(250 - levelConfig.level * 2, 100, 180);

    for (const index of roundData.pathIndices) {
      if (roundToken !== roundTokenRef.current) {
        return;
      }

      patchGame({
        previewIndex: index,
      });

      await wait(previewDelay);

      if (roundToken !== roundTokenRef.current) {
        return;
      }

      patchGame({
        previewIndex: null,
      });
    }
  }

  function startTimer(seconds: number) {
    startTimerFromRemaining(seconds * 1000);
  }

  function startTimerFromRemaining(remainingMs: number) {
    stopTimer();
    timerRef.current.anchorMs = remainingMs;
    timerRef.current.startedAt = performance.now();

    timerRef.current.intervalId = window.setInterval(() => {
      const currentGame = gameRef.current;
      if (!currentGame.isActive || currentGame.isPaused) {
        return;
      }

      const nextRemainingMs = Math.max(
        0,
        timerRef.current.anchorMs - (performance.now() - timerRef.current.startedAt)
      );

      patchGame({
        remainingMs: nextRemainingMs,
      });

      if (nextRemainingMs <= 0) {
        handleTimeout();
      }
    }, 40);
  }

  function stopTimer() {
    if (timerRef.current.intervalId !== null) {
      window.clearInterval(timerRef.current.intervalId);
      timerRef.current.intervalId = null;
    }
  }

  function checkAnswer(playerAnswer: number) {
    const round = gameRef.current.currentRound;
    return round ? playerAnswer === round.correctSum : false;
  }

  function submitAnswer() {
    const currentGame = gameRef.current;
    if (
      !currentGame.isActive ||
      currentGame.isPreviewing ||
      currentGame.isPaused ||
      !currentGame.currentRound
    ) {
      return;
    }

    if (!/^-?\d+$/.test(currentGame.answer.trim())) {
      patchGame({
        message: {
          state: "active",
          kicker: "Input",
          title: "Whole numbers only.",
          text: "Enter a clean integer with no commas, words, or decimals.",
        },
      });

      answerInputRef.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 260, easing: "ease-out" }
      );
      return;
    }

    const answer = Number(currentGame.answer.trim());
    const responseMs = currentGame.fullRoundMs - currentGame.remainingMs;
    const remainingSeconds = currentGame.remainingMs / 1000;

    stopTimer();
    patchGame({
      isActive: false,
    });

    if (checkAnswer(answer)) {
      handleCorrect(answer, remainingSeconds, responseMs);
      return;
    }

    handleWrong(answer, responseMs, false);
  }

  function handleCorrect(
    playerAnswer: number,
    remainingSeconds: number,
    responseMs: number
  ) {
    const currentGame = gameRef.current;
    const currentProgress = progressRef.current;
    if (!currentGame.currentConfig || !currentGame.currentRound) {
      return;
    }

    const nextStreak = currentGame.streak + 1;
    const award = calculateAward(
      currentGame.currentConfig,
      remainingSeconds,
      nextStreak
    );
    const nextScore = currentGame.score + award.total;
    const nextProgress: Progress = {
      ...currentProgress,
      bestScore: Math.max(currentProgress.bestScore, nextScore),
      bestStreak: Math.max(currentProgress.bestStreak, nextStreak),
      bestEndlessWave:
        currentGame.mode === "endless"
          ? Math.max(
              currentProgress.bestEndlessWave,
              currentGame.currentLevelNumber
            )
          : currentProgress.bestEndlessWave,
      unlockedLevel:
        currentGame.mode === "campaign"
          ? Math.min(
              TOTAL_CAMPAIGN_LEVELS,
              Math.max(
                currentProgress.unlockedLevel,
                currentGame.currentLevelNumber + 1
              )
            )
          : currentProgress.unlockedLevel,
      stats: {
        roundsPlayed: currentProgress.stats.roundsPlayed + 1,
        correctAnswers: currentProgress.stats.correctAnswers + 1,
        totalResponseMs: currentProgress.stats.totalResponseMs + responseMs,
      },
    };

    syncProgress(nextProgress);
    saveProgress(nextProgress);
    updateScore(nextScore, nextStreak, award.comboMultiplier);

    patchGame({
      resultState: "success",
      message: {
        state: "success",
        kicker: "Success",
        title: "Direct hit.",
        text: `Correct total: ${playerAnswer}. You earned ${award.total} points with a combo multiplier of x${award.comboMultiplier.toFixed(
          2
        )}.`,
      },
      center: {
        phase: "Direct Hit",
        prompt: `${playerAnswer} is correct`,
        subPrompt: `+${award.total} points • base ${award.base} • time ${award.timeBonus} • streak ${award.streakBonus}`,
      },
      traceItems: buildTraceData(currentGame.currentRound, "success"),
      traceTitle: `Correct total: ${currentGame.currentRound.correctSum}`,
      traceMeta: `${currentGame.currentRound.pathValues.length} steps traced from Node ${
        currentGame.currentRound.startIndex + 1
      } ${DIRECTIONS[currentGame.currentRound.direction].label.toLowerCase()}.`,
      stageEffect: "success",
      particles: buildParticles("success", particleSeedRef),
    });

    const primarySuccessSound: AudioType =
      audioConfig.correct.length > 0 ? "correct" : "levelComplete";

    const clip = playSound(primarySuccessSound);
    void showResultMeme("correct", clip);
  }

  function handleWrong(
    playerAnswer: number | null,
    responseMs: number,
    timedOut: boolean
  ) {
    const currentGame = gameRef.current;
    const currentProgress = progressRef.current;
    if (!currentGame.currentConfig || !currentGame.currentRound) {
      return;
    }

    const penalty = calculatePenalty(currentGame.currentConfig, timedOut);
    const nextScore = Math.max(0, currentGame.score - penalty);
    const correctTotal = currentGame.currentRound.correctSum;
    const difference =
      typeof playerAnswer === "number" ? Math.abs(correctTotal - playerAnswer) : null;

    const nextProgress: Progress = {
      ...currentProgress,
      bestScore: Math.max(currentProgress.bestScore, nextScore),
      stats: {
        ...currentProgress.stats,
        roundsPlayed: currentProgress.stats.roundsPlayed + 1,
        totalResponseMs: currentProgress.stats.totalResponseMs + responseMs,
      },
    };

    syncProgress(nextProgress);
    saveProgress(nextProgress);
    updateScore(nextScore, 0, 1);

    patchGame({
      resultState: timedOut ? "timeout" : "wrong",
      message: timedOut
        ? {
            state: "timeout",
            kicker: "Timeout",
            title: "Timer expired.",
            text: `Time ran out. The correct total was ${correctTotal}. Retry the same round to recover your flow.`,
          }
        : {
            state: "wrong",
            kicker: "Miss",
            title: "Not quite.",
            text: `Your answer was off by ${difference}. The correct total was ${correctTotal}.`,
          },
      center: timedOut
        ? {
            phase: "Time Out",
            prompt: `Correct total ${correctTotal}`,
            subPrompt: `Penalty ${penalty} • the timer hit zero before submission.`,
          }
        : {
            phase: "Missed",
            prompt: `Correct total ${correctTotal}`,
            subPrompt: `You were off by ${difference}. Penalty ${penalty}.`,
          },
      traceItems: buildTraceData(currentGame.currentRound, timedOut ? "timeout" : "wrong"),
      traceTitle: `Correct total: ${correctTotal}`,
      traceMeta: "Review the full path below, then retry the same round.",
      stageEffect: timedOut ? "timeout" : "wrong",
      particles: buildParticles(timedOut ? "timeout" : "wrong", particleSeedRef),
    });

    const clip = playSound(timedOut ? "timeout" : "wrong");
    void showResultMeme("wrong", clip);
  }

  function handleTimeout() {
    const currentGame = gameRef.current;
    if (!currentGame.isActive || !currentGame.currentRound) {
      return;
    }

    stopTimer();
    patchGame({
      isActive: false,
    });
    handleWrong(null, currentGame.fullRoundMs, true);
  }

  function togglePause(forceState?: boolean, skipResume = false) {
    const currentGame = gameRef.current;
    if (!currentGame.currentRound) {
      return;
    }

    const shouldPause =
      typeof forceState === "boolean" ? forceState : !currentGame.isPaused;

    if (shouldPause && !currentGame.isPaused) {
      if (!currentGame.isActive) {
        return;
      }

      stopTimer();
      patchGame({
        isPaused: true,
      });
      audioRef.current?.pauseBgm();
      return;
    }

    if (!shouldPause && currentGame.isPaused) {
      patchGame({
        isPaused: false,
      });
      audioRef.current?.resumeBgm();
      if (!skipResume && currentGame.resultState === "active") {
        startTimerFromRemaining(currentGame.remainingMs);
        queueTimeout(() => answerInputRef.current?.focus(), 30);
      }
    }
  }

  function resetLevel() {
    if (gameRef.current.screen !== "game" || !gameRef.current.currentRound) {
      return;
    }

    void loadLevel(gameRef.current.currentLevelNumber);
  }

  function goToNextLevel() {
    const currentGame = gameRef.current;
    if (currentGame.screen !== "game" || currentGame.resultState !== "success") {
      return;
    }

    if (currentGame.mode === "campaign") {
      if (currentGame.currentLevelNumber >= TOTAL_CAMPAIGN_LEVELS) {
        startMode("campaign", 1);
        return;
      }

      void loadLevel(currentGame.currentLevelNumber + 1);
      return;
    }

    void loadLevel(currentGame.currentLevelNumber + 1);
  }

  function returnToMenu() {
    stopTimer();
    clearQueuedTimeouts();
    hideMemeOverlay();
    roundTokenRef.current += 1;
    audioRef.current?.pauseBgm();
    syncGame(createInitialGameState());
  }

  const onGlobalKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const currentGame = gameRef.current;
    if (currentGame.screen !== "game") {
      return;
    }

    const key = event.key.toLowerCase();

    if (event.key === "Enter" && document.activeElement !== answerInputRef.current) {
      event.preventDefault();
      submitAnswer();
    }

    if (key === "r") {
      event.preventDefault();
      resetLevel();
    }

    if (key === "n" && currentGame.resultState === "success") {
      event.preventDefault();
      goToNextLevel();
    }

    if (key === "p" || event.key === "Escape") {
      event.preventDefault();
      togglePause();
    }
  });

  const onVisibilityChange = useEffectEvent(() => {
    const currentGame = gameRef.current;
    if (
      document.hidden &&
      currentGame.screen === "game" &&
      currentGame.isActive &&
      !currentGame.isPaused
    ) {
      togglePause(true);
    }
  });

  useEffect(() => {
    initGame();
    setViewportWidth(window.innerWidth);
    void warmMemePool("correct");
    void warmMemePool("wrong");

    const markAudioReady = () => {
      audioRef.current?.markUserGesture();
    };

    document.addEventListener("pointerdown", markAudioReady, { passive: true });
    document.addEventListener("keydown", markAudioReady);

    return () => {
      stopTimer();
      clearQueuedTimeouts();
      clearMemeHideTimeout();
      memeRequestIdRef.current += 1;
      audioRef.current?.pauseBgm();
      document.removeEventListener("pointerdown", markAudioReady);
      document.removeEventListener("keydown", markAudioReady);
    };
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    document.addEventListener("keydown", onGlobalKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("keydown", onGlobalKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  function updateTimerUi(remainingMs: number, fullRoundMs: number) {
    const totalMs = Math.max(fullRoundMs, 1);
    const remainingSeconds = remainingMs / 1000;
    const totalSeconds = totalMs / 1000;
    const percent = clamp(remainingMs / totalMs, 0, 1);
    const angle = `${percent * 360}deg`;
    const timerTone =
      percent <= 0.25 ? "danger" : percent <= 0.5 ? "warning" : "calm";

    return {
      remainingSeconds,
      totalSeconds,
      percent,
      angle,
      timerTone,
    };
  }

  function renderCircle(
    numbers: number[],
    startIndex: number,
    direction: Direction
  ) {
    const count = numbers.length;
    const maxDigits = Math.max(...numbers.map((value) => getDigitCount(value)));
    const viewportScale =
      viewportWidth < 520 ? 0.82 : viewportWidth < 720 ? 0.9 : 1;
    const nodeSize = clamp(
      (92 - count * 2.8 - (maxDigits - 1) * 8) * viewportScale,
      56,
      86
    );
    const radiusPercent = clamp(32 + count * 0.68 - maxDigits * 1.7, 27, 39);
    const pathSet = new Set(game.currentRound?.pathIndices ?? []);
    const directionMeta = DIRECTIONS[direction];

    return {
      nodeSize,
      radiusPercent,
      directionMeta,
      nodes: numbers.map((value, index) => {
        const angle = (-90 + (360 / count) * index) * (Math.PI / 180);
        const x = 50 + Math.cos(angle) * radiusPercent;
        const y = 50 + Math.sin(angle) * radiusPercent;
        const pathClass =
          pathSet.has(index) && game.resultState === "success"
            ? "csc-is-path-success"
            : pathSet.has(index) && game.resultState === "wrong"
              ? "csc-is-path-failure"
              : pathSet.has(index) && game.resultState === "timeout"
                ? "csc-is-path-timeout"
                : "";

        return (
          <div
            key={`${index}-${value}`}
            className={[
              "csc-circle-node",
              index === startIndex ? "csc-is-start" : "",
              game.previewIndex === index ? "csc-is-preview" : "",
              pathClass,
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${nodeSize}px`,
              height: `${nodeSize}px`,
              ["--node-delay" as string]: `${index * 40}ms`,
            }}
          >
            <span className="csc-node-index">#{index + 1}</span>
            <span className="csc-node-value">{value}</span>
            {index === startIndex ? <span className="csc-start-tag">Start</span> : null}
          </div>
        );
      }),
    };
  }

  const timerUi = updateTimerUi(game.remainingMs, game.fullRoundMs || 1);
  const circleUi = game.currentRound
    ? renderCircle(
        game.currentRound.numbers,
        game.currentRound.startIndex,
        game.currentRound.direction
      )
    : null;

  const currentDirectionMeta = game.currentRound
    ? DIRECTIONS[game.currentRound.direction]
    : DIRECTIONS.clockwise;
  const currentConfig = game.currentConfig;
  const currentRound = game.currentRound;
  const isGameScreen = game.screen === "game";
  const isSubmitDisabled = !game.isActive || game.isPaused;
  const showNextButton = game.resultState === "success";
  const nextButtonLabel =
    game.mode === "campaign" && game.currentLevelNumber === TOTAL_CAMPAIGN_LEVELS
      ? "Play Again"
      : game.mode === "campaign"
        ? "Next Level"
        : "Next Wave";
  const campaignProgress = Math.min(progress.unlockedLevel, TOTAL_CAMPAIGN_LEVELS);
  const campaignProgressPercent = (campaignProgress / TOTAL_CAMPAIGN_LEVELS) * 100;

  return (
    <div className={styles.root}>
      <div className="csc-app-shell">
        <header className="csc-app-header">
          <div className="csc-brand-block">
            <p className="csc-eyebrow">Educational Math Practice</p>
            <h1>Circle Sum Challenge</h1>
            <p className="csc-subtitle">
              Start from the highlighted number, follow the given direction, and
              enter the final total before time runs out.
            </p>
          </div>

          <div className="csc-header-actions">
            <button
              type="button"
              className="csc-ghost-btn"
              onClick={() => {
                playSound("click");
                const nextProgress = {
                  ...progressRef.current,
                  soundEnabled: !progressRef.current.soundEnabled,
                };
                audioRef.current?.setMuted(!nextProgress.soundEnabled);
                syncProgress(nextProgress);
                saveProgress(nextProgress);
              }}
            >
              Sound {progress.soundEnabled ? "On" : "Off"}
            </button>

            {isGameScreen ? (
              <>
                <button
                  type="button"
                  className="csc-ghost-btn"
                  onClick={() => {
                    playSound("click");
                    returnToMenu();
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="csc-ghost-btn"
                  onClick={() => {
                    playSound("click");
                    togglePause();
                  }}
                  disabled={!game.isActive && !game.isPaused}
                >
                  {game.isPaused ? "Resume" : "Pause"}
                </button>
              </>
            ) : null}
          </div>
        </header>

        {game.screen === "start" ? (
          <main className="csc-app-main">
            <section className="csc-panel csc-start-card">
              <div className="csc-start-copy">
                <h2>Focused arithmetic practice</h2>
                <p>
                  Each round shows a circle of numbers, a starting point, and a
                  direction. Add the values in order and enter the final sum.
                </p>
              </div>

              <div className="csc-start-steps">
                <div className="csc-step-item">
                  <span className="csc-step-number">1</span>
                  <p>Begin at the highlighted node.</p>
                </div>
                <div className="csc-step-item">
                  <span className="csc-step-number">2</span>
                  <p>Move clockwise or anti-clockwise as shown.</p>
                </div>
                <div className="csc-step-item">
                  <span className="csc-step-number">3</span>
                  <p>Enter one whole-number answer before the timer ends.</p>
                </div>
              </div>

              <div className="csc-start-meta">
                <span>Campaign unlocked: {campaignProgress} / {TOTAL_CAMPAIGN_LEVELS}</span>
                <span>Best score: {(progress.bestScore ?? 0).toLocaleString()}</span>
              </div>

              <div className="csc-start-actions">
                <button
                  type="button"
                  className="csc-primary-btn"
                  onClick={() => {
                    audioRef.current?.markUserGesture();
                    playSound("click");
                    startMode("campaign");
                  }}
                >
                  Continue Campaign
                </button>
                <button
                  type="button"
                  className="csc-secondary-btn"
                  onClick={() => {
                    audioRef.current?.markUserGesture();
                    playSound("click");
                    startMode("endless");
                  }}
                >
                  Endless Mode
                </button>
              </div>
            </section>
          </main>
        ) : (
          <main className="csc-app-main">
            <section className="csc-summary-strip">
              <article className="csc-panel csc-summary-item">
                <span className="csc-summary-label">Round</span>
                <strong>
                  {game.mode === "campaign"
                    ? `Level ${formatLevelNumber(game.currentLevelNumber)} / ${TOTAL_CAMPAIGN_LEVELS}`
                    : `Wave ${formatLevelNumber(game.currentLevelNumber)}`}
                </strong>
                <small>{capitalize(game.mode)}</small>
              </article>

              <article className="csc-panel csc-summary-item csc-timer-card">
                <div
                  className="csc-timer-ring"
                  data-tone={timerUi.timerTone}
                  style={{ ["--progress-angle" as string]: timerUi.angle }}
                >
                  <span>{timerUi.remainingSeconds.toFixed(1)}</span>
                </div>
                <div className="csc-timer-copy">
                  <span className="csc-summary-label">Time</span>
                  <strong>
                    {game.resultState === "idle"
                      ? "Waiting"
                      : timerUi.remainingSeconds > 0
                        ? `${timerUi.remainingSeconds.toFixed(1)}s left`
                        : "Time up"}
                  </strong>
                  <div className="csc-timer-bar">
                    <div
                      className="csc-timer-bar-fill"
                      data-tone={timerUi.timerTone}
                      style={{ width: `${timerUi.percent * 100}%` }}
                    ></div>
                  </div>
                </div>
              </article>

              <article className="csc-panel csc-summary-item">
                <span className="csc-summary-label">Score</span>
                <strong>{game.score.toLocaleString()}</strong>
                <small>Best {progress.bestScore.toLocaleString()}</small>
              </article>

              <article className="csc-panel csc-summary-item">
                <span className="csc-summary-label">Progress</span>
                <strong>
                  {game.mode === "campaign"
                    ? `${campaignProgress} of ${TOTAL_CAMPAIGN_LEVELS} unlocked`
                    : `Best wave ${Math.max(progress.bestEndlessWave, 1)}`}
                </strong>
                {game.mode === "campaign" ? (
                  <div className="csc-progress-meter" aria-hidden="true">
                    <span
                      className="csc-progress-fill"
                      style={{ width: `${campaignProgressPercent}%` }}
                    ></span>
                  </div>
                ) : (
                  <small>Keep going to increase the challenge.</small>
                )}
              </article>
            </section>

            <section className="csc-minimal-layout">
              <section className="csc-panel csc-arena-card">
                <div className="csc-arena-top">
                  <div>
                    <p className="csc-eyebrow">
                      {currentConfig ? currentConfig.name : getModeRoundLabel()}
                    </p>
                    <h3>{getModeRoundLabel()}</h3>
                  </div>

                  <div className="csc-direction-chip">
                    <span className="csc-direction-arrow">{currentDirectionMeta.arrow}</span>
                    <span>{currentDirectionMeta.label}</span>
                  </div>
                </div>

                <div
                  className={[
                    "csc-circle-stage",
                    game.stageEffect ? `csc-stage-${game.stageEffect}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  style={
                    circleUi
                      ? ({
                          ["--marker-orbit" as string]: `${circleUi.radiusPercent}%`,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <div className="csc-circle-center">
                    <span className="csc-center-kicker">{game.center.phase}</span>
                    <strong>{game.center.prompt}</strong>
                    <small>{game.center.subPrompt}</small>
                  </div>

                  <div className="csc-circle-nodes">{circleUi?.nodes}</div>
                </div>
              </section>

              <div className="csc-side-stack">
                <aside className="csc-panel csc-brief-panel">
                  <div className="csc-panel-header">
                    <p className="csc-eyebrow">Round instructions</p>
                    <h3>What to do</h3>
                  </div>

                  <div className="csc-brief-list">
                    <div className="csc-brief-row">
                      <span>Start</span>
                      <strong>
                        {currentRound
                          ? `Node ${currentRound.startIndex + 1} = ${
                              currentRound.numbers[currentRound.startIndex]
                            }`
                          : "Waiting"}
                      </strong>
                    </div>
                    <div className="csc-brief-row">
                      <span>Direction</span>
                      <strong>{currentDirectionMeta.label}</strong>
                    </div>
                    <div className="csc-brief-row">
                      <span>Goal</span>
                      <strong>
                        {currentConfig
                          ? `Add all ${currentConfig.count} values once`
                          : "Add the full circle"}
                      </strong>
                    </div>
                  </div>

                  <div className="csc-message-panel" data-state={game.message.state}>
                    <span className="csc-message-kicker">{game.message.kicker}</span>
                    <h4>{game.message.title}</h4>
                    <p>{game.message.text}</p>
                  </div>
                </aside>

                <aside className="csc-panel csc-control-card">
                  <div className="csc-panel-header">
                    <p className="csc-eyebrow">Answer</p>
                    <h3>Enter the total</h3>
                  </div>

                  <label className="csc-answer-label" htmlFor="answer-input">
                    Final sum
                  </label>
                  <div className="csc-answer-wrap">
                    <input
                      id="answer-input"
                      ref={answerInputRef}
                      className="csc-answer-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="Type the total"
                      aria-label="Final sum"
                      value={game.answer}
                      disabled={isSubmitDisabled}
                      onChange={(event) => {
                        patchGame({
                          answer: sanitizeInput(event.target.value),
                        });
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          submitAnswer();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="csc-primary-btn csc-large-btn"
                      onClick={submitAnswer}
                      disabled={isSubmitDisabled}
                    >
                      Submit
                    </button>
                  </div>

                  <div className="csc-control-row">
                    <button
                      type="button"
                      className="csc-secondary-btn"
                      onClick={() => {
                        playSound("click");
                        resetLevel();
                      }}
                      disabled={!currentRound}
                    >
                      Retry
                    </button>
                    {showNextButton ? (
                      <button
                        type="button"
                        className="csc-accent-btn"
                        onClick={() => {
                          playSound("click");
                          goToNextLevel();
                        }}
                      >
                        {nextButtonLabel}
                      </button>
                    ) : null}
                  </div>

                  <p className="csc-helper-text">
                    Press <kbd>Enter</kbd> to submit, <kbd>R</kbd> to retry, and{" "}
                    <kbd>P</kbd> to pause.
                  </p>
                </aside>

                {game.traceItems.length > 0 ? (
                  <section className="csc-panel csc-review-panel">
                    <div className="csc-trace-header">
                      <div>
                        <span className="csc-trace-label">Review</span>
                        <strong>{game.traceTitle}</strong>
                      </div>
                      <small>{game.traceMeta}</small>
                    </div>

                    <div className="csc-trace-list">
                      {game.traceItems.map((item, index) => (
                        <div
                          key={`${item.stepLabel}-${index}`}
                          className={`csc-trace-item csc-${item.variant}`}
                        >
                          <span className="csc-trace-step">{item.stepLabel}</span>
                          <strong className="csc-trace-value">{item.valueLabel}</strong>
                          <span className="csc-trace-total">{item.totalLabel}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            </section>
          </main>
        )}

        <div
          className={`csc-meme-overlay ${memeOverlay.visible ? "csc-is-visible" : ""}`}
          aria-hidden={!memeOverlay.visible}
        >
          <div
            className={[
              "csc-panel",
              "csc-meme-card",
              memeOverlay.outcome ? `csc-${memeOverlay.outcome}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className="csc-meme-header">
              <div>
                <p className="csc-eyebrow">
                  {memeOverlay.outcome
                    ? memeConfig.categories[memeOverlay.outcome].label
                    : "Reaction meme"}
                </p>
                <h3>
                  {memeOverlay.meme?.subreddit
                    ? `r/${memeOverlay.meme.subreddit}`
                    : memeOverlay.status === "loading"
                      ? "Loading meme"
                      : "Quick reaction"}
                </h3>
              </div>

              <button
                type="button"
                className="csc-ghost-btn"
                onClick={hideMemeOverlay}
              >
                Close
              </button>
            </div>

            {memeOverlay.status === "ready" && memeOverlay.meme ? (
              <>
                <div className="csc-meme-media-frame">
                  {/* Meme API responses can come from different Reddit image hosts, so a plain img is the safest option here. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="csc-meme-media"
                    src={memeOverlay.meme.imageUrl}
                    alt={memeOverlay.meme.title}
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="csc-meme-copy">
                  <p className="csc-meme-title">{memeOverlay.meme.title}</p>
                  {memeOverlay.meme.postLink ? (
                    <a
                      className="csc-meme-link"
                      href={memeOverlay.meme.postLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open original post
                    </a>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="csc-meme-placeholder">
                {memeOverlay.status === "error"
                  ? "The meme could not be loaded right now."
                  : "Loading meme..."}
              </div>
            )}
          </div>
        </div>

        <div
          className={`csc-overlay ${game.isPaused ? "csc-is-visible" : ""}`}
          aria-hidden={!game.isPaused}
        >
          <div className="csc-panel csc-overlay-card">
            <p className="csc-eyebrow">Orbit Frozen</p>
            <h2>Game Paused</h2>
            <p>
              {game.currentRound
                ? `${getModeRoundLabel()} is frozen with ${(
                    game.remainingMs / 1000
                  ).toFixed(1)}s left.`
                : "The timer is stopped. Resume when you are ready to continue the run."}
            </p>

            <div className="csc-overlay-actions">
              <button
                type="button"
                className="csc-primary-btn"
                onClick={() => {
                  playSound("click");
                  togglePause(false);
                }}
              >
                Resume
              </button>
              <button
                type="button"
                className="csc-secondary-btn"
                onClick={() => {
                  playSound("click");
                  returnToMenu();
                }}
              >
                Back to Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
