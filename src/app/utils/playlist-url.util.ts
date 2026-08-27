export function extractPlaylistId(url: string): string | null {
  const trimmed = url.trim();

  const uriMatch = trimmed.match(/^spotify:playlist:([a-zA-Z0-9]+)$/);
  if (uriMatch) {
    return uriMatch[1];
  }

  try {
    const parsed = new URL(trimmed);
    const pathMatch = parsed.pathname.match(/\/playlist\/([a-zA-Z0-9]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
  } catch {
    return null;
  }

  return null;
}
