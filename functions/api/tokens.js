import { handleOptions, jsonResponse, getStaffSession } from "./_common.js";

globalThis.__tokenCache = globalThis.__tokenCache || new Map();

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const staff = await getStaffSession(context);
  if (!staff) {
    return jsonResponse({ error: "Требуется авторизация модератора или администратора!" }, 403);
  }

  const payload = await request.json();
  const { action } = payload;

  if (action === "create") {
    const tier = payload.tier === "grand" ? "grand" : "standard";
    const targetPlayer = (payload.targetPlayer || "").trim() || "Игрок";
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const token = `${tier === "grand" ? "GRD" : "STD"}-${randomHex}`;

    const tokenData = {
      token,
      tier,
      targetPlayer,
      issuedBy: staff.username,
      createdAt: Date.now()
    };

    globalThis.__tokenCache.set(token, tokenData);
    if (env && env.ART_KV) {
      try { await env.ART_KV.put("token_" + token, JSON.stringify(tokenData)); } catch (e) {}
    }

    return jsonResponse({ success: true, token, tokenData });
  }

  if (action === "list") {
    const tokens = Array.from(globalThis.__tokenCache.values());
    if (env && env.ART_KV) {
      try {
        const res = await env.ART_KV.list({ prefix: "token_" });
        for (const k of res.keys || []) {
          const t = await env.ART_KV.get(k.name, "json");
          if (t && !tokens.some(x => x.token === t.token)) {
            tokens.push(t);
          }
        }
      } catch (e) {}
    }
    return jsonResponse({ success: true, count: tokens.length, tokens });
  }

  return jsonResponse({ error: "Неизвестное действие" }, 400);
}
