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

  const code = event.queryStringParameters?.code;
  if (!code) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing required query parameter: code" }),
    };
  }

  let artData = null;

  // 1. Try fetching from Netlify Blobs
  try {
    const store = getSafeStore(event);
    artData = await store.get(code, { type: "json" });
  } catch (blobErr) {
    console.warn("Netlify Blobs lookup failed:", blobErr.message);
  }

  // 2. Fallback to memory cache
  if (!artData && global.__artCache.has(code)) {
    artData = global.__artCache.get(code);
  }

  if (!artData) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Art not found or expired" }),
    };
  }

  const format = event.queryStringParameters?.format;

  // If format is raw PNG (direct binary stream for Minecraft plugin)
  if (format === "png" || format === "raw") {
    const base64Data = artData.image.replace(/^data:image\/\w+;base64,/, "");
    return {
      statusCode: 200,
      headers: {
        ...headers,
        "Content-Type": "image/png",
        "X-Art-Width": String(artData.width),
        "X-Art-Height": String(artData.height),
      },
      body: base64Data,
      isBase64Encoded: true,
    };
  }

  // Default JSON response
  return {
    statusCode: 200,
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      success: true,
      code: artData.code,
      width: artData.width,
      height: artData.height,
      image: artData.image, // Base64 data URL
      createdAt: artData.createdAt,
    }),
  };
};
