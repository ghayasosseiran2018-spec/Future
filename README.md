# OVERWATCH — Personal Command Panel

A retro-futurist command console for one mission: a JD starting this
September → practicing international lawyer → PhD in philosophy
(phenomenology and critical political/legal thought of vitality, time, and
love). It tracks tasks, projects (tagged by academic field), Google Docs
progress, reminders, a real knowledge base on that exact trajectory, and
JARVIS — a live, voice-capable conversational assistant that can actually
reorganize your schedule rather than just describe what you should do.

No backend, no build step — static HTML/CSS/JS. All your data (tasks,
projects, reminders, settings, conversation log) lives in your browser's
`localStorage`, on your machine only. JARVIS talks directly to Anthropic's
API from your browser using your own API key — no data passes through any
third party.

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

## Hosting it online (GitHub Pages)

This repo is public, so GitHub Pages is free. A workflow
(`.github/workflows/deploy-pages.yml`) is already set up to publish it
automatically on every push to `main`. One manual, one-time click switches
it on — GitHub doesn't let a workflow file do this part by itself:

1. On GitHub, open this repo and click **Settings** (top of the repo, not
   your account settings).
2. In the left sidebar, click **Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. That's it. Within a minute or two, refresh that same Settings → Pages
   page — your live URL appears at the top, typically
   `https://ghayasosseiran2018-spec.github.io/Future/`. Bookmark it.

If a push hasn't happened since you enabled it, go to the **Actions** tab
and re-run the "Deploy OVERWATCH to GitHub Pages" workflow to kick off the
first deploy.

Being public means the code (not your data — your tasks, conversations, and
API keys all stay only in your own browser, never in this repo) is visible
to anyone with the link. If you'd rather that not be the case, you can make
the repo private again from **Settings → General**, scroll to the bottom
**Danger Zone → Change repository visibility** — but note Pages then
requires a paid GitHub plan, so you'd want to use Vercel instead (free,
works with private repos): sign up at vercel.com with your GitHub account,
**Add New → Project**, import `Future`, click **Deploy** with defaults.

Once it's live, add that URL as an authorized JavaScript origin in the
Google Cloud step below if you want Docs Link to work from the hosted
version too (it's origin-specific — localhost and the hosted URL each need
their own entry, or their own Client ID).

## Using the panel

- **JARVIS** — the home tab. A rotating constellation sphere (the "mind")
  on the left, one node per unit of knowledge the panel holds; a live chat
  on the right. Type or use the mic; ask it to plan your week, talk through
  an idea, or reorganize your priorities — it can actually add/update tasks,
  projects, reminders, and trajectory progress as it talks, not just suggest.
  Use REQUEST CHECK-IN to have it proactively review your state on demand;
  it also does this automatically at most once every 6 hours. Replies are
  spoken in a British English voice when SPEAK REPLIES is on (your browser's
  built-in voices — quality/gender options vary by browser and OS), and the
  sphere visibly speeds up and pulses in time with speech, settling back to
  its idle rotation once JARVIS stops talking.
  Below the sphere is **LEARNED MEMORY**: durable facts, preferences, and
  patterns JARVIS has chosen to remember (it decides what's worth keeping via
  its own `update_memory` tool — corrections and recurring patterns, not
  routine task details). This is what survives a page reload even though the
  raw conversation history otherwise wouldn't; delete any note with ✕ if it's
  wrong or you'd rather it forget.
  JARVIS can also reconfigure the panel itself on request — edit or dismiss
  reminders (`update_reminder`/`delete_reminder`), push back the law school
  date, or turn her own voice off (`update_settings`), e.g. "turn your voice
  off" or "law school got pushed to October." Your Anthropic API key and
  model are the deliberate exception — those only ever change in SETTINGS,
  never through conversation.
  Once your Google account is connected (see DOCS LINK below), JARVIS can also
  call `list_google_docs` and `read_google_doc` mid-conversation — read-only,
  same as everywhere else in this app — so it can actually discuss or give
  feedback on a document's real content instead of guessing.
- **OVERVIEW** — at-a-glance status: countdown to law school, active tasks,
  registered projects, pending alerts, and the latest advisory suggestion.
