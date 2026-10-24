const { getStore } = require("@netlify/blobs");

global.__artCache = global.__artCache || new Map();

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
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
    if (!code) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing required parameter: code" }) };
    }

    // Delete from Netlify Blobs
    try {
      const store = getStore("nirhalla-art-cache");
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
      body: JSON.stringify({ success: true, message: `Artwork #${code} deleted successfully` }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal Server Error: " + err.message }),
    };
  }
};
