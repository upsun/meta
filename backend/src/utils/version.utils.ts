export function compareSemverLike(a: string, b: string): number {
  const aParts = a.split('.').map(part => Number.parseInt(part, 10));
  const bParts = b.split('.').map(part => Number.parseInt(part, 10));
  const maxLen = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < maxLen; i += 1) {
    const aValue = Number.isFinite(aParts[i]) ? aParts[i] : 0;
    const bValue = Number.isFinite(bParts[i]) ? bParts[i] : 0;
    if (aValue !== bValue) {
      return aValue - bValue;
    }
  }

  return 0;
}

export function getHighestVersion(versions: Record<string, unknown>): string | null {
  const versionKeys = Object.keys(versions);
  if (versionKeys.length === 0) {
    return null;
  }

  return versionKeys.sort(compareSemverLike).at(-1) || null;
}