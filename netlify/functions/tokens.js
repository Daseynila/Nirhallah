const { getStore, connectLambda } = require("@netlify/blobs");
const crypto = require("crypto");

global.__tokenCache = global.__tokenCache || new Map();

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
    const { action, password } = payload;
    const providedPass = password || event.headers["x-mod-password"];

    if (!providedPass || providedPass !== MOD_PASSWORD) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "Неверный пароль модератора!" }),
      };
    }

    const store = getSafeStore(event);

    // 1. Action: CREATE new single-use token
    if (action === "create") {
      // Format: NIR-XXXX (4 random alphanumeric characters)
      const randomPart = crypto.randomBytes(3).toString("hex").toUpperCase().substring(0, 4);
      const token = `NIR-${randomPart}`;
      const tokenKey = `token_${token}`;
      const tokenData = {
        token,
        createdAt: Date.now()
      };

      try {
        await store.setJSON(tokenKey, tokenData);
      } catch (blobErr) {
        console.warn("Netlify Blobs token save failed:", blobErr.message);
      }
      global.__tokenCache.set(token, tokenData);

      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          token,
          createdAt: tokenData.createdAt,
          message: "Токен успешно создан"
        }),
      };
    }

    // 2. Action: LIST all active unused tokens
    if (action === "list") {
      const tokens = [];

      try {
        const res = await store.list();
        const blobs = res.blobs || [];
        for (const b of blobs) {
          if (b.key.startsWith("token_")) {
            const tokStr = b.key.replace("token_", "");
            tokens.push({
              token: tokStr,
              createdAt: Date.now()
            });
          }
        }
      } catch (blobErr) {
        console.warn("Netlify Blobs token list failed:", blobErr.message);
      }

      // Memory fallback
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

    // 3. Action: DELETE token manually
    if (action === "delete" && payload.token) {
      const tokenKey = `token_${payload.token}`;
      try {
        await store.delete(tokenKey);
      } catch (e) {}
      global.__tokenCache.delete(payload.token);

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
