import { handleOptions, jsonResponse, getStaffSession } from "./_common.js";

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions();
  if (request.method !== "POST" && request.method !== "DELETE") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const staff = await getStaffSession(context);
  if (!staff) {
    return jsonResponse({ error: "Доступ запрещен. Требуются права персонала!" }, 403);
  }

  const url = new URL(request.url);
  let code = url.searchParams.get("code");
  if (!code && request.method === "POST") {
    try {
      const body = await request.json();
      code = body.code;
    } catch (e) {}
  }

  if (!code) {
    return jsonResponse({ error: "Не указан код холста!" }, 400);
  }

  let artData = null;
  if (env && env.ART_KV) {
    try { artData = await env.ART_KV.get(String(code), "json"); } catch (e) {}
  }
  if (!artData && globalThis.__artCache && globalThis.__artCache.has(String(code))) {
    artData = globalThis.__artCache.get(String(code));
  }
  if (artData && artData.isHidden && staff.role !== "admin") {
    return jsonResponse({ error: "Скрытые картины может удалять только Главный Администратор!" }, 403);
  }

  if (globalThis.__artCache) {
    globalThis.__artCache.delete(String(code));
  }
  globalThis.__deletedArts = globalThis.__deletedArts || new Set();
  globalThis.__deletedArts.add(String(code));

  if (env && env.ART_KV) {
    try {
      await env.ART_KV.delete(String(code));
      await env.ART_KV.put("deleted_" + code, "true");
    } catch (e) {}
  }

  return jsonResponse({ success: true, message: `Холст #${code} успешно удален!` });
}
