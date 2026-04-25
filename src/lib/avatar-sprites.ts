export const DICEBEAR_AVATAR_STYLE = "adventurer";
export const AVATAR_OPTION_COUNT = 10;

const SEED_WORDS = [
  "river",
  "ember",
  "stone",
  "pine",
  "hollow",
  "falcon",
  "ridge",
  "cinder",
  "moss",
  "summit",
  "glade",
  "brook",
  "forge",
  "thorn",
  "vale",
  "storm",
  "trail",
  "dawn",
  "harbor",
  "meadow",
];

export function buildAvatarSpriteDataUrl(seed = "player"): string {
  const params = new URLSearchParams({
    seed,
    size: "128",
    radius: "22",
    backgroundType: "gradientLinear",
  });

  return `https://api.dicebear.com/9.x/${DICEBEAR_AVATAR_STYLE}/svg?${params.toString()}`;
}

export function buildAvatarSessionSeeds(sessionKey: string, count = AVATAR_OPTION_COUNT): string[] {
  return Array.from({ length: count }, (_, index) => {
    const word = SEED_WORDS[index % SEED_WORDS.length];
    return `${sessionKey}-${word}-${index + 1}`;
  });
}

export function buildAvatarOptions(
  sessionKey: string,
  preferredSeed?: string | null,
  count = AVATAR_OPTION_COUNT,
): string[] {
  const normalizedPreferredSeed = preferredSeed?.trim();
  const generatedSeeds = buildAvatarSessionSeeds(sessionKey, Math.max(count - (normalizedPreferredSeed ? 1 : 0), 0));

  if (!normalizedPreferredSeed) {
    return generatedSeeds;
  }

  return [normalizedPreferredSeed, ...generatedSeeds.filter((seed) => seed !== normalizedPreferredSeed)].slice(0, count);
}

export function resolveAvatarSrc(user: {
  avatarType: string;
  avatarSprite: string;
  avatarSeed?: string | null;
  avatarPhotoDataUrl?: string | null;
  handle?: string;
  id?: number;
}) {
  if (user.avatarType === "photo" && user.avatarPhotoDataUrl) {
    return user.avatarPhotoDataUrl;
  }

  const seed = user.avatarSeed?.trim() || `${user.handle ?? "player"}-${user.id ?? 0}`;
  return buildAvatarSpriteDataUrl(seed);
}
