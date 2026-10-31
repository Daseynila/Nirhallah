const { getStore, connectLambda } = require("@netlify/blobs");
const crypto = require("crypto");

global.__authSessions = global.__authSessions || new Map();
global.__artCache = global.__artCache || new Map();
global.__tokenCache = global.__tokenCache || new Map();

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

function getClientIP(event) {
  const forwarded = event.headers["x-forwarded-for"];
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return event.headers["client-ip"] || "127.0.0.1";
}

function verifySignedStaffToken(sessionToken) {
  if (!sessionToken || typeof sessionToken !== "string") return null;
  const parts = sessionToken.split("_");
  if (parts.length >= 3) {
    const prefix = parts[0];
    const username = parts[1];
    const sig = parts.slice(2).join("_");
    if (prefix === "adm" || prefix === "mod") {
      const role = (prefix === "adm") ? "admin" : "moderator";
      const expected = crypto.createHmac("sha256", MASTER_PASSWORD).update(`${username}:${role}`).digest("hex");
      if (sig === expected) {
        return { username, role, token: sessionToken };
      }
    }
  }
  return null;
}

async function verifyStaffSession(store, event, payload) {
  let sessionToken = payload.sessionToken;
  if (!sessionToken && event.headers) {
    for (const [k, v] of Object.entries(event.headers)) {
      if (k.toLowerCase() === "x-session-token" || k.toLowerCase() === "session-token") {
        sessionToken = v;
        break;
      }
    }
  }

  // 1. Instant HMAC cryptographic verification
  const signed = verifySignedStaffToken(sessionToken);
  if (signed) {
    if (global.__authSessions) global.__authSessions.set(sessionToken, signed);
    return signed;
  }

  // 2. Memory check
  if (sessionToken && global.__authSessions && global.__authSessions.has(sessionToken)) {
    return global.__authSessions.get(sessionToken);
  }

  // 3. Blobs check
  if (sessionToken) {
    try {
      let s = await store.get("session_" + sessionToken, { type: "json" });
      if (!s) {
        const raw = await store.get("session_" + sessionToken, { type: "text" });
        if (raw) s = JSON.parse(raw);
      }
      if (s) {
        if (global.__authSessions) global.__authSessions.set(sessionToken, s);
        return s;
      }
    } catch (e) {}
  }

  let pass = payload.modPassword;
  if (!pass && event.headers) {
    for (const [k, v] of Object.entries(event.headers)) {
      if (k.toLowerCase() === "x-mod-password" || k.toLowerCase() === "mod-password") {
        pass = v;
        break;
      }
    }
  }

  if (pass === MASTER_PASSWORD) {
    return { username: "Niral", role: "admin" };
  }
  return null;
}

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, X-Mod-Password, X-Session-Token",
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
    const { image, width, height, token, title, category } = payload;
    const clientIP = getClientIP(event);

    if (!image || !width || !height) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Отсутствуют обязательные параметры: image, width, height" }),
      };
    }

    const parsedWidth = parseInt(width);
    const parsedHeight = parseInt(height);

    if (isNaN(parsedWidth) || isNaN(parsedHeight) || parsedWidth < 1 || parsedHeight < 1 || parsedWidth > 8 || parsedHeight > 8 || (parsedWidth * parsedHeight > 40)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Недопустимый размер картины! Поддерживаются размеры до 8×5 или 5×8 блоков (не более 40 карт)." }),
      };
    }

    const isGrandSize = (parsedWidth > 3 || parsedHeight > 3 || (parsedWidth * parsedHeight > 6));
    const tier = isGrandSize ? "grand" : "standard";

    const store = getSafeStore(event);

    // Verify staff credentials early to determine Admin test mode
    const staffSession = await verifyStaffSession(store, event, payload);
    const isStaff = Boolean(staffSession);
    const isAdmin = Boolean(staffSession && staffSession.role === "admin");
    const isHidden = Boolean(isAdmin && payload.isHidden);

    // Compute digital fingerprint (hash) of image + dimensions + hidden flag
    const hash = crypto.createHash("sha256").update(image + "_" + parsedWidth + "_" + parsedHeight + (isHidden ? "_hidden" : "")).digest("hex").substring(0, 16);
    const hashKey = "hash_" + hash;

    // 1. Check if identical artwork was already uploaded (Anti-spam / Duplicate prevention)
    let existingCode = null;
    try {
      existingCode = await store.get(hashKey, { type: "text" });
    } catch (e) {}

    if (!existingCode && global.__artCache) {
      for (const [cd, item] of global.__artCache.entries()) {
        if (!cd.startsWith("hash_") && !cd.startsWith("token_") && item.image === image && item.width === parsedWidth && item.height === parsedHeight && Boolean(item.isHidden) === isHidden) {
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
          tier,
          isHidden,
          isDuplicate: true,
          savedToBlobs: true,
          message: isHidden
            ? "Этот скрытый тестовый холст уже был создан ранее! Используйте код ниже."
            : "Этот холст уже был создан ранее! Используйте код ниже."
        }),
      };
    }

    // 2. 🎟️ TOKEN CHECK & AUDIT TRAIL RECORDING
    let tokenMetadata = {
      targetPlayer: isStaff ? staffSession.username : "Не указан",
      usedToken: isStaff ? (isHidden ? "ADMIN_HIDDEN_TEST" : "STAFF_BYPASS") : "",
      tokenIssuedBy: isStaff ? staffSession.username : "Администрация"
    };

    if (!isStaff) {
      if (!token || typeof token !== "string" || !token.trim()) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: "Для публикации картины требуется Токен загрузки! Приобретите его у администрации сервера Нирхалла."
          }),
        };
      }

      const cleanToken = token.trim().toUpperCase();
      const tokenKey = `token_${cleanToken}`;
      let tokenData = null;

      try {
        tokenData = await store.get(tokenKey, { type: "json" });
      } catch (err) {
        console.warn("Token lookup failed in Blobs:", err.message);
      }

      if (!tokenData && global.__tokenCache.has(cleanToken)) {
        tokenData = global.__tokenCache.get(cleanToken);
      }

      if (!tokenData) {
        return {
          statusCode: 403,
          headers,
          body: JSON.stringify({
            error: "Неверный или уже использованный токен загрузки! Проверьте правильность кода или обратитесь к модераторам."
          }),
        };
      }

      // Check Tier: If artwork is Grand (size > standard), require grand tier token!
      if (isGrandSize && tokenData.tier !== "grand") {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: `Этот токен предназначен только для Стандартных холстов (до 6 блоков, например 3×2 или 2×3)! Для холста ${parsedWidth}×${parsedHeight} требуется токен «Великий холст Нирхаллы» (до 8×5 / 5×8).`
          }),
        };
      }

      // Burn the single-use token immediately!
      try {
        await store.delete(tokenKey);
      } catch (e) {}
      global.__tokenCache.delete(cleanToken);

      tokenMetadata = {
        targetPlayer: tokenData.targetPlayer || "Не указан",
        usedToken: cleanToken,
        tokenIssuedBy: tokenData.issuedBy || "Администрация"
      };
    }

    // 3. Generate random 4-digit code (1000 - 9999)
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const cleanTitle = (title || "").trim() || `Холст #${code}`;
    const cleanCategory = (category || "art").trim().toLowerCase();

    const artData = {
      code,
      image, // base64 data url
      width: parsedWidth,
      height: parsedHeight,
      tier,
      title: cleanTitle,
      category: cleanCategory,
      isHidden,
      // 🕵️ Moderator / Admin Audit Evidence:
      targetPlayer: tokenMetadata.targetPlayer,
      uploaderIP: clientIP,
      usedToken: tokenMetadata.usedToken,
      tokenIssuedBy: tokenMetadata.tokenIssuedBy,
      hashKey,
      createdAt: Date.now()
    };

    // Save art data and duplicate hash pointer to Netlify Blobs
    let savedToBlobs = false;
    let blobErrorMsg = null;
    try {
      await store.setJSON(code, artData, {
        metadata: {
          width: String(parsedWidth),
          height: String(parsedHeight),
          tier,
          isHidden: String(isHidden)
        }
      });
      // Store hash pointer for instant duplicate lookup
      await store.set(hashKey, code);
      savedToBlobs = true;
    } catch (blobErr) {
      blobErrorMsg = blobErr.message;
      console.warn("Netlify Blobs upload save failed:", blobErr.message);
    }

    // Save in memory cache
    global.__artCache.set(code, artData);

    // Write to security audit log
    try {
      let logs = [];
      try { logs = await store.get("sys_audit_log", { type: "json" }) || []; } catch (e) {}
      logs.unshift({
        id: crypto.randomBytes(4).toString("hex"),
        timestamp: Date.now(),
        type: isHidden ? "ADMIN_TEST_UPLOAD" : "ART_UPLOAD",
        username: tokenMetadata.targetPlayer,
        ip: clientIP,
        text: isHidden
          ? `Администратор [${tokenMetadata.targetPlayer}] (IP: ${clientIP}) создал СКРЫТЫЙ холст #${code} (${parsedWidth}×${parsedHeight} блока, только для тестов)`
          : `Игрок [${tokenMetadata.targetPlayer}] (IP: ${clientIP}) загрузил арт #${code} (${parsedWidth}×${parsedHeight} блока, ${tier === "grand" ? "Великий" : "Стандарт"}, токен: ${tokenMetadata.usedToken})`
      });
      if (logs.length > 250) logs = logs.slice(0, 250);
      await store.setJSON("sys_audit_log", logs);
    } catch (e) {}

    return {
      statusCode: 200,
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        code,
        width: parsedWidth,
        height: parsedHeight,
        tier,
        title: cleanTitle,
        category: cleanCategory,
        isHidden,
        isDuplicate: false,
        savedToBlobs,
        blobError: blobErrorMsg,
        message: isHidden
          ? "Скрытый тестовый холст успешно создан! Он невидим для игроков и модераторов."
          : "Холст успешно загружен и готов к установке в Майнкрафте!"
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
