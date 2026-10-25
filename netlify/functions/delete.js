const { getStore, connectLambda } = require("@netlify/blobs");

global.__artCache = global.__artCache || new Map();

const MOD_PASSWORD = process.env.MOD_PASSWORD || "NiralVelikiyPravitel07";

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

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Mod-Password",
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

    const code = payload.code || event.queryStringParameters?.code;
    const providedPass = payload.password || event.headers["x-mod-password"] || event.queryStringParameters?.password;

    // 🔒 Security Check: Require Moderator Password
    if (!providedPass || providedPass !== MOD_PASSWORD) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Неверный пароль модератора! Доступ запрещен."
        }),
      };
    }

    if (!code) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required parameter: code" }),
      };
    }

    // Delete from Netlify Blobs
    try {
      const store = getSafeStore(event);
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

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: `Холст #${code} успешно удален модератором.`
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
