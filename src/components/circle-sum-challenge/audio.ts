import { clamp, pickRandom } from "./config";

const buildCategoryPaths = (folder: string, filenames: string[]) =>
  filenames.map((filename) => encodeURI(`/assets/audio/${folder}/${filename}`));

export const audioConfig = {
  // Keep these filenames in sync with the actual files inside public/assets/audio/*.
  correct: buildCategoryPaths("correct", [
    "amazed-onniich.mp3",
    "america-kya-kehta-tha.mp3",
    "anime-wow-sound-effect_ejcigGk.mp3",
    "aura-farming.mp3",
    "chalo.mp3",
    "deg-deg_4M6Cojn.mp3",
    "english-or-spanish-song.mp3",
    "gta-san-andreas-_RZMwPB0.mp3",
    "hacker-hai-bhai-hacker-ajjubhai.mp3",
    "junglefever.mp3",
    "nya_2xyALFL.mp3",
    "plankton-oooooh.mp3",
    "shabash-beta.mp3",
    "skibidi-toilet.mp3",
    "social-credit-music.mp3",
    "spiderman-meme-song.mp3",
    "tenge-tenge.mp3",
    "tudun-tadau_BJviW12.mp3",
    "uiiiiiiii.mp3",
    "uwatsu-qian-karache-ga.mp3",
    "wow-kya-ladka-hai-very-handsome-boy.mp3",
    "wow_2.mp3",
  ]),
  wrong: buildCategoryPaths("wrong", [
    "acha-ji-aisa-hai-kya.mp3",
    "aisa-mat-karo.mp3",
    "baigan.mp3",
    "ch-t-maari-ja-rahi-hai_HLSJ3G3.mp3",
    "chicken-on-tree-screaming.mp3",
    "cid-acp-bha-cho.mp3",
    "dry-fart.mp3",
    "ek-jhaat-bhar-ka-aadmi.mp3",
    "emotional-damage-meme.mp3",
    "faaah.mp3",
    "fart-with-reverb.mp3",
    "gey-echo.mp3",
    "gian-hain-aap.mp3",
    "gopgopgop.mp3",
    "gta-san-andreas-_RZMwPB0.mp3",
    "hey-prabhu-hey-hari-ram-krishna-jagganath_Ew1vEwh (1).mp3",
    "hey-prabhu-hey-hari-ram-krishna-jagganath_Ew1vEwh.mp3",
    "indian-song.mp3",
    "jhinka-chika-jhinka-chika.mp3",
    "kya-cheda-bhosdi.mp3",
    "kya-re-bhik-mangya-deepak-kalal.mp3",
    "kyu-re-madarchod-cid.mp3",
    "ladle-meoww-ghop-ghop-ghop.mp3",
    "lund-pakad-ke-tarazu-ki-tarah-cid.mp3",
    "ma-ka-bhosda-aag.mp3",
    "meri-jung-emotional copy.mp3",
    "meri-jung-emotional.mp3",
    "modi-ji-bhojyam.mp3",
    "nikal-jao-mere-lo-e-ke-samne-se_y19lYpE.mp3",
    "omgwow.mp3",
    "rizzbot-laugh.mp3",
  ]),
  timeout: buildCategoryPaths("timeout", [
    "for-sure-macron.mp3",
    "maqsad-holiday.mp3",
  ]),
  levelComplete: buildCategoryPaths("level-complete", ["tabi-tab-tab.mp3"]),
  click: buildCategoryPaths("click", ["meme-click.mp3"]),
  bgm: buildCategoryPaths("bgm", []),
};

export type AudioType = keyof typeof audioConfig;

export class AudioManager {
  private muted = false;
  private sfxVolume = 0.8;
  private musicVolume = 0.35;
  private userInteracted = false;
  private audioContext: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private preparedPool = new Map<string, HTMLAudioElement>();
  private activeSfx = new Set<HTMLAudioElement>();
  private lastPlayedSourceByType = new Map<AudioType, string>();

  markUserGesture() {
    this.userInteracted = true;
    this.ensureAudioContext();
    this.preloadConfiguredAudio();
  }

  private ensureAudioContext() {
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    if (!this.audioContext) {
      this.audioContext = new AudioContextClass();
    }

    if (this.audioContext.state === "suspended") {
      this.audioContext.resume().catch(() => {});
    }

    return this.audioContext;
  }

  setMuted(isMuted: boolean) {
    this.muted = isMuted;
    if (this.muted) {
      this.pauseBgm();
      return;
    }

    this.resumeBgm();
  }

  setSfxVolume(volume: number) {
    this.sfxVolume = clamp(volume, 0, 1);
  }

  setMusicVolume(volume: number) {
    this.musicVolume = clamp(volume, 0, 1);
    if (this.bgmAudio) {
      this.bgmAudio.volume = this.musicVolume;
    }
  }

