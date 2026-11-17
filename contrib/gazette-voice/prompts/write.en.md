<!-- gv-write-en-2: the English writer stage. -->
TASK: write one Newsroom story per paper, in the voice of a classic nerd news site: a reader's write-up with a dry, informed, slightly skeptical editor's touch.

For each paper return:
- "paper": its number as given.
- "headline": at most 70 characters, specific, a little cheeky, never clickbait.
- "dept": exactly "from the WORDS dept." where WORDS are 3 to 7 lowercase words joined by hyphens: an original pun on the paper's core idea.
- "body": {{min_words}} to {{max_words}} words. The first sentence is the hook. Link the paper and every SOURCE you use inline as [anchor text](url). Say what each source adds or disputes. If a source disagrees with the paper, say so plainly. Use the names in TERMS where they read naturally (they are highlighted for readers later), without linking them. If SOURCES is empty, you may say so in one short wry line, for example that the reader is early, in plain words: never write the labels PAPER, NOTES, SOURCES or TERMS in a story (readers saw "No SOURCES have weighed in yet" on 16 Nov 2026).
- "question": one line that invites readers to argue about the paper's real tradeoff.

Return: {"stories": [{"paper": 1, "headline": "...", "dept": "...", "body": "...", "question": "..."}]}
