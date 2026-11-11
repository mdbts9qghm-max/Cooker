import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MOBILE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function isTikTok(url: string) {
  try {
    const u = new URL(url);
    return /(^|\.)tiktok\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

function videoId(s: string): string | null {
  return s.match(/\/(?:video|photo|v)\/(\d{8,})/)?.[1] ?? null;
}

/** Kurzlinks (vm./vt.tiktok.com, tiktok.com/t/…) auflösen und die Video-ID finden. */
async function resolve(url: string): Promise<{ final: string; id: string | null }> {
  let id = videoId(url);
  if (id) return { final: url, id };
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": MOBILE_UA, "Accept-Language": "de-DE,de;q=0.9" } });
    const final = r.url || url;
    id = videoId(final);
    if (!id) {
      const html = await r.text();
      id = html.match(/\/video\/(\d{15,})/)?.[1] ?? html.match(/"(?:itemId|videoId|id)":"(\d{15,})"/)?.[1] ?? null;
    }
    return { final, id };
  } catch {
    return { final: url, id: null };
  }
}

type OEmbed = { title?: string; author_name?: string; author_unique_id?: string; thumbnail_url?: string; html?: string; code?: number; status_msg?: string };

async function oembed(target: string): Promise<{ ok: true; data: OEmbed } | { ok: false; status: number }> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`, {
      headers: { "User-Agent": MOBILE_UA, Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return { ok: false, status: res.status };
    const data = (await res.json()) as OEmbed;
    // TikTok antwortet bei Problemen teils mit HTTP 200 und einem Fehler-Objekt – das zählt nicht als Erfolg
    if (!data || (!data.title && !data.author_name && !data.html && !data.thumbnail_url)) return { ok: false, status: data?.code ?? 204 };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Holt Caption-Text, Titel und Vorschaubild über die öffentliche oEmbed-Schnittstelle von TikTok. */
export async function GET(req: Request) {
  const url = (new URL(req.url).searchParams.get("url") ?? "").trim();
  if (!isTikTok(url)) return NextResponse.json({ error: "Kein TikTok-Link" }, { status: 400 });

  const clean = url.split("?")[0];
  const { final, id } = await resolve(clean);
  // Reihenfolge: aufgelöster Original-Link (mit echtem Benutzernamen) zuerst
  const candidates = [
    final.split("?")[0],
    clean,
    ...(id ? [`https://www.tiktok.com/@/video/${id}`, `https://www.tiktok.com/video/${id}`, `https://m.tiktok.com/v/${id}.html`] : []),
  ].filter((c, i, a) => isTikTok(c) && a.indexOf(c) === i);

  let lastStatus = 0;
  const attempts: { url: string; status: number }[] = [];
  for (const c of candidates) {
    const r = await oembed(c);
    attempts.push({ url: c, status: r.ok ? 200 : r.status });
    if (r.ok) {
      return NextResponse.json({
        caption: typeof r.data.title === "string" ? r.data.title : "",
        author: r.data.author_name ?? r.data.author_unique_id ?? "",
        thumbnail: r.data.thumbnail_url ?? null,
      });
    }
    lastStatus = r.status;
  }
  return NextResponse.json(
    {
      error: lastStatus ? `TikTok hat das Video nicht herausgegeben (Fehler ${lastStatus})` : "TikTok nicht erreichbar",
      resolved: final,
      videoId: id,
      attempts,
    },
    { status: 502 },
  );
}
