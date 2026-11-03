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
- `SLACK_CHANNEL_HR`, `SLACK_CHANNEL_ENGINEERING`, `SLACK_CHANNEL_IT` (kanaal-ID's, beginnen met `C`)

## Goedkeuring voor verzenden

Vraagt iemand expliciet om iets te sturen of aan te vragen (bijvoorbeeld "stuur dit naar HR als vacature" of "vraag een vacature aan voor ..."), met een onderwerp vacature/aannemen/werving (HR), interne tool/bouwen (Engineering) of software/kopen/licentie (IT), dan zet Json een voorstel in de thread. Vragen (eindigen op "?" of beginnen met welke/hoeveel/hoe/wat/waarom/wanneer/wie) en losse statements zonder actiewoord ("vacature voor data scientist") krijgen gewoon een chat-antwoord. Pas na een klik op **Verstuur naar ...** wordt het bericht in het teamkanaal geplaatst. Ontbreekt een kanaal-ID, dan staat dat in het voorstel en is er geen verstuurknop.

Nodig de bot uit in elk kanaal: `/invite @AI-readiness`.

## HR-samenvatting

Vraag om de skill-gaps en vacaturevoorstellen naar HR te sturen, bijvoorbeeld met "stuur skill gaps naar hr" of "stuur vacatures naar hr". Json haalt de readiness en analyse van `demo-bank` op (timeout 10 seconden) en zet de samenvatting als voorstel in de thread, met dezelfde verstuurknop. Is de backend niet bereikbaar, dan krijg je alleen een melding.

## Welkom en hulp

Bij het eerste direct bericht aan Json krijgt een gebruiker eerst een welkomstbericht, daarna het antwoord. Dit wordt onthouden in het geheugen, dus na een herstart van de bot krijgt iedereen het opnieuw. Typ `hulp` voor een lijst met voorbeeldvragen. Het welkom verschijnt niet bij een vermelding in een kanaal.

## Slack-app instellen

1. Zet **Socket Mode** aan en maak een app-level token met scope `connections:write`.
2. Zet onder **Event Subscriptions** de events `app_mention` en `message.im` aan.
3. Zet onder **App Home** de **Messages Tab** aan.
3b. Zet onder **Interactivity & Shortcuts** de interactiviteit aan (nodig voor de knoppen).
4. Installeer de app in de workspace en kopieer de Bot User OAuth Token.
