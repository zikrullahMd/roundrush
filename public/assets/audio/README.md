# Audio Placeholders

Drop your custom audio files into the matching folders inside `public/assets/audio/`, then update the category arrays in `src/components/circle-sum-challenge/audio.ts` so the filenames match exactly.

Folder layout:

- `correct/correct01.mp3` through `correct/correct30.mp3`
- `wrong/wrong01.mp3` through `wrong/wrong30.mp3`
- `timeout/timeout1.mp3`
- `level-complete/levelComplete1.mp3`
- `click/click1.mp3`
- `bgm/bgm.mp3`

The game randomly picks one file from the `correct` pool and one file from the `wrong` pool each time those events fire.

Suggested sound styles:

- `correct*`: short victory sting, meme success blip, arcade confirm
- `wrong*`: buzzer, comedic fail hit, “bruh” style cue you created or licensed
- `timeout*`: warning burst, alarm chop, low urgency sting
- `levelComplete*`: celebratory crowd pop, synth fanfare, clap burst
- `click*`: tiny UI tap, punchy digital tick
- `bgm*`: light synth loop with no vocals

Legal reminder:

- Use sounds you made yourself, licensed sounds, or royalty-free clips with rights you understand.
- Do not bundle copyrighted downloads unless you have permission.
