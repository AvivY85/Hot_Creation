const BFL = "https://api.bfl.ai";
const MODELS = new Set(["flux-2-pro", "flux-2-max", "flux-2-flex", "flux-2-klein-4b"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
function keyFrom(request) { return (request.headers.get("x-flux-api-key") || "").trim(); }
async function bodyJson(request) {
  try { return await request.json(); } catch { return null; }
}
async function bflError(response) {
  let message = `FLUX API returned HTTP ${response.status}`;
  try { const data = await response.json(); message = data.detail || data.message || data.error || message; } catch {}
  return String(message).slice(0, 500);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health" && request.method === "GET") return json({ ok: true, service: "Hot Creation FLUX proxy" });
    if (url.pathname === "/api/generate" && request.method === "POST") {
      const key = keyFrom(request);
      if (!key) return json({ error: "Enter your BFL API key first." }, 400);
      const data = await bodyJson(request);
      if (!data || typeof data.prompt !== "string" || !data.prompt.trim()) return json({ error: "A prompt is required." }, 400);
      const model = MODELS.has(data.model) ? data.model : "flux-2-pro";
      const width = Number(data.width || 1024), height = Number(data.height || 1024);
      // FLUX.2 dimensions are multiples of 16, at least 64 px, up to 4 MP.
      if (!Number.isInteger(width) || !Number.isInteger(height) || width < 64 || height < 64 || width % 16 || height % 16 || width * height > 4_000_000) {
        return json({ error: "Dimensions must be multiples of 16, at least 64×64, and no more than 4 megapixels." }, 400);
      }
      try {
        const upstream = await fetch(`${BFL}/v1/${model}`, {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json", "x-key": key },
          body: JSON.stringify({ prompt: data.prompt.trim(), width, height, output_format: "jpeg" })
        });
        if (!upstream.ok) return json({ error: await bflError(upstream) }, upstream.status === 401 || upstream.status === 403 ? 401 : 502);
        const result = await upstream.json();
        if (!result.polling_url) return json({ error: "FLUX response did not include polling_url." }, 502);
        const pollUrl = new URL(result.polling_url);
        if (pollUrl.protocol !== "https:" || pollUrl.hostname !== "api.bfl.ai" || !pollUrl.pathname.startsWith("/v1/get_result")) return json({ error: "FLUX returned an unexpected polling URL." }, 502);
        return json({ polling_url: pollUrl.toString(), request_id: result.id || null });
      } catch (error) {
        return json({ error: "Could not reach the FLUX API. Check your connection and try again." }, 502);
      }
    }
    if (url.pathname === "/api/poll" && request.method === "POST") {
      const key = keyFrom(request);
      if (!key) return json({ error: "Your API key is missing. Enter it again." }, 400);
      const data = await bodyJson(request);
      let pollUrl;
      try { pollUrl = new URL(data?.polling_url); } catch { return json({ error: "Invalid polling URL." }, 400); }
      if (pollUrl.protocol !== "https:" || pollUrl.hostname !== "api.bfl.ai" || !pollUrl.pathname.startsWith("/v1/get_result")) return json({ error: "Polling URL rejected." }, 400);
      try {
        const upstream = await fetch(pollUrl.toString(), { headers: { accept: "application/json", "x-key": key } });
        if (!upstream.ok) return json({ error: await bflError(upstream) }, 502);
        const result = await upstream.json();
        return json({ status: result.status || "Pending", result: result.result?.sample || null, details: result.details || null });
      } catch {
        return json({ error: "Could not check FLUX generation status. Please retry." }, 502);
      }
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "Not found" }, 404);
    return env.ASSETS.fetch(request);
  }
};
