const { getStore, connectLambda } = require("@netlify/blobs");

global.__artCache = global.__artCache || new Map();

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
    "Access-Control-Allow-Headers": "Content-Type",
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
    const items = [];

    let rawList = null;
    // 1. Try reading from Netlify Blobs
    try {
      const store = getSafeStore(event);
      rawList = await store.list();
      const blobs = rawList.blobs || [];
      
      for (const b of blobs) {
        // Skip internal duplicate hashes and auth tokens
        if (b.key.startsWith("hash_") || b.key.startsWith("token_")) continue;

        try {
          const data = await store.get(b.key, { type: "json" });
          if (data && data.code) {
            items.push({
              code: data.code || b.key,
              width: data.width || 1,
              height: data.height || 1,
              createdAt: data.createdAt || b.uploadedAt || Date.now(),
              image: data.image
            });
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
        if (code.startsWith("hash_") || code.startsWith("token_")) continue;
        items.push({
          code: data.code || code,
          width: data.width || 1,
          height: data.height || 1,
          createdAt: data.createdAt || Date.now(),
          image: data.image
        });
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
