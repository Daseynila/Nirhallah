const { getStore } = require("@netlify/blobs");

// In-memory fallback cache for development or serverless session
global.__artCache = global.__artCache || new Map();

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
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
    const { image, width, height } = payload;

    if (!image || !width || !height) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields: image, width, height" }),
      };
    }

    // Generate random 4-digit code (1000 - 9999)
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const artData = {
      code,
      image, // base64 data url
      width: parseInt(width),
      height: parseInt(height),
      createdAt: Date.now()
    };

    // 1. Try saving to Netlify Blobs (production)
    try {
      const store = getStore("nirhalla-art-cache");
      await store.setJSON(code, artData, {
        metadata: { width: String(width), height: String(height) }
      });
    } catch (blobErr) {
      console.warn("Netlify Blobs not available, using in-memory store:", blobErr.message);
    }

    // 2. Always save in memory cache as well
    global.__artCache.set(code, artData);

    console.log(`[Art Upload] Saved art with code: ${code} (${width}x${height} blocks)`);

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        code,
        width: parseInt(width),
        height: parseInt(height),
        message: "Art uploaded successfully"
      }),
    };
  } catch (err) {
    console.error("[Art Upload Error]:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal Server Error: " + err.message }),
    };
  }
};
