const { getStore, connectLambda } = require("@netlify/blobs");
const crypto = require("crypto");

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

    const parsedWidth = parseInt(width);
    const parsedHeight = parseInt(height);

    // Compute digital fingerprint (hash) of image + dimensions
    const hash = crypto.createHash("sha256").update(image + "_" + parsedWidth + "_" + parsedHeight).digest("hex").substring(0, 16);
    const hashKey = "hash_" + hash;

    const store = getSafeStore(event);

    // 1. Check if identical artwork was already uploaded (Anti-spam / Duplicate prevention)
    let existingCode = null;
    try {
      existingCode = await store.get(hashKey, { type: "text" });
    } catch (e) {}

    // Check memory fallback
    if (!existingCode && global.__artCache) {
      for (const [cd, item] of global.__artCache.entries()) {
        if (!cd.startsWith("hash_") && item.image === image && item.width === parsedWidth && item.height === parsedHeight) {
          existingCode = cd;
          break;
        }
      }
    }

    if (existingCode) {
      return {
        statusCode: 200,
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          code: existingCode,
          width: parsedWidth,
          height: parsedHeight,
          isDuplicate: true,
          savedToBlobs: true,
          message: "Этот холст уже был создан ранее! Используйте код ниже."
        }),
      };
    }

    // Generate random 4-digit code (1000 - 9999)
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const artData = {
      code,
      image, // base64 data url
      width: parsedWidth,
      height: parsedHeight,
      hashKey,
      createdAt: Date.now()
    };

    // Save art data and duplicate hash pointer to Netlify Blobs
    let savedToBlobs = false;
    let blobErrorMsg = null;
    try {
      await store.setJSON(code, artData, {
        metadata: { width: String(parsedWidth), height: String(parsedHeight) }
      });
      // Store hash pointer for instant duplicate lookup
      await store.set(hashKey, code);
      savedToBlobs = true;
      console.log(`[Art Upload] Saved art to Blobs with code: ${code}`);
    } catch (blobErr) {
      blobErrorMsg = blobErr.message;
      console.warn("Netlify Blobs not available:", blobErr.message);
    }

    // Save in memory cache
    global.__artCache.set(code, artData);

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        code,
        width: parsedWidth,
        height: parsedHeight,
        isDuplicate: false,
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
