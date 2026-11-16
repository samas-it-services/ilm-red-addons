# Gazette Voice: API contract (planned)

Every operation below is **planned**: it is served only after the add-on is imported into ilm.red. The machine-readable draft is `../openapi/gazette-voice.yaml` (`x-status: planned`). Paths are under `https://api.ilm.red/v1`.

Conventions follow the rest of the ilm.red API: JSON, problem details for errors (`type` is a slug), cursors for lists, `Idempotency-Key` on anything that spends, `?estimate=true` for a price without spending.

**Manager** means the club's owner, an admin or a moderator, or a super admin.

## Reading

| Operation | Who | What |
|---|---|---|
| `GET /clubs/{club}/gazette` (existing) | anyone who can see the club | Each paper gains an additive `newsroom` object when the add-on is on: `story_id`, `lang`, `headline`, `dept`, `byline`, `body` (with inline links as `[text](url)`), `question`, `links[]`, `chips[]`, `terms[]` (`name`, `slug`, `level`, `start`, `end`, `hook`), `update` (text or null), `state` (`ready` or `plain`), `revision`. |
| `GET /gazette/stories/{story_id}/history` | anyone who can see the club | Versions newest first: `revision`, `at`, `kind` (`written`, `repaired`, `checked`, `fix_applied`, `regenerated`, `update`, `undo`), `summary`, `who` (`desk`, `member`, `manager`, `automatic`), `undoable` (managers only). |
| `GET /me/gazette-voice/prefs` / `PUT` | signed-in member | `{ highlight: boolean, levels: ["easy","advanced","expert"] }`. Visitors keep this in the browser. |

## Member fixes

`POST /gazette/stories/{story_id}/fixes`

```json
{ "kind": "wording", "quote": "trail far behind", "start": 812, "end": 828,
  "replacement": "lag well behind", "reason": "repeats a sound" }
```

`kind`: `fact`, `link`, `tone`, `wording`, `term_level`, `wrong_term`, `other`.

Reply `201`: `{ "fix_id": "...", "state": "applied" | "waiting", "revision": 5 }`.

Refusals: `validation_failed` (`too_long`, `em_dash`, `bad_link`, `quote_not_found`), `one_open_fix_per_story`, `daily_limit`, `not_signed_in`.

## Managers

| Operation | What |
|---|---|
| `GET /clubs/{club}/gazette/ops/summary` | Spend this edition and month against the cap, calls, median time, stories ready and plain, open fixes. |
| `GET /clubs/{club}/gazette/ops/runs?cursor=` | Runs newest first: `run_id`, `kind` (`edition`, `trial`, `regenerate`, `update`), `week`, `lang`, `stages[]`, `stories`, `calls`, `cost_usd`, `status`. |
| `GET /clubs/{club}/gazette/ops/runs/{run_id}` | One run with its stories and calls. |
| `GET /clubs/{club}/gazette/ops/calls?run=&stage=&story=&status=&cursor=` | Calls without bodies. |
| `GET /clubs/{club}/gazette/ops/calls/{call_id}` | One call with `request` (`layers[]`: `house`, `voice`, `learned`, `data`, each with text and version), `reply`, `checks`, `verdicts`, tokens, cost, time. Bodies older than 90 days are read from storage. |
| `GET /clubs/{club}/gazette/prompts` | Stages and languages with the default voice version and learned rule count. |
| `GET /clubs/{club}/gazette/prompts/{stage}/{lang}` | House frame (read only), voice versions, learned rules. Stages with a voice: `write`, `update`, `editor`. |
| `POST /clubs/{club}/gazette/prompts/{stage}/{lang}/versions` | `{ voice, note }`. 20 to 6,000 characters. Becomes a new version, not yet default. |
| `POST /clubs/{club}/gazette/prompts/{stage}/{lang}/default` | `{ version }`. Also how a rollback is done. |
| `POST /clubs/{club}/gazette/prompts/{stage}/{lang}/try?estimate=` | `{ version, paper_ids (1 to 3), budget_usd }`, `Idempotency-Key`. Returns `{ run_id, estimate_usd }`. Trial stories are never published. |
| `GET /clubs/{club}/gazette/fixes?state=&cursor=` | The queue (`state=open` is waiting plus today's automatic ones): `fix_id`, `story_id`, `headline`, kind, quote, replacement, reason, member name, `check` (`flagged`, `problems`, `supported`), state, `auto`. |
| `POST /gazette/fixes/{fix_id}/action` | `{ action, reply?, rule?, budget_usd? }`. `action`: `apply`, `regenerate` (spends, priced with `?estimate=true`), `learn` (with `rule`, one sentence), `reject`, `undo`. |
| `PATCH /clubs/{club}/gazette/learned/{rule_id}` | `{ text?, pinned?, removed? }`. |
| `POST /gazette/stories/{story_id}/undo` | `{ revision }`: back to that revision (a new revision records the undo). |
| `PUT /clubs/{club}/gazette/term-labels/{term_slug}` | `{ level }`: a manager's Gazette label for this club (never the shared term level). |
| `PATCH /clubs/{club}/addons` (existing) | The Settings tab saves `{ slug: "gazette-voice", config }` through the app's existing add-on settings operation. Only the club owner and admins may; moderators get `not_club_admin`. |

Refusals for managers: `not_club_manager`, `over_budget`, `daily_regeneration_limit`, `validation_failed`, `not_found`.

## Connector tool

Full definition: [`CONNECTOR.md`](CONNECTOR.md).


`gazette_suggest_fix` (scope `library:read` plus signed in): `{ club, paper (number, title or story_id), kind, quote?, replacement, reason? }`. Same rules and replies as the website. Returns a one-line result for the assistant to read back: applied, waiting for the club's managers, or why not.
