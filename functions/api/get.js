import { CORS_HEADERS, handleOptions } from "./_common.js";
import { INITIAL_ARTS } from "./_initial_data.js";

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").trim();

  if (!code) {
    return new Response(JSON.stringify({ error: "Missing code parameter" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  let artData = null;

  // 1. Check Cloudflare KV if configured
  if (env && env.ART_KV) {
    try {
      artData = await env.ART_KV.get(code, "json");
    } catch (e) {}
  }

  // 2. Check in-memory store
  if (!artData && globalThis.__artCache && globalThis.__artCache.has(code)) {
    artData = globalThis.__artCache.get(code);
  }

  // 3. Check seeded initial arts
  if (!artData && INITIAL_ARTS[code]) {
    artData = INITIAL_ARTS[code];
  }

  if (!artData || !artData.image) {
    return new Response(JSON.stringify({ error: `Canvas #${code} not found` }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }

  // Extract base64 and stream binary PNG
  try {
    let base64Data = artData.image;
    if (base64Data.includes(",")) {
      base64Data = base64Data.split(",")[1];
    }
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return new Response(bytes.buffer, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to decode image" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  }
}
