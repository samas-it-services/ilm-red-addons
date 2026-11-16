# Fixtures

- `recorded/`: real replies from the coverage sources for the two sample papers (arXiv 2611.12869, the Platonic Representation Hypothesis paper, and 2611.12634, the quantization paper), recorded from Syed's Mac on 16 Nov 2026 at 14:05 PT, slimmed to the fields the gatherers read. Two are real failures kept on purpose: Google News answered with a "Sorry..." block page, and the Hacker News URL search returned near-miss arXiv numbers for both papers.
- `recorded/news-ok-prh.xml`: rebuilt from the successful Google News run earlier the same morning (see its header comment).
- `papers.json`: the two papers as the pipeline receives them (title, authors, abstract, ilm.red notes, terms from the knowledge graph).
- `replies/`: scripted model replies used by the end-to-end tests. They are the stories published in the 16 Nov sample, so the tests show the pipeline reproducing that sample.
