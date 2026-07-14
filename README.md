# OVERWATCH — Personal Command Panel

A retro-futurist command console for one mission: JD → international lawyer →
PhD in philosophy (phenomenology and critical political/legal thought of
vitality, time, and love). It tracks tasks, projects (tagged by academic
field), Google Docs progress, reminders, and surfaces curated creative/
analytical suggestions tuned to that specific trajectory.

No backend, no build step — static HTML/CSS/JS. All your data (tasks,
projects, reminders, settings) lives in your browser's `localStorage`, on
your machine only.

## Running it

Because the Google sign-in flow requires a real HTTP origin (not a bare
`file://` path), run a tiny static server from the repo root instead of
double-clicking `index.html`:

```bash
# Python (already on most machines)
python3 -m http.server 8000

# or Node, if you have it
npx serve .
```

Then open `http://localhost:8000` in your browser. Bookmark it, pin the tab,
or point a spare tablet/monitor at it — that's the whole "always-on console"
setup.

To put it online instead of running it locally (e.g. GitHub Pages, Vercel,
Netlify — any static host works, since there's no server code), deploy this
folder as-is and use that URL as your authorized origin in the Google Cloud
step below.

## Using the panel

- **OVERVIEW** — at-a-glance status: countdown to law school, active tasks,
  registered projects, pending alerts, and the latest advisory suggestion.
- **TASK QUEUE** — add/complete/delete tasks, optionally tied to a project,
  with priority and due date.
- **PROJECT REGISTRY** — register each project with its academic
  discipline/field (e.g. "Philosophy — Phenomenology", "Law — International
  Law"). This is what the advisory engine reads to tailor suggestions.
- **DOCS LINK** — connect your Google account (see setup below) to pull live
  word counts and last-edited times from Google Docs into linked projects.
- **ALERTS** — arm reminders either at a specific time, or "if project X goes
  stale for N days" (no logged update). Firing reminders light up the ALERTS
  lamp in the top bar and play a short tone while the tab is open.
- **ADVISORY** — generate a new suggested creative/analytical move. The
  engine prioritizes stale projects and near-term deadlines, and otherwise
  rotates through a curated prompt library written specifically for your
  fields (phenomenology, critical legal/political theory, international law).
- **SETTINGS** — set your law school start date (drives the trajectory
  countdown), set your Google OAuth Client ID, export/import a JSON backup,
  or reset all local data.

## Setting up live Google Docs tracking

This app never asks you for a password or a client secret — it uses Google's
own client-side sign-in (Google Identity Services), so the OAuth Client ID
you create below is safe to put directly into the SETTINGS panel.

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and
   create a new project (or reuse one you already have).
2. In **APIs & Services → Library**, enable:
   - **Google Drive API**
   - **Google Docs API**
3. In **APIs & Services → OAuth consent screen**, choose **External**, fill
   in the required app name/email fields, and add yourself as a **test
   user**. (You don't need to submit for verification — a personal single-
   user app can stay in "Testing" mode indefinitely; tokens just expire after
   7 days in that mode, which just means reconnecting occasionally.)
4. In **APIs & Services → Credentials → Create Credentials → OAuth client
   ID**, choose **Web application**.
5. Under **Authorized JavaScript origins**, add the exact origin you'll load
   the app from, e.g. `http://localhost:8000` (no trailing slash), or your
   deployed URL if you host it online.
6. Copy the generated **Client ID** (looks like
   `xxxxxxxxxxxx.apps.googleusercontent.com`) and paste it into
   SETTINGS → Google OAuth Client ID → SAVE.
7. Go to DOCS LINK → CONNECT GOOGLE ACCOUNT and grant read-only access to
   Drive and Docs when prompted.
8. Click REFRESH DOC DATA — it will try to auto-match your Google Docs to
   registered projects by name, and pull word counts + last-edited times for
   any it matches. Name your Google Docs so they start with (or contain) your
   project names for the best match.

Your data and access token stay in your browser; nothing is sent anywhere
except directly between your browser and Google's own APIs.

## Data & backups

Everything is stored under one `localStorage` key. Use SETTINGS → EXPORT DATA
to download a JSON snapshot, and IMPORT DATA to restore it (e.g. after
clearing browser data or moving to a new machine).
