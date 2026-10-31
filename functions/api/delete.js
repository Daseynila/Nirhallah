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

  if (globalThis.__artCache) {
    globalThis.__artCache.delete(String(code));
  }

  if (env && env.ART_KV) {
    try {
      await env.ART_KV.delete(String(code));
    } catch (e) {}
  }

  return jsonResponse({ success: true, message: `Холст #${code} успешно удален!` });
}
