# PotatFarmer

### Config

- Rename env.example to .env
- Paste bearer token from potat.app
- To enable automatic quizzes, set `AI_API_KEY` to an OpenAI, Gemini, or
  DeepSeek API key and set `API_PROVIDER` to the matching provider. The provider
  defaults to `openai`. Set `QUIZ_ENABLED=false` to disable automatic quizzes.
  Logs are emitted as structured JSON to stderr and retained in
  `logs/potatfarmer.log`. Set `LOG_FILE` to choose a different path, and set
  `LOG_LEVEL=debug` for command responses, scheduler decisions, and detailed
  quiz diagnostics. To follow the retained logs, run
  `tail -f logs/potatfarmer.log`.

Example:

```env
AI_API_KEY=your-api-key
API_PROVIDER=gemini
```

### How to use

```
git clone https://github.com/cqttv/PotatFarmer.git
cd /PotatFarmer
npm install
npm run build
npm run start
```

### For PM2

```
npm run start:pm2
pm2 logs PotatFarmer
```
