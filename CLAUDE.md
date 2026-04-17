# CLAUDE.md

Internal notes for contributors and agents. Keep `README.md` as the public entrypoint.

## Commands

```bash
npm run dev
npm run build
npm start
npm test
npm run typecheck

cd frontend
npm run dev
npm run build

docker compose up -d --build
```

## Current shape

- Product direction: Discord shared-memory assistant
- Core command set: `/ask`, `/summary`, `/memory`, `/schedule`, `/forget`, `/mode`, `/status`
- Removed legacy surface: music, TTS, image generation, public web chat

## Important files

- `src/index.ts` — bootstraps Discord bot, memory services, dashboard server
- `src/bot/client.ts` — Discord client wiring and event registration
- `src/bot/message-handler.ts` — message intake, extraction, query-mode branching
- `src/bot/ai.ts` — provider abstraction plus reply, extraction, query, and image-summary calls
- `src/bot/rag.ts` — vector retrieval for conversation memory
- `src/bot/vault.ts` — optional Obsidian-style user note sync under `VAULT_PATH/lovesick1`
- `src/core/memory.ts` — JSON-backed user/shared/relationship/photo memory store plus dedupe
- `src/core/events.ts` — room event persistence
- `src/core/extract.ts` — heuristic plus AI extraction application
- `src/core/query.ts` — memory query detection and prompt context assembly
- `src/shared/state.ts` — config and stats persistence
- `src/dashboard/server.ts` — admin dashboard backend

## Data layout

- `data/memory/store.json`
- `data/events/events.json`
- `data/vectors/`
- `data/state.json`

`data/` is runtime state. Do not treat it as stable source code.

## Working rules

- Keep edits narrow and directly tied to the request.
- Prefer tests when changing persistence or prompt-selection behavior.
- Route model calls through the existing AI layer instead of introducing provider-specific calls in random modules.
- Use Korean for operator-facing logs/messages and English for identifiers.

## Deployment notes

- Docker should mount `./data:/app/data`
- Provider runtime still expects a real AI backend key unless the app is reworked around Codex runtime integration
- Vault mounts, if used, should target `VAULT_PATH/lovesick1`
