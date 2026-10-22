# Hot Creation — Cloudflare Workers + FLUX

Mobile-friendly image-generation frontend and same-origin Cloudflare Worker proxy. The BFL key is entered into the page, held in JavaScript memory only, and sent in an HTTPS request header to the Worker. The Worker forwards it to BFL as `x-key`; it does not write the key to disk, KV, D1, logs, cookies, or a URL. The browser clears the field on page exit, but browsers/OS may retain clipboard history if you pasted it.

## Files

- `public/index.html` — frontend UI and polling logic
- `src/index.js` — API proxy, input validation, polling URL allow-list
- `wrangler.toml` — Worker and static asset configuration
- `package.json` — Wrangler dev/deploy commands

## Deploy from Android

You can use GitHub's mobile website/app and Cloudflare dashboard. Easiest route is to upload these files into a GitHub repository, then deploy with Cloudflare Workers Builds if available for your account. If using a terminal (for example Termux), install Node.js and Git, then:

```sh
npm install
npx wrangler login
npm run deploy
```

Run those commands from the project directory. Wrangler will print your `https://<worker-name>.<account>.workers.dev` URL. Open it on Android, paste your BFL API key into the password field, and generate.

### Deploy using Cloudflare dashboard / Git integration

1. Create a GitHub repository named `hot-creation-flux` and upload the four project files/folders, preserving their paths.
2. In Cloudflare dashboard, open **Workers & Pages** and create a Worker using your repository/build integration if available. If the UI only offers static Pages deployment, do not deploy only `public/`—the `src/index.js` Worker proxy is required.
3. Recommended and most reliable: use Wrangler CLI from a Node-enabled terminal: `npm install`, `npx wrangler login`, `npm run deploy`.
4. Open the deployed `workers.dev` URL and check that it says “Ready to create.”

No BFL key needs to be configured in Cloudflare secrets because this version intentionally takes the key per browser session. Do not commit keys into GitHub, put them in `wrangler.toml`, or add them to query strings.

## Local test

```sh
npm install
npx wrangler dev
```

Open the local URL Wrangler prints. Use a test key and remember local development is not HTTPS on the local device; deployed `workers.dev` is HTTPS.

## API details verified against BFL's official quickstart

- Submit: `POST https://api.bfl.ai/v1/flux-2-pro` (same pattern for selected FLUX.2 model)
- Headers: `accept: application/json`, `x-key: <key>`, `Content-Type: application/json`
- Body: `{ "prompt": "...", "width": 1024, "height": 1024 }`
- Submission returns `polling_url`; poll that exact URL until `status` is `Ready`, then use `result.sample`. Result image URLs are temporary (about 10 minutes).
- FLUX.2 dimensions: multiples of 16, minimum 64×64, maximum 4 megapixels. This UI offers common dimensions within those limits.

Official guide: https://help.bfl.ai/articles/8446125349-quickstart-guide
Dimensions: https://help.bfl.ai/articles/8916739058-what-aspect-ratios-and-output-dimensions-are-supported

## Security and troubleshooting

- The key is not persisted by app code, but the browser must retain it in memory while a generation is running. Anyone with access to your unlocked device/tab could use it.
- This is a proxy, not a public free API: users need their own BFL key and credits. For a public deployment, add authentication/rate limiting to prevent abuse of your Worker.
- `401`: key invalid or not authorized. `429`: BFL rate limit/credits or usage issue. `400`: check prompt/model/dimensions. If you see “Failed to fetch,” ensure the site is opened from the deployed Worker URL, not by opening `index.html` as a local file; frontend and `/api/*` must share the same origin.
- This code validates BFL polling URLs to avoid turning the Worker into an arbitrary URL proxy. It does not persist prompts or image results.
