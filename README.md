# PotatFarmer

### Config

- Rename env.example to .env
- Paste bearer token from potat.app
- To enable automatic quizzes, add an OpenAI API key. Quizzes are enabled by
  default when `OPENAI_API_KEY` is set; set `QUIZ_ENABLED=false` to disable them.

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
