# FindIt: Lost and Found with Smart Matching

Campus web app. Students post LOST or FOUND items (optional photo). The server turns each post into text and image embeddings (Transformers.js, in-process, no paid API), suggests likely matches, and only reveals the finder's contact details after the owner answers a secret question.

## Quick start (3 commands)

Requirements: Node 18.17+ and MongoDB (local, `docker compose up -d`, or a free Atlas URI in `server/.env`).

```bash
npm install        # installs root, server and client in one go
npm run seed       # optional: demo users + 20 items with real matches
npm run dev        # API on :5000, web app on http://localhost:5173
```

`.env` files are already included with working local defaults. The **first server start downloads ~150 MB of models** (cached afterwards), so it needs internet once. Set `SKIP_MODELS=true` in `server/.env` to boot the API without models (UI testing only; matching is disabled).

Demo logins after seeding: `admin@findit.test / Admin@123`, `alice@findit.test / Student@123` (owns the lost posts), `bob@findit.test / Student@123` (finder).
Demo claim: log in as Alice, open "Lost black iPhone 13", click **This is mine** on the match, answer `golden retriever puppy`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | server (`node --watch`) + Vite client |
| `npm run seed` | **dev only**: wipes all collections, creates demo data |
| `npm run evaluate` | embeds `server/scripts/testPairs.json` (40 pairs + 20 distractors), prints top-1/top-3 accuracy, grid-searches weights/decay/threshold and prints a config to paste into `server/config/matching.js` |
| `npm run build` | production build of the client into `client/dist` |

## Environment variables

Server (`server/.env`): `PORT`, `MONGODB_URI`, `JWT_SECRET_KEY`, `JWT_EXPIRES_IN`, `CLIENT_URL` (comma-separated allowed origins), `SERVER_PUBLIC_URL`, `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` (all three or images go to `server/uploads`), `SMTP_*` (reserved, optional), `SKIP_MODELS`.
Client (`client/.env`): `VITE_SERVER_ENDPOINT` (e.g. `http://localhost:5000/api`), `VITE_SOCKET_URL`.

## Decisions made where the spec was silent

- A found post also carries a public **secret question** (`secretQuestion`); `secretDetail` is the private answer. Claimants need a question to answer.
- Only the owner of an **open lost post that has a Match with that found item** may claim it (403 otherwise). This blocks drive-by guessing.
- A wrong answer returns `400` with `attemptsLeft`; the 4th try inside an hour returns `429` with `Retry-After`.
- Editing a post re-embeds it and deletes its old matches. Photos cannot be changed after posting (delete and repost).
- Duplicate warnings are stored on the item (`duplicateOf`) and sent as a `system` notification; posting is never blocked.
- Day-7 reminders apply to lost posts only. Cron runs in UTC.
- "Match success rate" = of posts that received at least one suggestion, the share that ended `claimed` or `returned`.
- `testPairs.json` ships without images (none can be bundled). Add an `"image": "images/x.jpg"` path to any item to test the image signal; otherwise only text/category/time are tuned.

## Deployment

1. **MongoDB Atlas**: create a free cluster, add a database user, allow your host's IPs, copy the URI into `MONGODB_URI`.
2. **Cloudinary** (recommended in production): fill the three `CLOUDINARY_*` vars. Host disks on Render/Railway are ephemeral, so local uploads would vanish on redeploy.
3. **Backend on Render or Railway** (not serverless: the models need ~1 GB RAM and a long-running process). Root directory `server`, build `npm install`, start `npm start`. Set all server env vars, `CLIENT_URL` to your Vercel URL and `SERVER_PUBLIC_URL` to the backend URL. Use an instance with at least 1 GB RAM; first boot downloads the models, so attach a persistent disk or accept a slower cold start.
4. **Frontend on Vercel**: root directory `client`, framework Vite, set `VITE_SERVER_ENDPOINT=https://<backend>/api` and `VITE_SOCKET_URL=https://<backend>`. Add a rewrite of all paths to `/index.html` (SPA routing).
5. Check `GET https://<backend>/api/health` shows `modelsLoaded: true`.

## Design decisions and trade-offs

