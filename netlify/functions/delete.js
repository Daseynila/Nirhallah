const { getStore, connectLambda } = require("@netlify/blobs");
const crypto = require("crypto");

global.__artCache = global.__artCache || new Map();

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
  const sessionToken = payload.sessionToken || event.headers["x-session-token"] || event.queryStringParameters?.sessionToken;
  if (sessionToken) {
    if (global.__authSessions && global.__authSessions.has(sessionToken)) {
      return global.__authSessions.get(sessionToken);
    }
    try {
      const s = await store.get("session_" + sessionToken, { type: "json" });
      if (s) return s;
    } catch (e) {}
  }

  const pass = payload.password || event.headers["x-mod-password"] || event.queryStringParameters?.password;
  if (pass === MASTER_PASSWORD) {
    return { username: "Niral", role: "admin" };
  }

  return null;
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Mod-Password, X-Session-Token",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST" && event.httpMethod !== "DELETE") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    let payload = {};
    try {
      payload = JSON.parse(event.body || "{}");
    } catch (e) {}

    const store = getSafeStore(event);
    const auth = await verifyAuth(store, event, payload);

    if (!auth) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Доступ запрещен! Требуются права модератора или пароль администратора."
        }),
      };
    }

    const code = payload.code || event.queryStringParameters?.code;
    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Не указан код картины (code)" }),
      };
    }

    // Delete from Netlify Blobs
    try {
      const artData = await store.get(code, { type: "json" });
      if (artData && artData.hashKey) {
        await store.delete(artData.hashKey);
      }
      await store.delete(code);
    } catch (blobErr) {
      console.warn("Netlify Blobs delete error:", blobErr.message);
    }

    // Delete from in-memory cache
    if (global.__artCache.has(code)) {
      global.__artCache.delete(code);
    }

    // Write to audit log
    try {
      let logs = [];
      try { logs = await store.get("sys_audit_log", { type: "json" }) || []; } catch (e) {}
      logs.unshift({
        id: crypto.randomBytes(4).toString("hex"),
        timestamp: Date.now(),
        type: "ART_DELETE",
        username: auth.username || "Модератор",
        ip: event.headers["client-ip"] || "127.0.0.1",
        text: `Пользователь ${auth.username || "Модератор"} удалил картину #${code} из базы данных`
      });
      if (logs.length > 250) logs = logs.slice(0, 250);
      await store.setJSON("sys_audit_log", logs);
    } catch (e) {}

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        code,
        message: `Холст #${code} успешно удален из базы данных`
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal Server Error: " + err.message }),
    };
  }
};
