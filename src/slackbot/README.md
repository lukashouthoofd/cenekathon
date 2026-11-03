# Json-bot (Slack)

Stuurt vragen uit Slack door naar de lokale chat-backend.

## Starten

Start eerst de backend op poort 8000, en dan vanuit de repo-root:

```
node src/slackbot/bot.mjs
```

## Env-variabelen (in de repo-root `.env`)

- `SLACK_APP_TOKEN` (verplicht, begint met `xapp-`)
- `SLACK_BOT_TOKEN` (verplicht, begint met `xoxb-`)
- `CHAT_URL` (optioneel, standaard `http://localhost:8000/api/chat`)

## Slack-app instellen

1. Zet **Socket Mode** aan en maak een app-level token met scope `connections:write`.
2. Zet onder **Event Subscriptions** de events `app_mention` en `message.im` aan.
3. Zet onder **App Home** de **Messages Tab** aan.
4. Installeer de app in de workspace en kopieer de Bot User OAuth Token.
