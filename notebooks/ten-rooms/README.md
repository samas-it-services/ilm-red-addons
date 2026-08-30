# Me and My Ten Rooms — notebook

A runnable companion to the ilm.red post **"Me and my ten rooms."** Alma walked a corridor of ten
rooms, each one a philosophical position taken completely seriously. This notebook walks the same
corridor in code — each room is a tiny, honest simulation that breaks exactly the way the room did:

1. **The doorman (Nihilism)** — a value function that returns 0 everywhere, and the "decision" an optimizer makes with it.
2. **The tortoise in the rain (Stoicism)** — the dichotomy of control, measured over 1,000 random days.
3. **The silk dressing gown (Hedonism)** — the hedonic treadmill as a convergent series the appetite never notices.
4. **The tea party (Solipsism)** — two byte-identical observation streams, and why no inside experiment can split them.
5. **The grinning cat (Relativism)** — an oracle that always agrees, worth exactly 0.0 bits.
6. **The measuring mole (Empiricism)** — 999 perfect mornings, Russell's chicken, and the rule that was never in the data.
7. **The spider's web (Rationalism)** — three flawless deductions hanging from three different axioms.
8. **The clockwork courtier (Determinism)** — a mechanism that is fully determined and practically unpredictable.
9. **The Queen's spreadsheet (Utilitarianism)** — a felicific argmax, caught harvesting its smallest row.
10. **The chair, the note, and the choice (Existentialism)** — the one room where the objective function is yours to write.

## Run it

Opens in [Google Colab](https://colab.research.google.com/github/samas-it-services/ilm-red-addons/blob/master/notebooks/ten-rooms/ten_rooms_lab.ipynb)
and runs top to bottom. **Standard library only** — no pip installs, no API keys, no accounts. Locally:

```bash
jupyter notebook ten_rooms_lab.ipynb
```

Every number the notebook claims is printed by the cell that claims it. Change the seeds and the
constants; the shapes survive, which is the point.
