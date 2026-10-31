export const MASTER_PASSWORD = "NiralVelikiyPravitel07";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Session-Token, X-Mod-Password",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

export function handleOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
  });
}

export async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const s = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return Array.from(new Uint8Array(s)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifySignedStaffToken(sessionToken) {
  if (!sessionToken || typeof sessionToken !== "string") return null;
  const parts = sessionToken.split("_");
  if (parts.length >= 3) {
    const prefix = parts[0];
    const username = parts[1];
    const sig = parts.slice(2).join("_");
    if (prefix === "adm" || prefix === "mod") {
      const role = (prefix === "adm") ? "admin" : "moderator";
      const expected = await hmacSha256(MASTER_PASSWORD, `${username}:${role}`);
      if (sig === expected) {
        return { username, role, token: sessionToken };
      }
    }
  }
  return null;
}

export async function getStaffSession(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  let sessionToken = request.headers.get("x-session-token") || request.headers.get("session-token");
  if (!sessionToken) {
    sessionToken = url.searchParams.get("sessionToken") || url.searchParams.get("token");
  }

  // 1. Instant HMAC
  if (sessionToken) {
    const signed = await verifySignedStaffToken(sessionToken);
    if (signed) return signed;
  }

  // 2. Memory / KV
  if (sessionToken && env && env.ART_KV) {
    try {
      const s = await env.ART_KV.get("session_" + sessionToken, "json");
      if (s) return s;
    } catch (e) {}
  }

  // 3. Fallback mod password
  let modPass = request.headers.get("x-mod-password") || request.headers.get("mod-password");
  if (!modPass) modPass = url.searchParams.get("password");
  if (modPass === MASTER_PASSWORD) {
    return { username: "Niral", role: "admin" };
  }

  return null;
}
