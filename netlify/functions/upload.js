const { getStore, connectLambda } = require("@netlify/blobs");

// In-memory fallback cache for development or serverless session
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
    let savedToBlobs = false;
    let blobErrorMsg = null;
    try {
      const store = getSafeStore(event);
      await store.setJSON(code, artData, {
        metadata: { width: String(width), height: String(height) }
      });
      savedToBlobs = true;
      console.log(`[Art Upload] Saved art to Blobs with code: ${code}`);
    } catch (blobErr) {
      blobErrorMsg = blobErr.message;
      console.warn("Netlify Blobs not available:", blobErr.message);
    }

    // 2. Also save in memory cache
    global.__artCache.set(code, artData);

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        code,
        width: parseInt(width),
        height: parseInt(height),
        savedToBlobs,
        blobError: blobErrorMsg,
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