  play(type: AudioType): HTMLAudioElement | null {
    if (type === "bgm") {
      this.startBgm();
      return null;
    }

    if (this.muted) {
      return null;
    }

    const sources = audioConfig[type];
    if (!sources.length) {
      this.playFallback(type);
      return null;
    }

    const source = this.pickSource(type, sources);
    const audio = this.createPlaybackAudio(source);
    const cleanup = () => {
      this.activeSfx.delete(audio);
    };

    audio.volume = this.sfxVolume;
    audio.addEventListener(
      "ended",
      () => {
        cleanup();
      },
      { once: true }
    );
    audio.addEventListener(
      "error",
      () => {
        cleanup();
        console.warn(`Failed to play Circle Sum audio: ${source}`);
        this.playFallback(type);
      },
      { once: true }
    );

    this.activeSfx.add(audio);
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch((error) => {
        cleanup();
        console.warn(`Circle Sum audio playback was blocked: ${source}`, error);
        this.playFallback(type);
      });
    }

    return audio;
  }

  startBgm() {
    if (this.muted || !this.userInteracted) {
      return;
    }

    const sources = audioConfig.bgm;
    if (!sources.length) {
      return;
    }

    if (!this.bgmAudio) {
      const source = this.pickSource("bgm", sources);
      this.bgmAudio = this.createPlaybackAudio(source);
      this.bgmAudio.loop = true;
      this.bgmAudio.addEventListener(
        "error",
        () => {
          console.warn("Failed to play Circle Sum background music.");
          this.bgmAudio = null;
        },
        { once: true }
      );
    }

    this.bgmAudio.volume = this.musicVolume;
    const playPromise = this.bgmAudio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  pauseBgm() {
    this.bgmAudio?.pause();
  }

  resumeBgm() {
    if (!this.muted && this.userInteracted) {
      this.startBgm();
    }
  }

  private playFallback(type: AudioType) {
    if (this.muted || !this.userInteracted) {
      return;
    }

    const context = this.ensureAudioContext();
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const sequenceMap: Partial<Record<AudioType, [number, number, OscillatorType, number][]>> =
      {
        click: [
          [740, 0.05, "triangle", 0.03],
          [980, 0.04, "triangle", 0.02],
        ],
        correct: [
          [523, 0.09, "triangle", 0.04],
          [659, 0.1, "triangle", 0.04],
          [784, 0.14, "sine", 0.04],
        ],
        levelComplete: [
          [523, 0.08, "triangle", 0.03],
          [659, 0.08, "triangle", 0.03],
          [784, 0.1, "triangle", 0.03],
          [988, 0.16, "sine", 0.04],
        ],
        wrong: [
          [228, 0.07, "sawtooth", 0.035],
          [182, 0.09, "sawtooth", 0.03],
          [146, 0.12, "square", 0.026],
        ],
        timeout: [
          [392, 0.08, "square", 0.03],
          [330, 0.08, "square", 0.03],
          [262, 0.16, "sawtooth", 0.028],
        ],
      };

    const sequence = sequenceMap[type];
    if (!sequence) {
      return;
    }

    sequence.forEach(([frequency, duration, waveform, volume], index) => {
      this.playTone(
        context,
        now + index * 0.08,
        frequency,
        duration,
        waveform,
        volume * this.sfxVolume
      );
    });
  }

  private playTone(
    context: AudioContext,
    startTime: number,
    frequency: number,
    duration: number,
    waveform: OscillatorType,
    volume: number
  ) {
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.03);
  }

  private preloadConfiguredAudio() {
    Object.values(audioConfig)
      .flat()
      .forEach((source) => {
        this.prepareAudio(source);
      });
  }

  private prepareAudio(source: string) {
    const existing = this.preparedPool.get(source);
    if (existing) {
      return existing;
    }

    const audio = new Audio();
    audio.src = source;
    audio.preload = "auto";
    audio.load();
    this.preparedPool.set(source, audio);

    return audio;
  }

  private createPlaybackAudio(source: string) {
    const prepared = this.prepareAudio(source);
    const audio = prepared.cloneNode(true) as HTMLAudioElement;
    audio.src = source;
    audio.preload = "auto";
    audio.load();

    return audio;
  }

  private pickSource(type: AudioType, sources: string[]) {
    if (sources.length <= 1) {
      const onlySource = sources[0];
      if (onlySource) {
        this.lastPlayedSourceByType.set(type, onlySource);
      }
      return onlySource;
    }

    const lastSource = this.lastPlayedSourceByType.get(type);
    const candidates = sources.filter((source) => source !== lastSource);
    const nextSource = pickRandom(candidates.length > 0 ? candidates : sources);
    this.lastPlayedSourceByType.set(type, nextSource);

    return nextSource;
  }
}
