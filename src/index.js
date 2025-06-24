export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const key = "configs.json";

    function withCors(resp) {
      resp.headers.set("Access-Control-Allow-Origin", "*");
      resp.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      resp.headers.set("Access-Control-Allow-Headers", "Content-Type");
      return resp;
    }

    if (method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }));
    }

    async function getAllConfigs() {
      const obj = await env.STREAM_BUCKET.get(key);
      if (!obj) return [];
      return JSON.parse(await obj.text());
    }

    async function saveConfigs(data) {
      await env.STREAM_BUCKET.put(key, JSON.stringify(data, null, 2));
    }

    if (url.pathname === "/") {
      return withCors(new Response("Welcome to StreamLab Config Server"));
    }

    if (url.pathname === "/configs" && method === "GET") {
      const configs = await getAllConfigs();
      return withCors(Response.json(configs));
    }

    if (url.pathname === "/configs/active" && method === "GET") {
      const configs = await getAllConfigs();
      const active = configs.find(c => c.active);
      if (!active) return withCors(Response.json({ error: "No active config" }, { status: 404 }));
      return withCors(Response.json(active));
    }

    if (url.pathname === "/configs" && method === "POST") {
      const body = await request.json();
      const configs = await getAllConfigs();
      const newConfig = {
        ...body,
        id: crypto.randomUUID(),
        active: false,
        updatedAt: new Date().toISOString()
      };
      configs.push(newConfig);
      await saveConfigs(configs);
      return withCors(Response.json({ id: newConfig.id }, { status: 201 }));
    }

    if (url.pathname.startsWith("/configs/") && method === "PUT") {
      const id = url.pathname.split("/")[2];
      const body = await request.json();
      const configs = await getAllConfigs();
      const idx = configs.findIndex(cfg => cfg.id === id);
      if (idx === -1) return withCors(Response.json({ error: "Config not found" }, { status: 404 }));

      configs[idx] = {
        ...configs[idx],
        ...body,
        updatedAt: new Date().toISOString()
      };
      await saveConfigs(configs);
      return withCors(Response.json({ success: true }));
    }

    if (url.pathname.startsWith("/configs/") && method === "DELETE") {
      const id = url.pathname.split("/")[2];
      const configs = await getAllConfigs();
      const newConfigs = configs.filter(c => c.id !== id);
      if (newConfigs.length === configs.length) {
        return withCors(Response.json({ error: "Config not found" }, { status: 404 }));
      }
      await saveConfigs(newConfigs);
      return withCors(new Response(null, { status: 204 }));
    }

    if (url.pathname.startsWith("/configs/") && url.pathname.endsWith("/activate") && method === "PATCH") {
      const id = url.pathname.split("/")[2];
      const configs = await getAllConfigs();
      if (!configs.find(c => c.id === id)) {
        return withCors(Response.json({ error: "Config not found" }, { status: 404 }));
      }

      const updated = configs.map(cfg => ({
        ...cfg,
        active: cfg.id === id
      }));
      await saveConfigs(updated);
      return withCors(Response.json({ success: true }));
    }

    return withCors(new Response("Not found", { status: 404 }));
  }
}
