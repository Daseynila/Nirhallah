import { handleOptions, jsonResponse, hmacSha256, MASTER_PASSWORD } from "./_common.js";

globalThis.__authSessions = globalThis.__authSessions || new Map();
globalThis.__auditLog = globalThis.__auditLog || [];
globalThis.__modsMap = globalThis.__modsMap || new Map();

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const payload = await request.json();
    const { action } = payload;
    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";

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

        // Add audit log
        const auditEntry = {
          timestamp: Date.now(),
          type: "ADMIN_LOGIN",
          username: "Niral",
          ip: clientIP,
          text: `Владелец Niral вошел в систему с IP ${clientIP}`
        };
        globalThis.__auditLog.unshift(auditEntry);
        if (globalThis.__auditLog.length > 100) globalThis.__auditLog.pop();

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
      if (!modData && globalThis.__modsMap && globalThis.__modsMap.has(modKey)) {
        modData = globalThis.__modsMap.get(modKey);
      }

      if (!modData) {
        return jsonResponse({ error: "Пользователь не найден!" }, 403);
      }

      if (modData.status === "blocked") {
        return jsonResponse({ error: "Этот аккаунт модератора заблокирован Владельцем!" }, 403);
      }

      if (modData.password !== password) {
        return jsonResponse({ error: "Неверный пароль модератора!" }, 403);
      }

      // Track IP and login
      modData.lastLogin = Date.now();
      modData.lastIP = clientIP;
      modData.knownIPs = modData.knownIPs || [];
      if (!modData.knownIPs.includes(clientIP)) {
        modData.knownIPs.push(clientIP);
      }
      globalThis.__modsMap.set(modKey, modData);
      if (env && env.ART_KV) {
        try { await env.ART_KV.put(modKey, JSON.stringify(modData)); } catch (e) {}
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

      const auditEntry = {
        timestamp: Date.now(),
        type: "MOD_LOGIN",
        username: modData.username,
        ip: clientIP,
        text: `Модератор [${modData.username}] вошел в систему с IP ${clientIP}`
      };
      globalThis.__auditLog.unshift(auditEntry);
      if (globalThis.__auditLog.length > 100) globalThis.__auditLog.pop();

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

    // Helper: verify admin session
    async function verifyAdminSession(token) {
      if (!token) return false;
      const parts = token.split("_");
      if (parts.length >= 3 && parts[0] === "adm") {
        const expected = await hmacSha256(MASTER_PASSWORD, `${parts[1]}:admin`);
        return parts.slice(2).join("_") === expected;
      }
      return false;
    }

    const tokenFromReq = request.headers.get("x-session-token") || payload.sessionToken;
    const isAdmin = await verifyAdminSession(tokenFromReq);

    // ==========================================
    // ACTION: CREATE MODERATOR (Admin Only)
    // ==========================================
    if (action === "create_mod") {
      if (!isAdmin) {
        return jsonResponse({ error: "Только Владелец Niral может создавать модераторов!" }, 403);
      }

      const { modUsername, modPassword } = payload;
      if (!modUsername || !modPassword || modUsername.trim().length < 3) {
        return jsonResponse({ error: "Логин и пароль должны быть не менее 3 символов" }, 400);
      }

      const cleanUsername = modUsername.trim();
      const modKey = "mod_user_" + cleanUsername.toLowerCase();

      let existing = null;
      if (env && env.ART_KV) {
        try { existing = await env.ART_KV.get(modKey, "json"); } catch (e) {}
      }
      if (!existing && globalThis.__modsMap && globalThis.__modsMap.has(modKey)) {
        existing = globalThis.__modsMap.get(modKey);
      }

      if (existing) {
        return jsonResponse({ error: `Модератор с логином '${cleanUsername}' уже существует!` }, 400);
      }

      const newMod = {
        username: cleanUsername,
        password: modPassword.trim(),
        createdAt: Date.now(),
        createdBy: "Niral",
        status: "active",
        knownIPs: [],
        ipChangeCount: 0,
        lastLogin: null,
        lastIP: null
      };

      globalThis.__modsMap.set(modKey, newMod);
      if (env && env.ART_KV) {
        try { await env.ART_KV.put(modKey, JSON.stringify(newMod)); } catch (e) {}
      }

      const auditEntry = {
        timestamp: Date.now(),
        type: "CREATE_MOD",
        username: "Niral",
        ip: clientIP,
        text: `Владелец Niral создал аккаунт модератора [${cleanUsername}]`
      };
      globalThis.__auditLog.unshift(auditEntry);
      if (globalThis.__auditLog.length > 100) globalThis.__auditLog.pop();

      return jsonResponse({ success: true, message: `Модератор ${cleanUsername} успешно создан!` });
    }

    // ==========================================
    // ACTION: LIST MODERATORS (Admin Only)
    // ==========================================
    if (action === "list_mods") {
      if (!isAdmin) {
        return jsonResponse({ error: "Доступно только Владельцу Niral" }, 403);
      }

      const mods = [];
      const seen = new Set();

      if (globalThis.__modsMap) {
        for (const data of globalThis.__modsMap.values()) {
          if (data && data.username && !seen.has(data.username.toLowerCase())) {
            seen.add(data.username.toLowerCase());
            mods.push({
              username: data.username,
              createdAt: data.createdAt,
              status: data.status || "active",
              ipChangeCount: data.ipChangeCount || (data.knownIPs ? data.knownIPs.length : 0),
              knownIPs: data.knownIPs || [],
              lastLogin: data.lastLogin,
              lastIP: data.lastIP
            });
          }
        }
      }

      if (env && env.ART_KV) {
        try {
          const res = await env.ART_KV.list({ prefix: "mod_user_" });
          for (const k of res.keys || []) {
            const data = await env.ART_KV.get(k.name, "json");
            if (data && data.username && !seen.has(data.username.toLowerCase())) {
              seen.add(data.username.toLowerCase());
              mods.push({
                username: data.username,
                createdAt: data.createdAt,
                status: data.status || "active",
                ipChangeCount: data.ipChangeCount || (data.knownIPs ? data.knownIPs.length : 0),
                knownIPs: data.knownIPs || [],
                lastLogin: data.lastLogin,
                lastIP: data.lastIP
              });
            }
          }
        } catch (e) {}
      }

      mods.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return jsonResponse({ success: true, mods });
    }

    // ==========================================
    // ACTION: TOGGLE FREEZE MOD (Admin Only)
    // ==========================================
    if (action === "toggle_mod") {
      if (!isAdmin) {
        return jsonResponse({ error: "Доступ запрещен" }, 403);
      }

      const { modUsername } = payload;
      const modKey = "mod_user_" + (modUsername || "").trim().toLowerCase();

      let modData = null;
      if (env && env.ART_KV) {
        try { modData = await env.ART_KV.get(modKey, "json"); } catch (e) {}
      }
      if (!modData && globalThis.__modsMap && globalThis.__modsMap.has(modKey)) {
        modData = globalThis.__modsMap.get(modKey);
      }

      if (modData) {
        modData.status = (modData.status === "active") ? "blocked" : "active";
        globalThis.__modsMap.set(modKey, modData);
        if (env && env.ART_KV) {
          try { await env.ART_KV.put(modKey, JSON.stringify(modData)); } catch (e) {}
        }

        const auditEntry = {
          timestamp: Date.now(),
          type: "TOGGLE_MOD",
          username: "Niral",
          ip: clientIP,
          text: `Владелец Niral изменил статус [${modUsername}] на: ${modData.status}`
        };
        globalThis.__auditLog.unshift(auditEntry);

        return jsonResponse({ success: true, status: modData.status });
      }
      return jsonResponse({ error: "Модератор не найден" }, 404);
    }

    // ==========================================
    // ACTION: DELETE MODERATOR (Admin Only)
    // ==========================================
    if (action === "delete_mod") {
      if (!isAdmin) {
        return jsonResponse({ error: "Доступ запрещен" }, 403);
      }

      const { modUsername } = payload;
      const modKey = "mod_user_" + (modUsername || "").trim().toLowerCase();

      if (globalThis.__modsMap) globalThis.__modsMap.delete(modKey);
      if (env && env.ART_KV) {
        try { await env.ART_KV.delete(modKey); } catch (e) {}
      }

      const auditEntry = {
        timestamp: Date.now(),
        type: "DELETE_MOD",
        username: "Niral",
        ip: clientIP,
        text: `Владелец Niral удалил модератора [${modUsername}]`
      };
      globalThis.__auditLog.unshift(auditEntry);

      return jsonResponse({ success: true, message: `Модератор ${modUsername} удален` });
    }

    // ==========================================
    // ACTION: GET AUDIT LOG (Admin Only)
    // ==========================================
    if (action === "get_audit_log") {
      if (!isAdmin) {
        return jsonResponse({ error: "Доступ запрещен" }, 403);
      }

      let logs = [...globalThis.__auditLog];
      if (env && env.ART_KV) {
        try {
          const kvLogs = await env.ART_KV.get("sys_audit_log", "json");
          if (Array.isArray(kvLogs)) {
            logs = [...logs, ...kvLogs];
          }
        } catch (e) {}
      }

      // Default audit seed if empty
      if (logs.length === 0) {
        logs = [
          {
            timestamp: Date.now() - 3600000,
            type: "SYSTEM_INIT",
            username: "Niral",
            ip: "172.67.211.92",
            text: "Система Nirhalla Art Cloud успешно переведена на Cloudflare Edge"
          }
        ];
      }

      return jsonResponse({ success: true, logs });
    }

    return jsonResponse({ error: "Неизвестное действие" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
