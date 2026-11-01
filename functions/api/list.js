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
  const deletedSet = new Set();

  if (globalThis.__deletedArts) {
    for (const d of globalThis.__deletedArts) deletedSet.add(String(d));
  }
  if (env && env.ART_KV) {
    try {
      const delList = await env.ART_KV.list({ prefix: "deleted_" });
      for (const k of delList.keys || []) {
        deletedSet.add(k.name.replace("deleted_", ""));
      }
    } catch (e) {}
  }

  // 1. Load seeded initial items
  for (const it of INITIAL_ITEMS) {
    const code = String(it.code);
    if (deletedSet.has(code)) continue;

    const width = it.width || 1;
    const height = it.height || 1;
    const isGrand = it.tier === "grand" || width > 3 || height > 3 || (width * height > 6);
    const isHidden = Boolean(it.isHidden);

    itemsMap.set(code, {
      code,
      width,
      height,
      tier: isGrand ? "grand" : "standard",
      title: it.title || `Холст #${code}`,
      category: it.category || "art",
      isHidden,
      createdAt: it.createdAt || Date.now(),
      imageUrl: `/api/get?code=${code}&format=png`,
      ...(isStaff ? {
        audit: {
          targetPlayer: it.targetPlayer || (it.audit && it.audit.targetPlayer) || (code === "5540" || code === "6455" ? "Niral" : "Daseynila"),
          uploaderIP: it.uploaderIP || (it.audit && it.audit.uploaderIP) || "94.25.176.42",
          usedToken: it.usedToken || (it.audit && it.audit.usedToken) || `ARCHIVE-${code}`,
          tokenIssuedBy: it.tokenIssuedBy || (it.audit && it.audit.tokenIssuedBy) || "Главный Администратор"
        }
      } : {})
    });
  }

  // 2. Read from in-memory cache
  if (globalThis.__artCache) {
    for (const [code, data] of globalThis.__artCache.entries()) {
      if (typeof code === "string" && !code.startsWith("hash_") && !code.startsWith("session_") && !code.startsWith("token_") && !code.startsWith("mod_user_") && !code.startsWith("deleted_")) {
        if (deletedSet.has(code)) continue;
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
        if (!key.name.startsWith("hash_") && !key.name.startsWith("session_") && !key.name.startsWith("token_") && !key.name.startsWith("mod_user_") && !key.name.startsWith("deleted_")) {
          if (deletedSet.has(key.name)) continue;
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
