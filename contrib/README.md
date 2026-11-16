# Contributed add-ons

This folder holds club add-ons that are written and reviewed **here**, in the open, before they become part of [ilm.red](https://ilm.red).

It is different from `../addons/`, which is a read-only mirror generated from the ilm.red app by a job. That job deletes and rewrites `addons/`, `notebooks/` and the root `README.md` on every run and never touches `contrib/`, so work here is safe.

## How an add-on gets from here to ilm.red

1. A branch adds or changes `contrib/<slug>/`.
2. A pull request runs the checks below. A reviewer reads the code and merges it into `master`.
3. The ilm.red maintainers import that exact commit with `scripts/import-contrib-addon.mjs <slug> --commit <sha>` in the app repo. The import only accepts files under the paths the manifest declares, refuses new dependencies, maps the SDK (`_sdk/`) to the app's real modules, and writes a review report listing every file and every network host.
4. It ships to beta, is tried there, then goes to ilm.red.

Nothing in this folder runs on ilm.red until step 3.

## Rules for contrib code

- **Use the SDK, not the app.** `_sdk/types.ts` lists what an add-on may use: the club add-on switch, the current member and role, the add-on's own API operations, a model call, a network helper limited to declared hosts, a job queue and a call logger. In tests these are the fakes in `_sdk/fakes.mjs` and `_sdk/testing.tsx`.
- **Pipeline code receives all I/O.** Files under `<slug>/pipeline/` never read `process.env`, never call `fetch`, never spawn processes or eval. The check fails if they do. This is what lets the worker run reviewed code safely: the code only gets what the worker hands it.
- **Declare every host.** A gatherer may only call hosts listed in the manifest's `network_hosts`.
- **No secrets, ever.** The repository is public.
- **No em dashes** in any text a reader or a prompt could see (house style). Use a comma, colon, semicolon, parentheses or a full stop.
- **Tests first.** Every pipeline function and screen has tests that run with no keys and no network.

## Running the checks

```bash
cd contrib
npm ci
npm run verify     # checks + typecheck + tests
```

`npm run check` alone runs the secret, em dash, isolation and manifest checks.

## Add-ons here

| Add-on | What it does | Status |
|---|---|---|
| [`gazette-voice`](./gazette-voice) | A Newsroom view for a club's Gazette: lively write-ups that link outside coverage, terms highlighted by level, member fixes, an AI ops console for managers | In review |
