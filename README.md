# 🎯 Interview Trainer Agent

An AI-powered mock interview app that generates tailored questions, scores your answers in real time, and provides coaching with model answers.

Built with React + Vite, deployed via Vercel, powered by Groq (LLaMA 3.3 70B).

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

2. Copy the env file and add your Groq API key:
   ```bash
   cp .env.example .env
   # Edit .env and paste your key from https://console.groq.com
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
   - Key: `GROQ_API_KEY`
   - Value: your key from https://console.groq.com
4. Click **Deploy**.

Your app will be live at `https://your-project.vercel.app`.

---

## Getting a Groq API key (free)

1. Go to https://console.groq.com and sign up — it's free.
2. Click **API Keys** in the sidebar → **Create API Key**.
3. Copy the key (starts with `gsk_`) and paste it into your `.env` file or Vercel environment variables.

Groq provides free access to LLaMA 3.3 70B with generous rate limits and very fast inference.

---

## Features

- 8 tailored questions per session (Technical, Behavioral, Situational, HR)
- Live timer per question
- AI scoring (1–10) with strengths, improvements, model answer, pro tip
- Session summary with score breakdown

---

## How it works

```
Browser (React)
    ↓  POST /api/chat
Vercel Serverless Function (api/chat.js)
    ↓  Groq API (LLaMA 3.3 70B)
    ↑  JSON response
Browser renders feedback
```

The API key never touches the browser — it lives only in the Vercel serverless function as an environment variable.
