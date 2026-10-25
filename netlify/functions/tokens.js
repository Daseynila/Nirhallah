const { getStore, connectLambda } = require("@netlify/blobs");
const crypto = require("crypto");

global.__tokenCache = global.__tokenCache || new Map();

const MASTER_PASSWORD = process.env.ADMIN_PASSWORD || "NiralVelikiyPravitel07";

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

async function verifyAuth(store, event, payload) {
  const sessionToken = payload.sessionToken || event.headers["x-session-token"];
  if (sessionToken) {
    if (global.__authSessions && global.__authSessions.has(sessionToken)) {
      return global.__authSessions.get(sessionToken);
    }
    try {
      const s = await store.get("session_" + sessionToken, { type: "json" });
      if (s) return s;
    } catch (e) {}
  }

  const pass = payload.password || event.headers["x-mod-password"];
  if (pass === MASTER_PASSWORD) {
    return { username: "Niral", role: "admin" };
  }

  return null;
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token, X-Mod-Password",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const { action } = payload;
    const store = getSafeStore(event);

    const auth = await verifyAuth(store, event, payload);
    if (!auth) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "Требуется авторизация модератора или администратора!" }),
      };
    }

    // ==========================================
    // 1. ACTION: CREATE TOKEN
    // ==========================================
    if (action === "create") {
      const tier = (payload.tier === "grand") ? "grand" : "standard";
      const targetPlayer = (payload.targetPlayer || "").trim() || "Не указан";
      const issuedBy = auth.username || "Модератор";

      // Format: NIR-XXXX (4 uppercase hex/alphanumeric chars)
      const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase().substring(0, 4);
      const token = `NIR-${randomPart}`;
      const tokenKey = `token_${token}`;

      const tokenData = {
        token,
        tier, // "standard" (<= 3x2) or "grand" (<= 8x5)
        targetPlayer,
        issuedBy,
        createdAt: Date.now()
      };

      try {
        await store.setJSON(tokenKey, tokenData);
      } catch (blobErr) {
        console.warn("Netlify Blobs token save failed:", blobErr.message);
      }
      global.__tokenCache.set(token, tokenData);

      // Add to audit log
      try {
        let logs = [];
        try { logs = await store.get("sys_audit_log", { type: "json" }) || []; } catch (e) {}
        logs.unshift({
          id: crypto.randomBytes(4).toString("hex"),
          timestamp: Date.now(),
          type: "CREATE_TOKEN",
          username: issuedBy,
          ip: event.headers["client-ip"] || "127.0.0.1",
          text: `${issuedBy} выпустил токен [${token}] (Тип: ${tier === "grand" ? "Великий 8х5" : "Стандарт 3х2"}, Игрок: ${targetPlayer})`
        });
        if (logs.length > 250) logs = logs.slice(0, 250);
        await store.setJSON("sys_audit_log", logs);
      } catch (e) {}

      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          token,
          tier,
          targetPlayer,
          issuedBy,
          createdAt: tokenData.createdAt,
          message: "Токен успешно создан"
        }),
      };
    }

    // ==========================================
    // 2. ACTION: LIST TOKENS
    // ==========================================
    if (action === "list") {
      const tokens = [];

      try {
        const res = await store.list();
        const blobs = res.blobs || [];
        for (const b of blobs) {
          if (b.key.startsWith("token_")) {
            const data = await store.get(b.key, { type: "json" });
            if (data && data.token) {
              tokens.push(data);
            } else {
              const tokStr = b.key.replace("token_", "");
              tokens.push({
                token: tokStr,
                tier: "standard",
                targetPlayer: "Не указан",
                issuedBy: "Администрация",
                createdAt: b.uploadedAt || Date.now()
              });
            }
          }
        }
      } catch (blobErr) {
        console.warn("Netlify Blobs token list failed:", blobErr.message);
      }

      // Memory fallback if Blobs returned nothing
      if (tokens.length === 0 && global.__tokenCache.size > 0) {
        for (const [tok, data] of global.__tokenCache.entries()) {
          tokens.push(data);
        }
      }

      tokens.sort((a, b) => b.createdAt - a.createdAt);

      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          count: tokens.length,
          tokens
        }),
      };
    }

    // ==========================================
    // 3. ACTION: DELETE TOKEN
    // ==========================================
    if (action === "delete" && payload.token) {
      const cleanToken = payload.token.trim().toUpperCase();
      const tokenKey = `token_${cleanToken}`;
      try {
        await store.delete(tokenKey);
      } catch (e) {}
      global.__tokenCache.delete(cleanToken);

      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, message: "Токен удален" }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Unknown action" }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal Server Error: " + err.message }),
    };
  }
};
