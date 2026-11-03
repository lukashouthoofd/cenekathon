# Handoff Salaets: Claude-agent en Slack

## Status

- [x] `src/backend/chat.mjs`: SYSTEM-prompt (Json, Nederlands, alleen summary-cijfers, "Advies:"-regel, json-dashboardblok).
- [x] `src/backend/router.ts`: modelkeuze. Dashboardwoorden gaan naar het sterke model (2500 tokens), bedrijfsnaam of trendwoord naar het sterke model (1500), de rest naar het snelle (800). Standaard `claude-haiku-5-5` en `claude-sonnet-5-5` via `AI_MODEL` en `AI_MODEL_STRONG`.
- [x] `src/slackbot/bot.mjs`: Socket Mode, antwoordt op `app_mention` en op DM's, roept `POST /api/chat` aan (`CHAT_URL`, standaard `http://localhost:8000/api/chat`), max 2000 tekens.
- [ ] Tool use van de agent (nu één `fetch` naar `/v1/messages`, geen tools).
- [ ] Actieformaat: HR-aanname, interne tool door Engineering, softwareaankoop door IT.
- [ ] Goedkeuringsflow voor HR, Engineering en IT (in opbouw; code onbekend).
- [ ] Gedrag van de knop "Verstuur": pas posten na goedkeuring.
- [ ] Doorsturen naar kanalen per team.

## Slack-app instellingen

Bevestigd in de code: Socket Mode, `SLACK_APP_TOKEN` (`xapp-`) en `SLACK_BOT_TOKEN` (`xoxb-`) in `.env`, events `app_mention` en `message` (DM, `channel_type: im`).

Waarschijnlijk nodig, niet uit code af te leiden (controleer): scopes `app_mentions:read`, `chat:write`, `im:history`, `im:read`, `im:write`; event subscriptions `app_mention` en `message.im`; Messages Tab aan. Voor kanaalposts: `chat:write.public` of de bot uitnodigen in de kanalen voor HR, Engineering en IT. Kanaalnamen: onbekend.

## Contract voor acties

Frontend-type `Action`: `id, rank, type (training|software|internal_tool), title, department, bullets, pilot, successMetric, evidenceIds`. `SlackPreviewResponse` is `{ text }`. Een HR-hire past hier niet in; kies of `type` wordt uitgebreid (overleg met Jev en Victor).

## Mag niet worden aangepast door anderen

`src/slackbot/bot.mjs` en de SYSTEM-prompt in `chat.mjs` (gedeeld met Jev: vooraf melden).

## Vragen aan het team

1. Welke kanaalnamen gebruiken HR, Engineering en IT?
2. Wie mag "Verstuur" goedkeuren, en waar staat de status?
3. Breiden we `ActionType` uit met een hire-type?
