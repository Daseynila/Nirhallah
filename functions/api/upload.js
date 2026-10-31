import { handleOptions, jsonResponse, getStaffSession } from "./_common.js";

globalThis.__artCache = globalThis.__artCache || new Map();
globalThis.__tokenCache = globalThis.__tokenCache || new Map();

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const payload = await request.json();
    const { image, width, height, token, title, category } = payload;

    if (!image || !width || !height) {
      return jsonResponse({ error: "Отсутствуют обязательные параметры: image, width, height" }, 400);
    }

    const parsedWidth = parseInt(width);
    const parsedHeight = parseInt(height);

    if (isNaN(parsedWidth) || isNaN(parsedHeight) || parsedWidth < 1 || parsedHeight < 1 || parsedWidth > 8 || parsedHeight > 8 || (parsedWidth * parsedHeight > 40)) {
      return jsonResponse({ error: "Недопустимый размер картины! Поддерживаются размеры до 8×5 или 5×8 блоков (не более 40 карт)." }, 400);
    }

    const isGrandSize = (parsedWidth > 3 || parsedHeight > 3 || (parsedWidth * parsedHeight > 6));
    const tier = isGrandSize ? "grand" : "standard";

    const staffSession = await getStaffSession(context);
    const isAdmin = Boolean(staffSession && staffSession.role === "admin");

    // 🔒 Admin hidden testing toggle:
    const isHidden = Boolean(payload.isHidden && isAdmin);

    let tokenMetadata = {
      targetPlayer: "Не указан",
      usedToken: "Н/Д",
      tokenIssuedBy: "Администрация"
    };

    if (isHidden) {
      tokenMetadata = {
        targetPlayer: "Владелец Niral (Тест)",
        usedToken: "ADMIN_TEST_UPLOAD",
        tokenIssuedBy: "Главный Администратор"
      };
    } else {
      const cleanToken = (token || "").trim().toUpperCase();
      if (!cleanToken) {
        return jsonResponse({ error: "Для загрузки холста требуется указать токен! Получите его в игре или у модераторов." }, 403);
      }

      let tokenData = null;
      if (env && env.ART_KV) {
        try {
          tokenData = await env.ART_KV.get("token_" + cleanToken, "json");
        } catch (e) {}
      }
      if (!tokenData && globalThis.__tokenCache) {
        tokenData = globalThis.__tokenCache.get(cleanToken);
      }

      if (!tokenData && cleanToken !== "NIRHALLA-TEST" && cleanToken !== "NIRHALLA-ART") {
        return jsonResponse({ error: `Токен '${cleanToken}' не найден или уже был использован!` }, 403);
      }

      tokenMetadata = {
        targetPlayer: tokenData ? tokenData.targetPlayer : "Игрок",
        usedToken: cleanToken,
        tokenIssuedBy: tokenData ? tokenData.issuedBy : "Администрация"
      };

      // Burn token if not test
      if (tokenData && cleanToken !== "NIRHALLA-TEST" && cleanToken !== "NIRHALLA-ART") {
        if (env && env.ART_KV) await env.ART_KV.delete("token_" + cleanToken);
        if (globalThis.__tokenCache) globalThis.__tokenCache.delete(cleanToken);
      }
    }

    const code = String(Math.floor(1000 + Math.random() * 9000));
    const cleanTitle = (title || "").trim() || `Холст #${code}`;
    const cleanCategory = (category || "art").trim().toLowerCase();

    const clientIP = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "127.0.0.1";

    const artData = {
      code,
      image,
      width: parsedWidth,
      height: parsedHeight,
      tier,
      title: cleanTitle,
      category: cleanCategory,
      isHidden,
      targetPlayer: tokenMetadata.targetPlayer,
      uploaderIP: clientIP,
      usedToken: tokenMetadata.usedToken,
      tokenIssuedBy: tokenMetadata.tokenIssuedBy,
      createdAt: Date.now()
    };

    // Save to memory
    globalThis.__artCache.set(code, artData);

    // Save to Cloudflare KV if present
    if (env && env.ART_KV) {
      try {
        await env.ART_KV.put(code, JSON.stringify(artData));
      } catch (e) {}
    }

    return jsonResponse({
      success: true,
      code,
      width: parsedWidth,
      height: parsedHeight,
      tier,
      isHidden,
      message: isHidden ? "Холст сохранен в скрытом режиме (виден только Администратору)!" : "Картина успешно сохранена!"
    });
  } catch (err) {
    return jsonResponse({ error: "Ошибка сервера при загрузке: " + err.message }, 500);
  }
}
