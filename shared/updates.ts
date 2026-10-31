// Links in announcements always stay inside the game.
export function announcementPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 300 || !value.startsWith("/") ||
      /[\\\s\u0000-\u001f\u007f]/.test(value) || value.startsWith("//"))
    throw new Error("invalid_announcement_link");
  const url = new URL(value, "https://game.invalid");
  if (url.origin !== "https://game.invalid" || url.pathname.startsWith("/api/") || url.pathname.startsWith("/ar/"))
    throw new Error("invalid_announcement_link");
  return url.pathname + url.search + url.hash;
}
export interface Announcement {
  id: string;
  title: string;
  message: string;
  path: string;
  publish_at: string;
  expires_at: string;
}
