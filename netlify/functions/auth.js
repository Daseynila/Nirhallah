const { getStore, connectLambda } = require("@netlify/blobs");
const crypto = require("crypto");

global.__authSessions = global.__authSessions || new Map();
global.__auditLog = global.__auditLog || [];

const MASTER_ADMIN = {
  username: "Niral",
  password: process.env.ADMIN_PASSWORD || "NiralVelikiyPravitel07",
  role: "admin"
};

function getSafeStore(event) {
  try {
    if (event && event.blobs) {
      connectLambda(event);
    }
  } catch (e) {
    console.warn("connectLambda error:", e.message);
  }
  return getStore("nirhalla-art-cache");
}

function getClientIP(event) {
  const forwarded = event.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return event.headers["client-ip"] || "127.0.0.1";
}

async function addAuditLog(store, entry) {
  const logItem = {
    id: crypto.randomBytes(4).toString("hex"),
    timestamp: Date.now(),
    ...entry
  };
  global.__auditLog.unshift(logItem);
  if (global.__auditLog.length > 250) global.__auditLog.pop();

  try {
    let logs = [];
    try {
      logs = await store.get("sys_audit_log", { type: "json" }) || [];
    } catch (e) {}
    logs.unshift(logItem);
    if (logs.length > 250) logs = logs.slice(0, 250);
    await store.setJSON("sys_audit_log", logs);
  } catch (err) {
    console.warn("Audit log save error:", err.message);
  }
}

async function getSession(store, sessionToken) {
  if (!sessionToken) return null;
  // Check memory first
  if (global.__authSessions.has(sessionToken)) {
    return global.__authSessions.get(sessionToken);
  }
  // Check Blobs
  try {
    const s = await store.get("session_" + sessionToken, { type: "json" });
    if (s) {
      global.__authSessions.set(sessionToken, s);
      return s;
    }
  } catch (e) {}
  return null;
}

