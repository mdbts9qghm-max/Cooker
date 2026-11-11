import { NextResponse } from "next/server";

export const runtime = "nodejs";

function isTikTok(url: string) {
  try {
    const u = new URL(url);
    return /(^|\.)tiktok\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** Holt Caption-Text, Titel und Vorschaubild über die öffentliche oEmbed-Schnittstelle von TikTok. */
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!isTikTok(url)) return NextResponse.json({ error: "Kein TikTok-Link" }, { status: 400 });
  try {
    // Kurzlinks (vm.tiktok.com) zuerst auflösen
    let target = url;
    if (/^(vm|vt)\./.test(new URL(url).hostname)) {
      const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
      if (isTikTok(r.url)) target = r.url.split("?")[0];
    }
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Rezeptbuch)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json({ error: `TikTok antwortet nicht (${res.status})` }, { status: 502 });
    const data = await res.json();
    return NextResponse.json({
      caption: typeof data.title === "string" ? data.title : "",
      author: data.author_name ?? "",
      thumbnail: data.thumbnail_url ?? null,
    });
  } catch {
    return NextResponse.json({ error: "TikTok nicht erreichbar" }, { status: 502 });
  }
}