- **TASK QUEUE** — add/complete/delete tasks, optionally tied to a project,
  with priority and due date.
- **CALENDAR** — every task with a due date, laid out on a month grid
  color-coded by priority; PREV/NEXT/TODAY to navigate, with tasks that have
  no due date listed separately below so nothing gets lost off-grid.
- **PROJECT REGISTRY** — register each project with its academic
  discipline/field (e.g. "Philosophy — Phenomenology", "Law — International
  Law"). JARVIS and the advisory engine both read this to tailor what they say.
- **KNOWLEDGE BASE** — the actual curated material JARVIS draws on: the 1L
  curriculum and international law on-ramps, international law career tracks,
  phenomenology's core figures and its resources on time and vitality,
  critical legal/political thought (including love as a political category),
  and what philosophy PhD admissions and funding actually look like.
- **DOCS LINK** — connect your Google account (see setup below) to pull live
  word counts and last-edited times from Google Docs into linked projects.
- **ALERTS** — arm reminders either at a specific time, or "if project X goes
  stale for N days" (no logged update). Firing reminders light up the ALERTS
  lamp in the top bar and play a short tone while the tab is open.
- **ADVISORY** — two sources feed this one feed: an offline, rule-based
  generator (GENERATE NEW MOVE, no API key needed), and every proactive
  JARVIS check-in (auto, at most once per 6 hours, or manually via REQUEST
  CHECK-IN on the JARVIS tab) — logged here automatically, tagged "JARVIS //"
  with a violet border, so her unprompted observations and suggestions have
  a permanent home you can browse instead of only living in the scrolling
  chat transcript. The latest entry from either source also shows on OVERVIEW.
- **SETTINGS** — set your law school start date (drives the trajectory
  countdown), your Anthropic API key + model (powers JARVIS), whether JARVIS
  speaks its replies aloud, your Google OAuth Client ID, export/import a JSON
  backup, or reset all local data.

## Setting up JARVIS (live conversation)

1. Go to [console.anthropic.com](https://console.anthropic.com/), sign in,
   and create an API key under **API Keys**.
2. Paste it into SETTINGS → Anthropic API key → SAVE. The model field
   defaults to `claude-sonnet-5`; change it there if you'd rather use a
   different model (see [Anthropic's model list](https://docs.claude.com/en/docs/about-claude/models)
   for current options — Haiku is cheaper/faster if you're chatting a lot).
3. Go to the JARVIS tab and start talking, by voice or by typing.

**Privacy & cost, read before pasting a key in:** this key is stored only in
your browser's local storage and is sent directly from your browser to
Anthropic's API on every message — nothing passes through any server of
ours. That also means usage is billed to your own Anthropic account like any
other API use, and the request headers make the browser call directly
(`anthropic-dangerous-direct-browser-access`), which is fine for a tool only
you run locally, but means **you should not deploy this app publicly with
your key already filled in** — anyone loading that page could spend your API
credits. Keep it local, or gate any public deployment behind your own auth.

**Voice**: mic input and spoken replies use your browser's built-in Web
Speech API (works out of the box in Chrome/Edge; Safari and Firefox support
varies). No extra setup, no extra cost — if it's not supported, JARVIS
quietly falls back to typing only.

## Setting up live Google Docs tracking

**This is read-only and cannot be otherwise.** The app requests exactly two
OAuth scopes — `drive.readonly` and `documents.readonly` — which let it list
your Google Docs and read their text/word counts. Google does not grant edit,
create, delete, or move permissions under those scopes; there is no code
path in this app that could touch your Drive even if it tried. Nothing
connects until you explicitly click CONNECT GOOGLE ACCOUNT in DOCS LINK, and
until then the app has no access to your Drive at all.

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

Everything (tasks, projects, reminders, settings, conversation log) is stored
under one `localStorage` key. Use SETTINGS → EXPORT DATA to download a JSON
snapshot, and IMPORT DATA to restore it (e.g. after clearing browser data or
moving to a new machine). Note that exporting includes your Anthropic API key
and Google Client ID in plain text if you've set them — treat backup files
like any other secret, and don't share them.
