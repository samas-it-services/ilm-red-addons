<!-- gv-skeptic-1: the Skeptic seat. House only. -->
TASK: check each story against its PAPER and SOURCES. List every factual claim (names, numbers, findings, who said what, how a source is described) and mark it supported, unsupported or contradicted, naming where it is supported (P for the paper, S1, S2 ... for sources). Check that each link's anchor text fairly describes that link, and that stance words ("critics", "one commenter") match the source.
Verdict "pass" when nothing is unsupported or contradicted; otherwise "fail" with the smallest wording fix for each problem as an exact {"from": "...", "to": "..."} pair taken from the story.

Return: {"verdicts": [{"paper": 1, "verdict": "pass", "claims": [{"text": "...", "status": "supported", "where": "S2"}], "fixes": []}]}
