# Circle Sum Challenge

Circle Sum Challenge is a polished arcade-style math game built inside this Next.js project. The landing route is `/`, and the game runs fully in the browser with no backend.

## Run It

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Route

- `/` -> Circle Sum Challenge

## Features

- 50 fixed campaign levels with increasing difficulty
- Endless mode with procedural scaling
- Responsive neon game UI for desktop and mobile
- Timer ring and timer bar
- Score, streak, combo, accuracy, average response time
- Pause and resume
- LocalStorage persistence for best score, unlocked level, sound settings, and stats
- Configurable audio manager with graceful fallback if files are missing
- Replaceable sound placeholders in `public/assets/audio`

## Main Structure

```text
src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
└── components/
    └── circle-sum-challenge/
        ├── audio.ts
        ├── CircleSumChallenge.module.css
        ├── CircleSumChallenge.tsx
        └── config.ts

public/
└── assets/
    └── audio/
        ├── bgm/
        ├── click/
        ├── correct/
        ├── level-complete/
        ├── timeout/
        ├── wrong/
        └── README.md
```

## File Roles

- `src/app/page.tsx`: mounts the game on the `/` route
- `src/components/circle-sum-challenge/CircleSumChallenge.tsx`: main interactive client component and gameplay controller
- `src/components/circle-sum-challenge/config.ts`: 50-level progression, constants, shared types, generation helpers
- `src/components/circle-sum-challenge/audio.ts`: audio config and audio manager
- `src/components/circle-sum-challenge/CircleSumChallenge.module.css`: visual design, layout, animation, responsive styling
- `public/assets/audio/README.md`: expected placeholder audio filenames and replacement notes

## Audio Setup

The configurable audio paths live in:

- `src/components/circle-sum-challenge/audio.ts`

Current audio config:

```ts
export const audioConfig = {
  correct: [/* add files from public/assets/audio/correct */],
  wrong: [/* add files from public/assets/audio/wrong */],
  timeout: [/* add files from public/assets/audio/timeout */],
  levelComplete: [/* add files from public/assets/audio/level-complete */],
  click: [/* add files from public/assets/audio/click */],
  bgm: [/* add files from public/assets/audio/bgm */],
};
```

To add your own sounds:

1. Drop files into the matching category folders under `public/assets/audio/`
2. Open `src/components/circle-sum-challenge/audio.ts`
3. Add or remove filenames in the category arrays so they match the files you uploaded exactly
4. Reload the page

Each correct or wrong event picks one sound randomly from its category pool.
If a file is missing, the game still works and falls back to lightweight synth effects for key cues.

## Sound Theme Ideas

- Short meme-style success stings
- Punchy arcade UI taps
- Dramatic fail buzzers
- Funny “bruh” style wrong-answer cues
- Quick crowd-reaction clips for level complete
- Soft synth background loop

## Adding Meme Audio Legally

Use one of these options:

- Record your own clips or reactions
- Use royalty-free or properly licensed sound libraries
- Buy sound packs that explicitly allow your use case
- Create your own edited original clips from audio you own

Avoid dropping copyrighted downloads from videos, streams, or social platforms into the project unless you have permission to use them.

## Notes For Customization

- Difficulty progression lives in `CAMPAIGN_LEVELS` inside `src/components/circle-sum-challenge/config.ts`
- Endless scaling is in `buildEndlessConfig(...)`
- Number generation logic is in `generateNumbers(...)`
- UI colors, glow strength, spacing, and animation live in `CircleSumChallenge.module.css`

## Verification

- `node --check` is not needed anymore because the game now lives in TypeScript/TSX files
- Run:

```bash
npm run lint
npm run build
```

if you want a full project validation pass
