# Playtest brief — photo survey page (delivery 68d)

You are one of six independent playtesters. You play a web page the way a real
person on a phone would, on a throwaway LOCAL environment, following the paths
assigned to you, and you report what happened against what should happen.
Finding a real defect is a success. Reporting "all fine" without evidence is not.

## What is under test

A standalone page, "pesquisa por foto": entry screen with a "Começar" button,
four voting screens with four cards each (one tap per screen), a final screen
with the person's four picks (one tap), a confirmation screen, and a
"registered" screen. Until the person confirms, nothing about their choices is
sent to the server; they can go back and change. After confirming, the answer
is final: one answer per player per survey, never changeable.

Specification to read first (read-only):
- `<repositório>/stages/68_photo_survey_politics/CONTEXT.md`
  (sections "O formato desta etapa", "Regras", acceptance criteria for 68c/68d)
- `<repositório>/stages/68_photo_survey_politics/plans/68c-tela.md`
  (decision table and the table "resposta do servidor → tela")
Source, if you need to understand a behaviour (do not edit):
`app/src/photo-survey-page.js`, `app/src/photo-survey-flow.js`,
`app/src/photo-survey.css`, `back/src/photo-survey-store.js`.

## The environment (all on 127.0.0.1, nothing else exists for you)

You are agent number N (given in your assignment). You own:
- Two "networks" (two origins serving the same built page):
  `http://127.0.0.1:420N/pesquisa.html` (network A) and
  `http://127.0.0.1:421N/pesquisa.html` (network B).
  The server sees each origin as a different household network.
- One API and one PostgreSQL database of your own. The page calls the API at
  `http://127.0.0.1:3100` (another origin, with CORS, as in production). You
  never need to call the API yourself; the page does.
- Database for evidence, READ-ONLY (SELECT only):
  `postgresql://postgres@127.0.0.1:54329/pm68d_N`
  Use `pg` from `<repositório>/back/node_modules/pg/lib/index.js`.
  Useful tables: `anonymous_players`, `photo_survey_draws` (survey_id,
  player_id, shown_ids, issued_at), `photo_survey_responses` (survey_id,
  player_id, answer_id, shown_ids, pick_ids, champion_id, responded_at),
  and the old game's `votes`, `ranking_stats`, `player_stats` (these must not
  change because of the survey, except that creating a player seeds 160
  `player_stats` rows at the initial rating).
- Server rule you must plan around: at most 3 NEW anonymous players per network
  per day. A player is created when someone taps "Começar" with no identity in
  the browser. A fresh browser context = a new person. So you have 3 new people
  on network A and 3 on network B. Do not waste them; plan before you tap.
- Identity lives in `localStorage["polimatch:v3:recovery-key"]`; the survey
  progress in `localStorage["polimatch:photo-survey:v1"]`.
- Control switch, ONLY for the agents whose assignment says so:
  `GET http://127.0.0.1:3100/__controle?rede=<port>&modo=<mode>` with modes
  `aberta` (normal), `fora` (API connection dropped), `502` (a reverse proxy
  answering 502 with no API behind), `fechada` (survey closed; only agent 6).
  Without parameters it lists the current modes. Only switch YOUR two ports,
  and leave both on `aberta` when you finish.

## How to drive the page

Write your own scripts with Playwright, under your own folder only:
`<pasta de trabalho>/agente-N/`

```js
import { homedir } from "node:os";
import { chromium, webkit } from "<repositório>/app/node_modules/playwright/index.mjs";
const wk = await webkit.launch();
// Chromium on the machine used for the round only opened by explicit path (macOS,
// Playwright cache revision 1187); elsewhere, `chromium.launch()` is enough:
const cr = await chromium.launch({ executablePath: `${homedir()}/Library/Caches/ms-playwright/chromium_headless_shell-1187/chrome-mac/headless_shell` });
const context = await wk.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
```

- Use a phone viewport (390×844 by default; also try 360×640 at least once).
- Act like a person: real clicks (never `force: true`, never dispatch synthetic
  events, never call the page's functions), wait for what a person would see.
  The cards only accept a tap after the four images have loaded:
  `.ps-grid[data-ready="true"] button[data-card]:not([disabled])`.
  The current step is the text of `#ps-step`; the title is `#ps-title`;
  messages appear in `#ps-notice`.
- Record every non-GET request the page makes (`page.on("request")`) and every
  page error (`page.on("pageerror")`) and console error.
- Take a screenshot at every important moment, then LOOK at it with the Read
  tool: judge it as a person would (anything cut off, overlapping, unreadable,
  misleading, a button hidden, text that does not match what happened).
- Use both engines where your quota of people allows; say which engine each
  observation comes from.

## Hard rules

- READ-ONLY on the repository `<repositório>`: no edits, no
  git commands that change state, no builds, no installs.
- Write only inside your own `agente-N` folder.
- Talk only to 127.0.0.1. Never open or request any other host. Never touch
  production (polimatch.com.br) in any way.
- Do not start, stop or restart any server or database. Do not use ports or
  databases of other agents. Only SELECT in your database.
- If the environment itself is broken (a port not answering, CORS failing on
  the first request), stop and report that instead of working around it.
- Do not spawn other agents.

## What to report (in English; quote the page's Portuguese texts verbatim)

For EACH path assigned to you:
- `path`: its name; `engine`; `viewport`.
- `steps`: what you did, in order, briefly.
- `expected` vs `observed`.
- `result`: `passed` | `failed` | `partial`.
- `evidence`: screenshot file paths, the non-GET requests seen, and the DB
  numbers before/after (players, draws, responses; `votes` count and a digest
  of `ranking_stats`, which must not change).
- `defects`: each with severity (blocker / should fix / minor), exact
  reproduction steps, and what you saw. Distinguish a defect you reproduced
  from a suspicion you could not confirm.
- `product notes`: things that are not bugs but would confuse or annoy a real
  person (wording, missing feedback, waiting with no sign of progress).
End with a one-paragraph verdict and a list of anything you could not test and
why. Be precise and brief; no filler.
