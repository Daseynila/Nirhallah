const { getStore } = require("@netlify/blobs");

global.__artCache = global.__artCache || new Map();

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

  try {
    const items = [];

    // 1. Try reading from Netlify Blobs
    try {
      const store = getStore("nirhalla-art-cache");
      const { blobs } = await store.list();
      
      for (const b of blobs) {
        try {
          const data = await store.get(b.key, { type: "json" });
          if (data) {
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
    } catch (blobErr) {
      console.warn("Netlify Blobs list failed, checking memory cache:", blobErr.message);
    }

    // 2. Fallback to in-memory cache
    if (items.length === 0 && global.__artCache.size > 0) {
      for (const [code, data] of global.__artCache.entries()) {
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
