import { pickRandom } from "./config";

export type MemeOutcome = "correct" | "wrong";

export type MemeItem = {
  title: string;
  imageUrl: string;
  postLink: string;
  subreddit: string;
};

type ApiMeme = {
  author?: string;
  nsfw?: boolean;
  postLink?: string;
  preview?: string[];
  spoiler?: boolean;
  subreddit?: string;
  title?: string;
  url?: string;
};

type ApiMemeBatch = {
  count?: number;
  memes?: ApiMeme[];
};

export const memeConfig = {
  apiBaseUrl: "https://meme-api.com/gimme",
  batchSize: 4,
  minPoolSize: 1,
  displayDurationMs: 3200,
  maxDisplayDurationMs: 5200,
  categories: {
    // Change these subreddit lists if you want a different tone.
    correct: {
      label: "Correct answer meme",
      subreddits: ["wholesomememes", "AdviceAnimals"],
    },
    wrong: {
      label: "Wrong answer meme",
      subreddits: ["me_irl", "memes"],
    },
  },
} as const;

function isImageUrl(url: string) {
  return /\.(gif|jpe?g|png|webp)(\?.*)?$/i.test(url);
}

function resolveImageUrl(meme: ApiMeme) {
  if (typeof meme.url === "string" && isImageUrl(meme.url)) {
    return meme.url;
  }

  const previewImage =
    Array.isArray(meme.preview) &&
    [...meme.preview].reverse().find((previewUrl) => isImageUrl(previewUrl));

  return previewImage ?? null;
}

function normalizeMeme(meme: ApiMeme) {
  if (meme.nsfw || meme.spoiler) {
    return null;
  }

  const imageUrl = resolveImageUrl(meme);
  if (!imageUrl) {
    return null;
  }

  return {
    title: meme.title?.trim() || "Meme break",
    imageUrl,
    postLink: meme.postLink || "",
    subreddit: meme.subreddit || "",
  } satisfies MemeItem;
}

export async function fetchMemeBatch(outcome: MemeOutcome) {
  const subreddit = pickRandom(memeConfig.categories[outcome].subreddits);
  const response = await fetch(
    `${memeConfig.apiBaseUrl}/${encodeURIComponent(subreddit)}/${memeConfig.batchSize}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Meme API request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as ApiMeme | ApiMemeBatch;
  const items = Array.isArray((payload as ApiMemeBatch).memes)
    ? (payload as ApiMemeBatch).memes || []
    : [payload as ApiMeme];

  return items
    .map((meme) => normalizeMeme(meme))
    .filter((meme): meme is MemeItem => Boolean(meme));
}
