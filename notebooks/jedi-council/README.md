# The Jedi Council, in a notebook

A runnable companion to the ilm.red engineering posts on the AI council that keeps a
machine-built knowledge graph honest.

- **Part 1** — [Meet the AI Jedi Council](https://ilm.red/blog/meet-the-ai-jedi-council-keeping-a-machine-built-knowledge-graph-honest) — five lenses, weighted-mean consensus, homonyms. *This notebook.*
- **Part 2** — [Teaching AI to read Urdu aloud](https://ilm.red/blog/the-jedi-council-part-2-teaching-ai-to-read-urdu-aloud) — the same architecture with one model per seat and a quorum that escalates.

## Run it

```bash
jupyter lab jedi_council_lab.ipynb
```

Or open it in [Colab](https://colab.research.google.com/github/samas-it-services/ilm-red-addons/blob/master/notebooks/jedi-council/jedi_council_lab.ipynb).

**No API keys required.** The default provider is a deterministic offline mock, so every cell
runs as-is and the output is reproducible. Standard library only — nothing to install.

To score with a real model instead, export one key before launching. The same code paths are
used either way:

```bash
export DEEPSEEK_API_KEY=...     # or OPENAI_API_KEY
export CLASSIFY_MODEL=deepseek-chat   # optional override
```

## What is in it

| Section | Contents |
|---|---|
| 1 · Configuration | The five seats as a dataclass — weight, temperature, severity — mirroring `public.ai_council_members`, with the rubrics verbatim from `public.prompt_registry` |
| 2 · Providers | The offline mock and a stdlib HTTP provider (DeepSeek / OpenAI, strict JSON mode, 4 retries) |
| 3 · Convening | One call per seat, then `Σ(wᵢ·sᵢ)/Σwᵢ` — plus the disagreement spread a mean throws away |
| 4 · Fixtures | Seven (term, club) pairs including `diffusion` under both an AI and a chemistry club |
| 5 · Homonyms | Separation by meaning-in-context rather than spelling, with a stdlib hashing vectoriser |
| 6 · Experiments | Re-weighting a lens · removing a seat · temperature vs repeatability · severity |
| 7 · Mapping | Which notebook object corresponds to which production table or script |

## The dials, and what each one is for

| Dial | Default | What it does |
|---|---|---|
| `weight` | 1.0 | Its share of the weighted mean. A uniform prior is the honest starting point; departures should be deliberate and recorded. |
| `temperature` | 0.2 | Sampling variance. Classification is pinned low so the same term gets the same verdict tomorrow. |
| `severity` | 0.5 | Grading disposition, sent to the seat as an instruction. Raise it for a lens that likes everything. |
| `enabled` | true | Whether the seat is convened at all. Experiment 6b measures what each seat was actually contributing. |

## One honest caveat

This notebook makes **one model call per seat**. The production knowledge-graph council
currently runs the five lenses as five personas inside a *single* call — cheaper, faster, and
deterministic enough to classify thousands of terms, at the cost of five personas sharing one
model's blind spots. The genuinely per-seat, multi-model path is live on the Urdu pipeline
(Part 2).

So running this with a real key is not a simulation of production. It is the *upgrade*, and
the numbers it prints are the evidence for whether the extra four calls earn their cost on
your data.

---

Generated from the private ilm.red monorepo — **do not edit here**, changes belong in the
source repo and will be overwritten. Licensed Apache-2.0.
