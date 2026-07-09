# 🎯 Interview Trainer Agent

An AI-powered mock interview app that generates tailored questions, scores your answers in real time, and provides coaching with model answers.

Built with React + Vite, deployed via Vercel, powered by Claude (Anthropic).

---

## Project structure

```
interview-trainer/
├── api/
│   └── chat.js          ← Vercel serverless function (keeps API key secret)
├── src/
│   ├── main.jsx
│   └── App.jsx          ← Full React app
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── .env.example
```

---

## Local development

1. Clone your repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy the env file and add your Anthropic API key:
   ```bash
   cp .env.example .env
   # Edit .env and paste your key from https://console.anthropic.com
   ```

3. Install Vercel CLI to run the serverless function locally:
   ```bash
   npm install -g vercel
   vercel dev
   ```
   This runs both the React frontend and the `/api/chat` function together at `http://localhost:3000`.

---

## Deploy to Vercel (recommended)

1. Push your code to GitHub.
2. Go to https://vercel.com → **New Project** → Import your GitHub repo.
3. Add environment variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: your key from https://console.anthropic.com
4. Click **Deploy**.

Your app will be live at `https://your-project.vercel.app`.

---

## Features

- 8 tailored questions per session (Technical, Behavioral, Situational, HR)
- Live timer per question
- AI scoring (1–10) with strengths, improvements, model answer, pro tip
- Session summary with score breakdown
