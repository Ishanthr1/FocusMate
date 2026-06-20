# FocusMate

An AI study companion that watches your webcam in real time, flags when you're slouching or distracted, and pairs you with an AI tutor, quiz maker, and shared study rooms.

<!--
  TODO: drop a screenshot or GIF of the dashboard / a live study session here.
  Save it to public/screenshot.png and uncomment the line below.
  ![FocusMate screenshot](public/screenshot.png)
-->


## Try it

**[Live demo → =focus-mate-gamma.vercel.app]([https://focus-mate-gamma.vercel.app/])**

Sign in with any email and start a session — webcam access is optional but unlocks focus tracking.

## Features

- **Real-time focus tracking** — webcam analysis with MediaPipe detects looking away, slouching, and overall distraction level, with live coaching suggestions.
- **AI study assistant** — Gemini-powered chat that remembers your conversation and works alongside your session.
- **Quiz generator** — upload a PDF or DOCX and get a multiple-choice quiz back, with results saved to your profile.
- **Study rooms** — create or join a room and chat with friends over Socket.IO; optional video via Daily/Jitsi.
- **Friends + analytics** — friend requests, a session timeline, and progress reports rendered to PDF.

## Quick start (run locally)

**Prereqs:** Python 3.9, Node 18+, a Google Gemini API key.

```bash
git clone https://github.com/Ishanthr1/FocusMate.git
cd FocusMate
```

Backend:

```bash
cd backend
pip install -r requirements.txt
echo "GEMINI_API_KEY=your_key_here" > .env
python app.py
```

Frontend (in a second terminal, from the repo root):

```bash
npm install
npm run dev
```

Open http://localhost:5173.

### Environment variables

**Backend (`backend/.env`):**

- `GEMINI_API_KEY` *(required)* — used by the AI assistant and quiz generator.
- `SECRET_KEY` *(recommended)* — Flask session secret.
- `EMAIL_PASSWORD` *(optional)* — Gmail app password, only if you use the email features.

**Frontend (Vercel env or `.env.local`):**

- `VITE_CLERK_PUBLISHABLE_KEY` *(required)* — Clerk publishable key for auth.
- `VITE_API_URL` *(production only)* — points the frontend at the deployed backend. Defaults to `http://localhost:5000` in dev.

## How it works

- **Vision pipeline.** Frames are streamed from the browser over Socket.IO and processed server-side with MediaPipe FaceMesh (gaze / looking-away) and Pose (shoulder–ear angle for slouching). A distraction score is fused from gaze + posture + face-presence, and short coaching strings are emitted back to the client. Frames are never stored.
- **Why server-side vision.** Pushing MediaPipe to the browser was tempting, but doing it on the server keeps the analytics layer in one place and lets multiple clients (mobile, low-end laptops) share the same heavy models without each loading them.
- **AI chats are file-backed JSON** in `backend/data/chats/`. This is the easiest thing that works for a hobby deploy; it's also the next thing to migrate to Supabase, since the Hugging Face Spaces filesystem is ephemeral on the free tier.
- **Deploy split.** Frontend on Vercel (Vite static build) → backend on Hugging Face Spaces (Docker, gunicorn + eventlet for WebSocket support). The CORS allowlist on the backend is a regex matching any `*.vercel.app` subdomain so preview deploys work without extra config.

## Tech stack

React 19 · Vite · Clerk · Socket.IO · Flask · Flask-SocketIO · MediaPipe · OpenCV · TensorFlow Lite · Google Gemini · Daily / Jitsi (video) · ReportLab (PDF) · Vercel + Hugging Face Spaces.

## Credits

- [MediaPipe](https://github.com/google-ai-edge/mediapipe) for the FaceMesh and Pose models that make the focus tracking work.
- [FER](https://github.com/JustinShenk/fer) for emotion detection.
- [Clerk](https://clerk.com) for drop-in auth.
- [Google Gemini](https://ai.google.dev/) for the assistant and quiz generation.
