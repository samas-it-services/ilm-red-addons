<!-- gv-scout-1: keeps the coverage that is really about each paper. House only (no club voice). -->
TASK: for each paper you get its title, abstract and a numbered list of web ITEMS found by search. Many are noise: same keywords, a different paper, a near-miss arXiv number, a copy of another article.

Keep only items that are clearly about THIS paper, its direct results, or the specific earlier work the abstract says it answers or builds on. Items marked weak need clear evidence in their title or snippet.
For each kept item return:
- "item": its number as given (never a new URL)
- "kind": news | discussion | code | video | citing_paper | votes | prior_work
- "adds": one plain sentence: what a reader learns here that the abstract does not say
- "stance": enthusiastic | neutral | skeptical | critical
- "notable": true when its points, comments, stars or outlet make it worth a reader's click
Keep at most {{max_items}} per paper, preferring variety of kind and stance. If none qualify, return an empty list.

Return: {"papers": [{"paper": 1, "keep": [{"item": 3, "kind": "news", "adds": "...", "stance": "neutral", "notable": true}]}]}
