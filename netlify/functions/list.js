const { getStore, connectLambda } = require("@netlify/blobs");

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

async function isStaffAuthenticated(store, event) {
  const sessionToken = event.headers["x-session-token"] || event.queryStringParameters?.sessionToken;
  if (sessionToken) {
    if (global.__authSessions && global.__authSessions.has(sessionToken)) {
      return true;
    }
    try {
      const s = await store.get("session_" + sessionToken, { type: "json" });
      if (s) return true;
    } catch (e) {}
  }

  const modPass = event.headers["x-mod-password"] || event.queryStringParameters?.password;
  if (modPass === MASTER_PASSWORD) return true;

  return false;
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Token, X-Mod-Password",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let blobError = null;
  try {
    const store = getSafeStore(event);
    const isStaff = await isStaffAuthenticated(store, event);

    const items = [];

    // 1. Try reading from Netlify Blobs
    try {
      const rawList = await store.list();
      const blobs = rawList.blobs || [];

      for (const b of blobs) {
        // Skip internal system keys, hashes, tokens, sessions, moderator accounts, and audit log
        if (
          b.key.startsWith("hash_") ||
          b.key.startsWith("token_") ||
          b.key.startsWith("session_") ||
          b.key.startsWith("mod_user_") ||
          b.key.startsWith("sys_")
        ) {
          continue;
        }

        try {
          const data = await store.get(b.key, { type: "json" });
          if (data && data.code) {
            const artItem = {
              code: data.code || b.key,
              width: data.width || 1,
              height: data.height || 1,
              tier: data.tier || ((data.width > 3 || data.height > 2) ? "grand" : "standard"),
              title: data.title || `Холст #${data.code || b.key}`,
              category: data.category || "art",
              createdAt: data.createdAt || b.uploadedAt || Date.now(),
              image: data.image
            };

            // 🔒 PRIVACY PROTECTION: Only expose audit metadata to verified staff!
            if (isStaff) {
              artItem.audit = {
                targetPlayer: data.targetPlayer || "Не указан",
                uploaderIP: data.uploaderIP || "Скрыт",
                usedToken: data.usedToken || "Н/Д",
                tokenIssuedBy: data.tokenIssuedBy || "Администрация"
              };
            }

            items.push(artItem);
          }
        } catch (itemErr) {
          console.warn("Error reading blob " + b.key, itemErr.message);
        }
      }
    } catch (err) {
      blobError = err.message;
      console.warn("Netlify Blobs list failed:", err.message);
    }

    // 2. Fallback to in-memory cache
    if (items.length === 0 && global.__artCache.size > 0) {
      for (const [code, data] of global.__artCache.entries()) {
        if (
          code.startsWith("hash_") ||
          code.startsWith("token_") ||
          code.startsWith("session_") ||
          code.startsWith("mod_user_") ||
          code.startsWith("sys_")
        ) {
          continue;
        }

        const artItem = {
          code: data.code || code,
          width: data.width || 1,
          height: data.height || 1,
          tier: data.tier || ((data.width > 3 || data.height > 2) ? "grand" : "standard"),
          title: data.title || `Холст #${code}`,
          category: data.category || "art",
          createdAt: data.createdAt || Date.now(),
          image: data.image
        };

        if (isStaff) {
          artItem.audit = {
            targetPlayer: data.targetPlayer || "Не указан",
            uploaderIP: data.uploaderIP || "Скрыт",
            usedToken: data.usedToken || "Н/Д",
            tokenIssuedBy: data.tokenIssuedBy || "Администрация"
          };
        }

        items.push(artItem);
      }
    }

    // Sort newest first
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        count: items.length,
        isStaff,
        items
      }),
    };
  } catch (err) {
    console.error("[Art List Error]:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal Server Error: " + err.message }),
    };
  }
};
