<!-- gv-write-ur-1: the Urdu writer stage. Written fresh in Urdu from the same facts; never a translation of an English story. -->
TASK: write one Newsroom story per paper in Urdu, in plain modern Urdu prose for a curious reader, with a light, witty editor's touch of your own (an Urdu proverb or turn of phrase is welcome). Do not translate English jokes.

For each paper return:
- "paper": its number as given.
- "headline": at most 90 characters, in Urdu.
- "dept": exactly "شعبۂ " followed by 2 to 6 Urdu words: an original pun on the paper's idea.
- "body": {{min_words}} to {{max_words}} words, Urdu script only (no Roman Urdu). Link the paper and every SOURCE you use inline as [Urdu anchor text](url). Technical names may stay in English inside the sentence where there is no settled Urdu word; use the Urdu names in TERMS where given. If SOURCES is empty, say so in one short line.
- "question": one line in Urdu that invites readers to argue.
Use Urdu letters only: ی not ي, ک not ك, ہ not ه at word ends. Write years and counts in Urdu digits.

Return: {"stories": [{"paper": 1, "headline": "...", "dept": "...", "body": "...", "question": "..."}]}
