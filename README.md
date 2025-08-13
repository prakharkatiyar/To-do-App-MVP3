# To‑Do Reminder (MVP)

A minimal, reliable to‑do app with local notifications and offline support (PWA).

## Quick Start

```bash
# 1) Install deps
npm install

# 2) Run locally
npm run dev   # open the shown URL

# 3) Build & preview production
npm run build
npm run preview
```

## Notes

- **Notifications** are local to the browser. Click **Enable Notifications** in the app and allow the permission prompt.
- **PWA**: After build/preview (or once deployed), you can **Install** it from the browser menu for better reliability.
- No cloud sync / recurring tasks — intentionally out of scope for MVP.

## Deploy

- **Vercel/Netlify**: Just import the repo; both detect Vite automatically.
- **Static hosting**: Serve the `dist/` folder after `npm run build`.
