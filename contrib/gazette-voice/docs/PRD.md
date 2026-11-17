# Gazette Voice: product requirements

Status: in review (contrib branch `contrib/gazette-voice`, November 2026). Owner: Syed A Bilgrami. Mockup: `docs/design/mockups/2026-11-16-gazette-voice/` in the ilm.red app repo.

## Why

A club's Gazette lists the week's papers with plain summaries. Readers asked for something with more life: a write-up that reads like a good nerd news site, tells you why the paper matters, what it is arguing with, and where people are already talking about it. Club managers want to tune the voice, see what the AI did and what it cost, and fix mistakes; members want to point out mistakes.

## Who

- **Readers** (members and visitors) of a club's Gazette, in English or Urdu.
- **Members** who spot something wrong.
- **Managers**: the club's owner, admins and moderators.
- **Super admins** of ilm.red.

## What it does

### F1. Newsroom view
- A third Gazette view, **Newsroom**, beside Easy and Expert. In clubs with the add-on on, it opens first. Easy and Expert are unchanged.
- Each paper gets a story: a headline (at most 70 characters), a "from the ... dept." line (an original pun), a byline "Posted by the {Masthead} desk", a 90 to 160 word body with inline links, a closing question, and discussion chips (real counts that link out).
- The body links the paper and what outside sources said: news, Hacker News threads, Hugging Face, code, citing papers, videos. Every name, number and claim comes from the paper, ilm.red's notes or those sources.
- A paper with no coverage yet says so in one line.
- On day 3 and day 10 after publishing, coverage is checked again; a notable new item adds one "Update:" sentence with its link.
- A story that fails its checks shows the paper's Easy story instead, labelled plainly.

### F2. Languages
English, and Urdu written fresh in its own voice from the same facts (not translated jokes), right to left. Luganda keeps Easy and Expert.

### F3. Term highlights
- Terms from the paper's knowledge-graph entries are highlighted at their first mention, each labelled **Easy**, **Advanced** or **Expert**, and each links to its term page (`/book-clubs/{club}/terms/{slug}`).
- A "Highlight terms" switch turns them all off (plain text, not links); Easy, Advanced and Expert buttons hide one level at a time. The choice is remembered per member, or per browser for visitors.
- Hover or keyboard focus shows the term's one-line explainer.
- Levels: a curator's level wins (1 is Easy, 2 and 3 Advanced, 4 Expert). Otherwise a level step labels the term once for the Gazette and saves the label. **This label is Gazette-only; it never changes the shared term level** that the learning path uses.
- A highlighted term with no explainer gets the existing explainer job queued.

### F4. Suggest a fix
- Every story has "Suggest a fix" for signed-in members, on the website and through the ilm.red connector (`gazette_suggest_fix`).
- Kinds: wrong fact, wrong or broken link, tone or hurtful, wording or typo, wrong term level, not the right term, other. Up to 500 characters. One open fix per story per member, 10 a day per member.
- **Wording or typo fixes apply themselves** when they change at most 12 words in one place, change no number, name, link or quoted text, the story still passes every check afterwards, and the member has had no more than 3 applied that day. They are logged and can be undone.
- Everything else waits for a manager. The member gets the result and the manager's reply.
- When three different members (each in the club at least a week) flag a story as wrong fact or hurtful, it falls back to its Easy story until a manager acts.

### F5. Managers' AI ops console (the gear icon)
- A gear on the Gazette masthead, shown only to managers and super admins.
- **Overview**: spend this edition, this month, against the cap; calls, time, failures, fallbacks; open fixes.
- **Runs**: every edition run, trial, regeneration and update check, stage by stage with time and cost.
- **Calls**: every model call with the full prompt (marked by layer), the raw reply, checks, council verdicts, tokens, cost and time. Kept forever; bodies older than 90 days are fetched from storage on open.
- **Prompts**: each prompt is house frame (locked) + club voice (editable, versioned, per stage and language) + learned fixes (at most 10 rules, 1,500 characters per language). Managers edit the voice, compare versions, **Try** a version on up to 3 papers (price first, never published), make it default, roll back.
- **Fixes**: apply as written, regenerate with the fix (price first), also learn it as a rule, reject with a reply, undo.
- **Settings**: voice, sources, writer model, edition cap, Update checks, story length, daily regeneration limit.

### F6. History
Every story keeps every version with what changed, who and why. Managers can undo; everyone else can read it.

## Rules that never bend
- House rules beat any club voice or learned rule: only gathered links, no copying more than 20 words from any source, no em dashes, honest attribution ("one commenter on the thread", never "HN thinks"), no usernames, no jokes at people or groups, no investment advice in finance clubs.
- Nothing a member writes reaches a prompt without a manager's choice; even then it is data, and a factual correction is used only if the paper or the sources support it.
- Spending is house money, priced first in the console, capped per edition ($0.50 default) and per day for regenerations.

## Out of scope for this release
Reddit and X as sources; Luganda Newsroom; comments with Insightful/Funny moderation; assistant tools for the console.

## Success
- Syed judges 10 beta stories against their Easy versions and prefers Newsroom for most.
- Cost per English edition stays near $0.10 to $0.15; fallbacks under 1 in 10 stories.
- Outbound link clicks and Newsroom opens are counted from launch.