exports.addAuditLog = addAuditLog;
exports.getClientIP = getClientIP;
exports.getSession = getSession;

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token, X-Mod-Password",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    const store = getSafeStore(event);
    const clientIP = getClientIP(event);
    const payload = JSON.parse(event.body || "{}");
    const { action } = payload;

    // ==========================================
    // 1. ACTION: LOGIN (Username + Password)
    // ==========================================
    if (action === "login") {
      const { username, password } = payload;
      if (!username || !password) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Введите логин и пароль" }) };
      }

      const cleanUser = username.trim();

      // A) Master Admin check: Niral
      if (cleanUser.toLowerCase() === MASTER_ADMIN.username.toLowerCase()) {
        if (password !== MASTER_ADMIN.password) {
          await addAuditLog(store, {
            type: "FAILED_LOGIN",
            username: "Niral",
            ip: clientIP,
            text: "Неудачная попытка входа под логином Владельца Niral (неверный пароль)"
          });
          return { statusCode: 403, headers, body: JSON.stringify({ error: "Неверный пароль администратора!" }) };
        }

        const sessionToken = "adm_" + crypto.randomBytes(20).toString("hex");
        const sessionData = {
          token: sessionToken,
          username: "Niral",
          role: "admin",
          ip: clientIP,
          loginAt: Date.now()
        };

        global.__authSessions.set(sessionToken, sessionData);
        try {
          await store.setJSON("session_" + sessionToken, sessionData);
        } catch (e) {}

        await addAuditLog(store, {
          type: "ADMIN_LOGIN",
          username: "Niral",
          ip: clientIP,
          text: `Владелец Niral успешно вошел в систему (IP: ${clientIP})`
        });

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            sessionToken,
            username: "Niral",
            role: "admin",
            message: "Добро пожаловать, Владелец Niral!"
          })
        };
      }

      // B) Moderator check
      const modKey = "mod_user_" + cleanUser.toLowerCase();
      let modData = null;
      try {
        modData = await store.get(modKey, { type: "json" });
      } catch (e) {}

      if (!modData) {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Пользователь не найден!" }) };
      }

      if (modData.status === "blocked") {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Ваш аккаунт модератора заблокирован Главным Администратором!" }) };
      }

      if (modData.password !== password) {
        await addAuditLog(store, {
          type: "FAILED_LOGIN",
          username: modData.username,
          ip: clientIP,
          text: `Неверный пароль модератора ${modData.username}`
        });
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Неверный пароль модератора!" }) };
      }

      // 🔍 IP TRACKING & ANTI-ACCOUNT-SHARING CHECK:
      modData.knownIPs = modData.knownIPs || [];
      const isNewIP = !modData.knownIPs.includes(clientIP);

      if (isNewIP) {
        modData.knownIPs.push(clientIP);
        modData.ipChangeCount = (modData.ipChangeCount || 0) + 1;

        await addAuditLog(store, {
          type: "MOD_NEW_IP",
          username: modData.username,
          ip: clientIP,
          text: `⚠️ [НОВЫЙ IP] Модератор ${modData.username} вошел с неизвестного IP: ${clientIP} (Всего уникальных IP: ${modData.knownIPs.length})`
        });
      } else {
        await addAuditLog(store, {
          type: "MOD_LOGIN",
          username: modData.username,
          ip: clientIP,
          text: `Модератор ${modData.username} вошел с привычного IP: ${clientIP}`
        });
      }

      modData.lastLogin = Date.now();
      modData.lastIP = clientIP;
      await store.setJSON(modKey, modData);

      const sessionToken = "mod_" + crypto.randomBytes(20).toString("hex");
      const sessionData = {
        token: sessionToken,
        username: modData.username,
        role: "moderator",
        ip: clientIP,
        loginAt: Date.now()
      };

      global.__authSessions.set(sessionToken, sessionData);
      try {
        await store.setJSON("session_" + sessionToken, sessionData);
      } catch (e) {}

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          sessionToken,
          username: modData.username,
          role: "moderator",
          isNewIP,
          knownIPsCount: modData.knownIPs.length,
          message: `Успешный вход, модератор ${modData.username}!`
        })
      };
    }

    // ==========================================
    // 2. CHECK SESSION FOR PROTECTED ACTIONS
    // ==========================================
    const sessionToken = payload.sessionToken || event.headers["x-session-token"];
    let session = await getSession(store, sessionToken);

    // Fallback for Master Admin password
    if (!session && payload.password === MASTER_ADMIN.password) {
      session = { username: "Niral", role: "admin", ip: clientIP };
    }

    // ==========================================
    // 3. ACTION: VERIFY SESSION
    // ==========================================
    if (action === "verify_session") {
      if (!session) {
        return { statusCode: 401, headers, body: JSON.stringify({ valid: false, error: "Сессия истекла" }) };
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          valid: true,
          username: session.username,
          role: session.role
        })
      };
    }

    // ==========================================
    // 4. ACTION: LOGOUT
    // ==========================================
    if (action === "logout") {
      if (sessionToken) {
        global.__authSessions.delete(sessionToken);
        try {
          await store.delete("session_" + sessionToken);
        } catch (e) {}
      }
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: "Выход выполнен" }) };
    }

    // ==========================================
    // 5. ACTION: CREATE MODERATOR (Admin Only)
    // ==========================================
    if (action === "create_mod") {
      if (!session || session.role !== "admin") {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Только Владелец Niral может создавать модераторов!" }) };
      }

      const { modUsername, modPassword } = payload;
      if (!modUsername || !modPassword || modUsername.trim().length < 3) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Логин модератора должен быть от 3 символов" }) };
      }

      const cleanUsername = modUsername.trim();
      const modKey = "mod_user_" + cleanUsername.toLowerCase();

      const existing = await store.get(modKey, { type: "json" });
      if (existing) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Модератор с логином '${cleanUsername}' уже существует!` }) };
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

      await store.setJSON(modKey, newMod);
      await addAuditLog(store, {
        type: "CREATE_MOD",
        username: "Niral",
        ip: clientIP,
        text: `Администратор Niral создал учетную запись модератора [${cleanUsername}]`
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: `Модератор ${cleanUsername} успешно создан!` })
      };
    }

    // ==========================================
    // 6. ACTION: LIST MODERATORS (Admin Only)
    // ==========================================
    if (action === "list_mods") {
      if (!session || session.role !== "admin") {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Доступ разрешен только Администратору Niral" }) };
      }

      const mods = [];
      try {
        const res = await store.list();
        for (const b of (res.blobs || [])) {
          if (b.key.startsWith("mod_user_")) {
            const data = await store.get(b.key, { type: "json" });
            if (data) {
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
      } catch (e) {
        console.warn("Failed to list mods:", e.message);
      }

      mods.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, mods })
      };
    }

    // ==========================================
    // 7. ACTION: DELETE MODERATOR (Admin Only)
    // ==========================================
    if (action === "delete_mod") {
      if (!session || session.role !== "admin") {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Доступ запрещен" }) };
      }

      const { modUsername } = payload;
      if (!modUsername) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: "Не указан модератор" }) };
      }

      const modKey = "mod_user_" + modUsername.trim().toLowerCase();
      await store.delete(modKey);

      await addAuditLog(store, {
        type: "DELETE_MOD",
        username: "Niral",
        ip: clientIP,
        text: `Администратор Niral удалил модератора [${modUsername}]`
      });

      return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `Модератор ${modUsername} удален` }) };
    }

    // ==========================================
    // 8. ACTION: TOGGLE FREEZE MOD (Admin Only)
    // ==========================================
    if (action === "toggle_mod") {
      if (!session || session.role !== "admin") {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Доступ запрещен" }) };
      }

      const { modUsername } = payload;
      const modKey = "mod_user_" + modUsername.trim().toLowerCase();
      const modData = await store.get(modKey, { type: "json" });
      if (modData) {
        modData.status = (modData.status === "active") ? "blocked" : "active";
        await store.setJSON(modKey, modData);

        await addAuditLog(store, {
          type: "TOGGLE_MOD",
          username: "Niral",
          ip: clientIP,
          text: `Администратор Niral изменил статус модератора [${modUsername}] на: ${modData.status}`
        });

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, status: modData.status }) };
      }
      return { statusCode: 404, headers, body: JSON.stringify({ error: "Модератор не найден" }) };
    }

    // ==========================================
    // 9. ACTION: GET AUDIT LOG (Admin Only)
    // ==========================================
    if (action === "get_audit_log") {
      if (!session || session.role !== "admin") {
        return { statusCode: 403, headers, body: JSON.stringify({ error: "Доступ запрещен" }) };
      }

      let logs = [];
      try {
        logs = await store.get("sys_audit_log", { type: "json" }) || [];
      } catch (e) {}

      if (logs.length === 0 && global.__auditLog.length > 0) {
        logs = global.__auditLog;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, logs })
      };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Unknown action" }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Server Error: " + err.message }) };
  }
};
