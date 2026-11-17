# Gazette Voice: connector tool (planned)

One new tool for members in the ilm.red connector (Claude, ChatGPT and other assistants). It calls `POST /gazette/stories/{story_id}/fixes` with the same rules, limits and replies as the website. No console tools in this release: each new tool can cost members a permission prompt, and managers use the website.

## `gazette_suggest_fix`

Suggest a fix to a Newsroom story in a club's Gazette. A small wording fix that changes no number, name, link or quote goes live straight away; anything else goes to the club's managers.

Scope: signed-in member (`library:read`). Annotations: not read-only, not destructive, idempotent per (story, member) while a fix is open.

Input schema:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["club", "paper", "kind", "replacement"],
  "properties": {
    "club": { "type": "string", "minLength": 2, "maxLength": 200, "description": "The club's web address or id, as for the gazette tool." },
    "paper": { "type": "string", "maxLength": 300, "description": "The paper's number in this week's Gazette, its title, or a story_id." },
    "week": { "type": "string", "pattern": "^\\d{4}-W\\d{2}$", "description": "An edition; omit for this week." },
    "lang": { "type": "string", "enum": ["en", "ur"], "description": "Which Newsroom story; default en." },
    "kind": { "type": "string", "enum": ["wording", "fact", "link", "tone", "term_level", "wrong_term", "other"] },
    "quote": { "type": "string", "maxLength": 500, "description": "The exact words to change, copied from the story." },
    "replacement": { "type": "string", "minLength": 1, "maxLength": 500 },
    "reason": { "type": "string", "maxLength": 500 }
  }
}
```

Reply (one line for the assistant to read back, plus structured content):

- `applied`: "Done: your fix is live in the AI Gazette's Newsroom story, version 5."
- `waiting`: "Sent to the club's managers. You will get their reply on ilm.red."
- refusals, in plain words: not signed in, not a member of the club, already one fix waiting on this story, 10 fixes today, the quote is not in the story, too long, a long dash in the text.

Example prompts: "Suggest a fix to the Plato story in the AI Gazette: change 'trail far behind' to 'lag well behind'." / "The quantization story in the AI club's Gazette names the wrong models; tell the managers it should be OLMo-2-7B."
