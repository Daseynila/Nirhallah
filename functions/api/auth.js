import { handleOptions, jsonResponse, hmacSha256, MASTER_PASSWORD } from "./_common.js";

globalThis.__authSessions = globalThis.__authSessions || new Map();
globalThis.__auditLog = globalThis.__auditLog || [];

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const payload = await request.json();
    const { action } = payload;
    const clientIP = request.headers.get("cf-connecting-ip") || "127.0.0.1";

    if (action === "login") {
      const { username, password } = payload;
      if (!username || !password) {
        return jsonResponse({ error: "Введите логин и пароль" }, 400);
      }

      const cleanUser = username.trim();
      if (cleanUser.toLowerCase() === "niral") {
        if (password !== MASTER_PASSWORD) {
          return jsonResponse({ error: "Неверный пароль администратора!" }, 403);
        }

        const sig = await hmacSha256(MASTER_PASSWORD, "Niral:admin");
        const sessionToken = `adm_Niral_${sig}`;
        const sessionData = {
          token: sessionToken,
          username: "Niral",
          role: "admin",
          ip: clientIP,
          loginAt: Date.now()
        };

        globalThis.__authSessions.set(sessionToken, sessionData);
        if (env && env.ART_KV) {
          try { await env.ART_KV.put("session_" + sessionToken, JSON.stringify(sessionData)); } catch (e) {}
        }

        return jsonResponse({
          success: true,
          sessionToken,
          username: "Niral",
          role: "admin",
          message: "Добро пожаловать, Владелец Niral!"
        });
      }

      // Check moderator
      let modData = null;
      const modKey = "mod_user_" + cleanUser.toLowerCase();
      if (env && env.ART_KV) {
        try { modData = await env.ART_KV.get(modKey, "json"); } catch (e) {}
      }
      if (!modData && globalThis[modKey]) {
        modData = globalThis[modKey];
      }

      if (!modData) {
        return jsonResponse({ error: "Пользователь не найден!" }, 403);
      }

      if (modData.password !== password) {
        return jsonResponse({ error: "Неверный пароль модератора!" }, 403);
      }

      const sig = await hmacSha256(MASTER_PASSWORD, `${modData.username}:moderator`);
      const sessionToken = `mod_${modData.username}_${sig}`;
      const sessionData = {
        token: sessionToken,
        username: modData.username,
        role: "moderator",
        ip: clientIP,
        loginAt: Date.now()
      };

      globalThis.__authSessions.set(sessionToken, sessionData);
      if (env && env.ART_KV) {
        try { await env.ART_KV.put("session_" + sessionToken, JSON.stringify(sessionData)); } catch (e) {}
      }

      return jsonResponse({
        success: true,
        sessionToken,
        username: modData.username,
        role: "moderator",
        message: `Успешный вход, модератор ${modData.username}!`
      });
    }

    if (action === "verify_session") {
      const sessionToken = payload.sessionToken;
      if (!sessionToken) return jsonResponse({ valid: false }, 401);
      const parts = sessionToken.split("_");
      if (parts.length >= 3) {
        const [prefix, user] = parts;
        const role = (prefix === "adm") ? "admin" : "moderator";
        const expected = await hmacSha256(MASTER_PASSWORD, `${user}:${role}`);
        if (parts.slice(2).join("_") === expected) {
          return jsonResponse({ valid: true, username: user, role });
        }
      }
      return jsonResponse({ valid: false }, 401);
    }

    return jsonResponse({ error: "Неизвестное действие" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
