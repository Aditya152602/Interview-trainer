# Voice Assistant and Speaking Analytics

## What was added

- Optional voice interview mode (enabled by default on the setup screen).
- Browser speech synthesis reads each interview question, AI feedback, and model answers aloud.
- Browser speech recognition transcribes candidate answers into the existing answer editor. Candidates can still type or edit transcripts.
- Context-aware follow-up questions are requested during answer evaluation and can be added to the interview as an optional next question.
- Per-answer and session-level coaching indicators: recognized word count, estimated words per minute, transcript filler-word count, and approximate gaps between finalized speech-recognition segments.
- Microphone permission/error handling and a browser compatibility message.

## Browser support and limitations

- Speech recognition is exposed through the Web Speech API (`SpeechRecognition` or `webkitSpeechRecognition`). Support and behavior vary by browser and operating system; Chrome/Edge are the recommended first targets.
- Speech recognition may use browser-vendor services and requires an internet connection in many environments. The site should clearly obtain microphone permission through the browser's own prompt. Do not describe this as offline or guaranteed private local processing.
- Speech synthesis uses the browser's installed voices. Voice quality and the availability of an `en-IN` voice vary by device.
- Speaking pace is estimated from the elapsed recognition session; filler counts are based on the transcript. Long gaps are approximated from the time between finalized recognition segments, not measured acoustic silence. These are coaching estimates, not validated assessments of confidence, accent, pronunciation, emotion, or communication ability.
- Typed-only answers receive a word-count estimate but do not have reliable speaking-rate or pause metrics.

## Local setup

1. Install Node.js (LTS).
2. Run `npm install`.
3. Copy `.env.example` to `.env` and set `GROQ_API_KEY` to your own Groq API key.
4. Run `npm run dev`.

Never commit `.env` or place the Groq key in frontend code.

## Deploying safely to the existing Vercel project

1. Commit/push these changes to the Git repository connected to the existing Vercel project, or deploy the updated project to a Vercel Preview first.
2. In Vercel Project Settings → Environment Variables, confirm `GROQ_API_KEY` exists for Preview and Production. The key remains server-side in `api/chat.js`.
3. Deploy a Preview and test question generation, typed answers, microphone permission, transcription, spoken questions/feedback, follow-up questions, and the final report.
4. Promote/merge only after the Preview passes. Production deployment replaces the live version, so do not change the Production deployment until you have verified the Preview.
5. If the deployed site is served over HTTPS (as Vercel normally does), microphone access is available subject to browser permission and browser support.

## Existing API compatibility

The existing `POST /api/chat` endpoint and Groq model (`openai/gpt-oss-20b`) are retained. The API now validates input and returns a consistent error shape. No new paid dependency or separate server is required.
