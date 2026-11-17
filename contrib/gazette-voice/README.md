# Gazette Voice

A Newsroom view for a club's Gazette on [ilm.red](https://ilm.red): each paper written up in a lively news-site voice that links what the press, Hacker News, Hugging Face and code repositories said about it, with terms highlighted by level, member fixes, and an AI ops console behind a gear icon for the club's managers.

- What and why: [`docs/PRD.md`](docs/PRD.md)
- How: [`docs/TDD.md`](docs/TDD.md)
- API (planned): [`docs/API.md`](docs/API.md), [`openapi/gazette-voice.yaml`](openapi/gazette-voice.yaml)
- Things to try: [`docs/TEST-LIST.md`](docs/TEST-LIST.md)

| field | value |
|---|---|
| slug | `gazette-voice` |
| entry point | `GazetteVoiceAddon` |
| placement | `decoration` (adds the Newsroom view to the existing Gazette) |
| category | `engagement` |
| built-in | no (on per club) |

Status: in review. Nothing here runs on ilm.red until it is imported (see `../README.md`).
