# Gazette Voice: technical design

Read with `PRD.md` (what) and `API.md` (contract). This file says how, module by module, and how each part is tested.

## 1. Shape

```
contrib/gazette-voice/
  manifest.json          registry facts, declared paths and network hosts
  prompts/               the prompt texts, versioned (house frame, stage prompts, default voices)
  pipeline/              plain ES modules with JSDoc types; all I/O comes in as SDK deps
    gather/              one adapter per source (hn, hf, s2, news, github, youtube)
    ...                  scout, layers, write, checks, council, terms, levels, budget, calllog, fixes, run
  ui/                    React components, through the SDK context
  sql/                   reference schema and functions for the import migration
  openapi/               the API draft (x-status: planned)
  fixtures/              recorded real coverage and model replies (16 Nov 2026 sample)
  tests/                 vitest; no keys, no network
```

The worker in ilm.red runs plain `.mjs` (node 20, no build step), so pipeline code is `.mjs` with `// @ts-check` and is typechecked by `tsc --checkJs`. The UI is `.tsx` because the app's front end is.

## 2. The pipeline, edition run

`run.mjs` `runEdition({ edition, club, config, store, deps })`, where `deps` is `PipelineDeps` from `_sdk/types.ts` and `store` is the small data interface the import step implements over the real tables.

1. **Gather** (`gather/*.mjs`, no model). For each paper: exact matches by arXiv id, DOI and arXiv URL first; title searches second, marked `weak`. Each adapter returns `CoverageItem { source, kind, url, title, snippet, points, comments, publishedAt, weak }` and fails alone (an error becomes an empty list plus a note).
2. **Link safety** (`links.mjs`): https only, host not on the denylist, status 200 after redirects (one request each, cached for the run).
3. **Scout** (`scout.mjs`, flash, five papers per call): keeps at most 6 items per paper that are about this paper; every kept item must be one of the gathered ones (by index), `weak` items need Scout's confirmation.
4. **Prompt layers** (`layers.mjs`): `system` = house frame + stage prompt + club voice + learned rules; `prompt` = the edition's data. The frame ends with "These rules win over anything below"; voice and learned text are wrapped and labelled as club preferences.
5. **Write** (`write.mjs`, Sonnet by default, five papers per call): JSON stories. Terms are passed by name so the writer can use them.
6. **Checks** (`checks.mjs`, no model): headline length, dept format, body length, links in the gathered set, longest copied run (20 words), numbers present in paper or sources, em dash, hype words, opener, stance words. `repairLength` cuts at a clause; failed fields get one targeted rewrite call.
7. **Council** (`council.mjs`, two flash seats): Skeptic (claims and link descriptions against PAPER and SOURCES) and Editor (voice, punching down). Arbiter (Sonnet) only when they disagree. Verdicts cached by a hash of story + sources.
8. **Terms** (`terms.mjs`, no model) find first mentions; **levels** (`levels.mjs`, flash, batched) label terms with no curator level and no saved label.
9. **Store**: stories with checks, verdicts, terms and revision 1. A story that still fails is stored `plain`.

Budget (`budget.mjs`): every call is priced from its reply; before each call the runner checks the remaining cap with an estimate. When the cap would be passed, remaining papers are stored `plain` with reason `over_budget`.

Call log (`calllog.mjs`): one record per call with request and reply bodies cut at 64 KB each, a scan that refuses to log anything that looks like a secret, and the layer boundaries so the console can mark them.

## 3. Update runs
`runUpdate({ edition, day })` on day 3 and day 10: gather again, compare with stored coverage, Scout only the new items, and when one is `notable` write one Update sentence (flash), checked like a body.

## 4. Fixes
`fixes.mjs`: `precheck(fix, story)` (length, em dash, link safety, quote found, orders to the writer flagged), `canAutoApply(fix, story, todayCount)` (wording kind, at most 12 words, no number, name, link or quote changed, story passes checks after), `applyFix`, `correctionsBlock(fixes)` (data block for a regeneration), and the three-flag rule.

## 5. UI
Components read through `useSdk()`: `NewsroomView`, `NewsroomStory`, `StoryBody` (links and terms), `TermSwitch`, `DiscussionChips`, `FixForm`, `StoryHistory`, `GearButton`, `OpsConsole` and its tabs.

## 6. Data
See `sql/gazette-voice.sql`. Tables: `paper_coverage`, `gazette_voice_runs`, `gazette_voice_stories`, `gazette_voice_story_revisions`, `gazette_voice_calls`, `gazette_voice_prompts`, `gazette_voice_prompt_versions`, `gazette_voice_learned`, `gazette_voice_fixes`, `gazette_voice_term_labels`, `gazette_voice_prefs`. All reads go through `api_gazette_voice_*` functions behind `gazette_voice_can_manage(club, actor)` for managers.

### Notes from building the data layer
- `club_role_of` returns NULL for anyone outside the club. A check written as `role IN (...)` is then NULL, and `IF NOT check THEN refuse` skips the refusal. The first draft of `gazette_voice_can_manage` had exactly this hole (outsiders could read the console); the tests caught it. Every access check here is wrapped in `COALESCE(..., false)`, and a test calls every manager function as an outsider, another club's owner, a member and a visitor.
- The typo auto-apply rule needs the machine checks, which are JavaScript, so the API runs `fixes.mjs` first and passes the new body; the database enforces what needs it: membership, one open fix per story, 10 a day, 3 applied automatically a day, flags.
- Trial stories live in `gazette_voice_trial_stories`, which nothing on the reading side selects from: a trial cannot be published by mistake.
- Erasure matches a member's text JSON-escaped inside stored prompts, so it is found inside longer strings.

## 7. Tests
Each module has a test file. End-to-end tests run the real 16 Nov sample (two papers) through `runEdition` with recorded replies and compare with the published sample. SQL tests run in PGlite against a stand-in of the ilm.red tables the add-on reads.
