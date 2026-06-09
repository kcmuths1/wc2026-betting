# ⚽ FIFA World Cup 2026 — Betting Tracker

A real-time friends betting tracker for FIFA World Cup 2026.

## Setup Instructions

### 1. Firebase (free database for real-time sync)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `wc2026-betting` → Create
3. In the left sidebar: **Build → Firestore Database → Create database**
   - Choose **Start in test mode** → Next → Enable
4. In the left sidebar: **Project settings (gear icon) → General**
5. Scroll to **Your apps** → click the **</>** (web) icon → Register app
6. Copy the `firebaseConfig` object shown
7. Open `src/firebase.js` and replace the placeholder values with your config

### 2. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. Click **Add New Project** → Import your `wc2026-betting` GitHub repo
3. Framework preset: **Vite**
4. Click **Deploy**
5. Done! Vercel gives you a live URL like `wc2026-betting.vercel.app`

### 3. Share the link

Share the Vercel URL with your friends. Everyone uses the same link.
- Players type their name to log in
- Admin password default: `admin2026` (change it in the app Settings tab)

## Tech Stack

- React 18 + Vite
- Recharts (charts)
- Firebase Firestore (real-time database)
- Vercel (hosting)
