export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const key = "configs.json";

    async function getAllConfigs() {
      const obj = await env.STREAM_BUCKET.get(key);
      if (!obj) return [];
      const text = await obj.text();
      return JSON.parse(text || "[]");
    }

    async function saveConfigs(data) {
      await env.STREAM_BUCKET.put(key, JSON.stringify(data, null, 2));
    }

    if (url.pathname === "/") {
      return new Response("Welcome to StreamLab Config Server", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (url.pathname === "/configs" && request.method === "GET") {
      const configs = await getAllConfigs();
      return Response.json(configs);
    }

    if (url.pathname === "/configs/active" && request.method === "GET") {
      const configs = await getAllConfigs();
      const active = configs.find(cfg => cfg.active);
      if (!active) return Response.json({ error: "No active config" }, { status: 404 });
      return Response.json(active);
    }

    if (url.pathname === "/configs" && request.method === "POST") {
      const configs = await getAllConfigs();
      const body = await request.json();
      const newConfig = {
        ...body,
        id: crypto.randomUUID(),
        active: false,
        updatedAt: new Date().toISOString()
      };
      configs.push(newConfig);
      await saveConfigs(configs);
      return Response.json({ id: newConfig.id }, { status: 201 });
    }

    if (url.pathname.startsWith("/configs/") && request.method === "PUT") {
      const id = url.pathname.split("/")[2];
      const body = await request.json();
      const configs = await getAllConfigs();
      const idx = configs.findIndex(cfg => cfg.id === id);
      if (idx === -1) return Response.json({ error: "Config not found" }, { status: 404 });

      configs[idx] = {
        ...configs[idx],
        ...body,
        updatedAt: new Date().toISOString()
      };
      await saveConfigs(configs);
      return Response.json({ success: true });
    }

    if (url.pathname.startsWith("/configs/") && request.method === "DELETE") {
      const id = url.pathname.split("/")[2];
      let configs = await getAllConfigs();
      const originalLen = configs.length;
      configs = configs.filter(cfg => cfg.id !== id);
      if (configs.length === originalLen) {
        return Response.json({ error: "Config not found" }, { status: 404 });
      }
      await saveConfigs(configs);
      return new Response(null, { status: 204 });
    }

    if (url.pathname.startsWith("/configs/") && url.pathname.endsWith("/activate") && request.method === "PATCH") {
      const id = url.pathname.split("/")[2];
      const configs = await getAllConfigs();
      if (!configs.find(cfg => cfg.id === id)) {
        return Response.json({ error: "Config not found" }, { status: 404 });
      }
      const updated = configs.map(cfg => ({
        ...cfg,
        active: cfg.id === id
      }));
      await saveConfigs(updated);
      return Response.json({ success: true });
    }

    return new Response("Not found", { status: 404 });
  },
};