- **Embeddings in a worker thread**: inference is CPU-bound; running it on the main thread would freeze every API request. One worker with a concurrency-1 queue keeps memory predictable at the cost of throughput.
- **Hybrid score, not text similarity alone**: category and time encode facts embeddings blur (an item cannot be found before it was lost). Every weight lives in `config/matching.js`, and `evaluate.js` tunes them against labelled data.
- **Matches are suggestions, never assignments**; ownership is decided only by the secret-detail claim.
- **Brute-force cosine over candidates** (date-windowed, open, opposite type) is fine at campus scale. Past that, move to Atlas Vector Search.
- **Match asymmetry**: a new post stores only its own top 5, so an older post may not list a newer item that ranks it lower than five others. Cheap and simple; a nightly recompute would close the gap.
- **Magic-byte check on uploads** in addition to mimetype, since mimetypes are client-supplied.
- **Secrets never leave the server**: every item query uses `PUBLIC_SELECT`, and `secretDetail`/embeddings are `select: false`.
- **Not tested here**: the project was assembled in an offline sandbox. The matching math was unit-checked and all server files pass `node --check`, but `npm install`, the model download and the UI have not been run end to end. If something breaks on first run, the server logs prefix every subsystem (`[db]`, `[embeddings]`, `[process]`, `[cron]`).

## Interview talking points

**2-minute explanation.** FindIt is a campus lost-and-found app where users post lost or found items and the system suggests matches instead of making people scroll. When someone posts, the API answers immediately and a background job embeds the title, description and location with MiniLM, and the photo with CLIP, in a worker thread so requests stay fast. It then compares the post with open posts of the opposite type from the last 30 days, scoring text similarity, image similarity, category and a time-decay term, keeps the top 5 above a threshold and notifies the owner over Socket.io. Matches are only suggestions: to get the finder's contact details the owner must answer a secret question the finder set. Verification uses normalized exact match with an embedding fallback, 3 wrong attempts then a 1-hour cooldown, and an atomic `findOneAndUpdate` so two people cannot both win. Cron jobs expire old posts, release stale claims and retry failed embeddings. I built an evaluation script with 40 labelled pairs and 20 distractors to measure top-1/top-3 accuracy and tune the weights.

**Why embeddings over keyword search?** People describe the same object differently ("Apple phone, transparent cover" vs "black iPhone in a clear case"). Keyword search misses synonyms and paraphrase; embeddings capture meaning, and CLIP lets two photos match even when the descriptions are poor. Keyword search stays useful for the Browse filter.

**Scaling to a million posts?** Brute-force cosine becomes too slow. Store embeddings in Atlas Vector Search, query nearest neighbours with a pre-filter on type, status and date range, then re-rank the few hundred results with the same hybrid formula. Move embedding to a separate worker service fed by a queue so API instances stay stateless.

**Wrong matches?** Matches are suggestions behind a threshold with a visible score breakdown, so users judge them. Ownership requires the secret claim, and the evaluation script lets us tune the threshold for precision versus recall with data instead of guesses. Users can also ignore or delete a post.

**Preventing fake claims?** Only owners of a matching lost post can claim, the secret answer and its embedding never leave the server, wrong attempts are logged per user and item and locked out after 3 for an hour, the route is rate limited, the status flip is atomic, and contact details are returned only after success.

**Identical items (two black iPhones)?** Text and image similarity will rank both highly, so the system cannot tell them apart by itself. That is exactly why the secret detail exists: the finder asks something only the true owner knows (lock screen, case sticker), and a claimant must pass it. The duplicate check also warns when one person posts the same item twice.

**Why a worker thread?** Model inference is CPU-bound and blocks the Node event loop. In a worker, the API keeps serving requests while embeddings run; a request-id promise map and a concurrency-1 queue make it behave like an async function call.

**Resume bullets** (replace the placeholders with your real numbers from `npm run evaluate`):
- Built FindIt, a full-stack (React, Express, MongoDB, Socket.io) campus lost-and-found platform that ranks matches with MiniLM and CLIP embeddings, reaching [X]% top-1 and [Y]% top-3 accuracy on a [N]-pair labelled evaluation set.
- Designed a secret-detail claim flow with atomic ownership transfer, attempt limiting and cooldowns, with [N] automated checks/tests and zero secret or embedding leakage in API responses.
- Moved transformer inference into a worker thread with a queued pipeline and cron-based retries, keeping median API latency under [Z] ms while processing [N] posts in the background.
