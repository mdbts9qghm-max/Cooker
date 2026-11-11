export const runtime = "nodejs";

const ALLOWED = [/\.tiktokcdn\.com$/, /\.tiktokcdn-us\.com$/, /\.tiktokcdn-eu\.com$/, /\.cdninstagram\.com$/, /\.fbcdn\.net$/, /^images\.openfoodfacts\.org$/];

/** Lädt Vorschaubilder (z. B. von TikTok), damit die App sie lokal speichern kann. */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (u.protocol !== "https:" || !ALLOWED.some((re) => re.test(u.hostname))) return new Response("host not allowed", { status: 403 });
  const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } }).catch(() => null);
  if (!res || !res.ok) return new Response("fetch failed", { status: 502 });
  const type = res.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) return new Response("not an image", { status: 415 });
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 5_000_000) return new Response("too large", { status: 413 });
  return new Response(buf, { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
}
