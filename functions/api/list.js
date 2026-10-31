import { CORS_HEADERS, handleOptions, jsonResponse, getStaffSession } from "./_common.js";
import { INITIAL_ITEMS } from "./_initial_data.js";

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet(context) {
  const { env } = context;
  const staffSession = await getStaffSession(context);
  const isStaff = Boolean(staffSession);
  const isAdmin = Boolean(staffSession && staffSession.role === "admin");

  const itemsMap = new Map();

  // 1. Load seeded initial items
  for (const it of INITIAL_ITEMS) {
    itemsMap.set(String(it.code), { ...it });
  }

  // 2. Read from in-memory cache
  if (globalThis.__artCache) {
    for (const [code, data] of globalThis.__artCache.entries()) {
      if (typeof code === "string" && !code.startsWith("hash_") && !code.startsWith("session_") && !code.startsWith("token_") && !code.startsWith("mod_user_")) {
        const isHidden = Boolean(data.isHidden);
        if (isHidden && !isAdmin) continue;
        const width = data.width || 1;
        const height = data.height || 1;
        const isGrand = data.tier === "grand" || width > 3 || height > 3 || (width * height > 6);
        itemsMap.set(String(code), {
          code: String(code),
          width,
          height,
          tier: isGrand ? "grand" : "standard",
          title: data.title || `Холст #${code}`,
          category: data.category || "art",
          isHidden,
          createdAt: data.createdAt || Date.now(),
          imageUrl: `/api/get?code=${code}&format=png`,
          ...(isStaff ? {
            audit: {
              targetPlayer: data.targetPlayer || "Не указан",
              uploaderIP: data.uploaderIP || "Скрыт",
              usedToken: data.usedToken || "Н/Д",
              tokenIssuedBy: data.tokenIssuedBy || "Администрация"
            }
          } : {})
        });
      }
    }
  }

  // 3. Read from Cloudflare KV if configured
  if (env && env.ART_KV) {
    try {
      const listRes = await env.ART_KV.list();
      for (const key of listRes.keys || []) {
        if (!key.name.startsWith("hash_") && !key.name.startsWith("session_") && !key.name.startsWith("token_") && !key.name.startsWith("mod_user_")) {
          const data = await env.ART_KV.get(key.name, "json");
          if (!data) continue;
          const isHidden = Boolean(data.isHidden);
          if (isHidden && !isAdmin) continue;
          const width = data.width || 1;
          const height = data.height || 1;
          const isGrand = data.tier === "grand" || width > 3 || height > 3 || (width * height > 6);
          itemsMap.set(String(key.name), {
            code: String(key.name),
            width,
            height,
            tier: isGrand ? "grand" : "standard",
            title: data.title || `Холст #${key.name}`,
            category: data.category || "art",
            isHidden,
            createdAt: data.createdAt || Date.now(),
            imageUrl: `/api/get?code=${key.name}&format=png`,
            ...(isStaff ? {
              audit: {
                targetPlayer: data.targetPlayer || "Не указан",
                uploaderIP: data.uploaderIP || "Скрыт",
                usedToken: data.usedToken || "Н/Д",
                tokenIssuedBy: data.tokenIssuedBy || "Администрация"
              }
            } : {})
          });
        }
      }
    } catch (e) {}
  }

  const items = Array.from(itemsMap.values());
  const visibleItems = items.filter(it => !it.isHidden || isAdmin);
  visibleItems.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return jsonResponse({
    success: true,
    count: visibleItems.length,
    isStaff,
    isAdmin,
    items: visibleItems
  });
}
