export interface RankedEntry<T> {
  entry: T;
  rank: number;
}

export interface PinnedEntry<T> extends RankedEntry<T> {
  nextRank: number | null;
  pointsBehind: number | null;
}

export function rankEntries<T>(
  entries: T[],
  getScore: (entry: T) => number
): RankedEntry<T>[] {
  let previousScore: number | null = null;
  let rank = 0;

  return entries.map((entry, index) => {
    const score = getScore(entry);
    if (previousScore === null || score !== previousScore) {
      rank = index + 1;
      previousScore = score;
    }
    return { entry, rank };
  });
}

export function getPinnedEntry<T>(
  rankedEntries: RankedEntry<T>[],
  visibleEntries: RankedEntry<T>[],
  isCurrent: (entry: T) => boolean,
  getScore: (entry: T) => number
): PinnedEntry<T> | null {
  if (visibleEntries.some(({ entry }) => isCurrent(entry))) return null;

  const currentIndex = rankedEntries.findIndex(({ entry }) => isCurrent(entry));
  if (currentIndex === -1) return null;

  const current = rankedEntries[currentIndex];
  const currentScore = getScore(current.entry);
  const nextEntry = rankedEntries
    .slice(0, currentIndex)
    .findLast(({ entry }) => getScore(entry) > currentScore);

  return {
    ...current,
    nextRank: nextEntry?.rank ?? null,
    pointsBehind: nextEntry ? getScore(nextEntry.entry) - currentScore : null,
  };
}
