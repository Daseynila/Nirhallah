const { getStore, connectLambda } = require("@netlify/blobs");

global.__authSessions = global.__authSessions || new Map();
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

async function getStaffSession(store, event) {
  // Case-insensitive header check + query param fallback
  let sessionToken = null;
  if (event.headers) {
    for (const [k, v] of Object.entries(event.headers)) {
      if (k.toLowerCase() === "x-session-token" || k.toLowerCase() === "session-token") {
        sessionToken = v;
        break;
      }
    }
  }
  if (!sessionToken) {
    sessionToken = event.queryStringParameters?.sessionToken;
  }

  if (sessionToken) {
    if (global.__authSessions && global.__authSessions.has(sessionToken)) {
      return global.__authSessions.get(sessionToken);
    }
    try {
      let s = await store.get("session_" + sessionToken, { type: "json" });
      if (!s) {
        const raw = await store.get("session_" + sessionToken, { type: "text" });
        if (raw) s = JSON.parse(raw);
      }
      if (s) {
        global.__authSessions.set(sessionToken, s);
        return s;
      }
    } catch (e) {
      console.warn("Session lookup error in Blobs:", e.message);
    }
  }

  let modPass = null;
  if (event.headers) {
    for (const [k, v] of Object.entries(event.headers)) {
      if (k.toLowerCase() === "x-mod-password" || k.toLowerCase() === "mod-password") {
        modPass = v;
        break;
      }
    }
  }
  if (!modPass) {
    modPass = event.queryStringParameters?.password;
  }

  if (modPass === MASTER_PASSWORD) {
    return { username: "Niral", role: "admin" };
  }

  return null;
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
    const staffSession = await getStaffSession(store, event);
    const isStaff = Boolean(staffSession);
    const isAdmin = Boolean(staffSession && staffSession.role === "admin");

    const items = [];

    // 1. Try reading from Netlify Blobs
    try {
      const rawList = await store.list();
      const blobs = rawList.blobs || [];

      // Filter only art blobs
      const artBlobs = blobs.filter(b => 
        !b.key.startsWith("hash_") &&
        !b.key.startsWith("token_") &&
        !b.key.startsWith("session_") &&
        !b.key.startsWith("mod_user_") &&
        !b.key.startsWith("sys_")
      );

      // Fetch items in parallel WITHOUT packing megabytes of base64 images into one response!
      const fetchedItems = await Promise.all(
        artBlobs.map(async b => {
          try {
            const data = await store.get(b.key, { type: "json" });
            if (!data) return null;

            const isHidden = Boolean(data.isHidden);
            // 🔒 HIDDEN FILTER: Hidden test artworks are ONLY accessible to verified Admin!
            // Non-staff and regular moderators CANNOT see them.
            if (isHidden && !isAdmin) {
              return null;
            }

            const code = data.code || b.key;
            const width = data.width || 1;
            const height = data.height || 1;
            const isGrand = data.tier === "grand" || width > 3 || height > 3 || (width * height > 6);

            const artItem = {
              code,
              width,
              height,
              tier: isGrand ? "grand" : "standard",
              title: data.title || `Холст #${code}`,
              category: data.category || "art",
              isHidden,
              createdAt: data.createdAt || b.uploadedAt || Date.now(),
              imageUrl: `/api/get?code=${code}&format=png`
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

            return artItem;
          } catch (itemErr) {
            console.warn("Error reading blob " + b.key, itemErr.message);
            return null;
          }
        })
      );

      items.push(...fetchedItems.filter(Boolean));
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

        const isHidden = Boolean(data.isHidden);
        if (isHidden && !isAdmin) continue;

        const width = data.width || 1;
        const height = data.height || 1;
        const isGrand = data.tier === "grand" || width > 3 || height > 3 || (width * height > 6);

        const artItem = {
          code: data.code || code,
          width,
          height,
          tier: isGrand ? "grand" : "standard",
          title: data.title || `Холст #${code}`,
          category: data.category || "art",
          isHidden,
          createdAt: data.createdAt || Date.now(),
          imageUrl: `/api/get?code=${code}&format=png`
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
        isAdmin,
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
