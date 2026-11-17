// @ts-check
/** Test helpers: fixture loading and a network that serves the recorded 16 Nov replies. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fakeNet } from '../../_sdk/fakes.mjs';

export const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');
/** @param {string} rel */
export const fixtureText = (rel) => fs.readFileSync(path.join(FIX, rel), 'utf8');
/** @param {string} rel */
export const fixtureJson = (rel) => JSON.parse(fixtureText(rel));

/** @returns {{ club: any, week: string, papers: import('../pipeline/types.mjs').Paper[] }} */
export const samplePapers = () => fixtureJson('papers.json');

/**
 * The recorded network. `newsOk` serves the rebuilt successful Google News reply instead of the block page.
 * @param {{ newsOk?: boolean, statuses?: Record<string, number> }} [opt]
 */
export function recordedNet(opt = {}) {
  const r = (/** @type {string} */ f) => fixtureJson(`recorded/${f}`);
  const hnEmpty = { hits: [] };
  return fakeNet({
    'https://hn.algolia.com/api/v1/search?query=arxiv.org%2Fabs%2F2611.12869': r('hn-url-2611.12869.json'),
    'https://hn.algolia.com/api/v1/search?query=arxiv.org%2Fabs%2F2611.12634': r('hn-url-2611.12634.json'),
    'https://hn.algolia.com/api/v1/search?query=platonic%20representation%20hypothesis': r('hn-title-2611.12869.json'),
    'https://hn.algolia.com/api/v1/search?query=How%20Far': hnEmpty,
    'https://huggingface.co/api/papers/2611.12869': r('hf-2611.12869.json'),
    'https://huggingface.co/api/papers/2611.12634': r('hf-2611.12634.json'),
    'https://api.semanticscholar.org/graph/v1/paper/arXiv%3A2611.12869?': r('s2-2611.12869.json'),
    'https://api.semanticscholar.org/graph/v1/paper/arXiv%3A2611.12634?': r('s2-2611.12634.json'),
    'https://api.semanticscholar.org/graph/v1/paper/arXiv%3A2611.12869/references': r('s2-refs-2611.12869.json'),
    'https://api.semanticscholar.org/graph/v1/paper/arXiv%3A2611.12634/references': r('s2-refs-2611.12634.json'),
    'https://news.google.com/rss/search?q=%222611.12869%22': opt.newsOk ? fixtureText('recorded/news-ok-prh.xml') : fixtureText('recorded/news-2611.12869.xml'),
    'https://news.google.com/rss/search?q=%222611.12634%22': fixtureText('recorded/news-2611.12634.xml'),
    'https://api.github.com/repos/ExplainableML/prh-closer-look': r('gh-repo-prh.json'),
    'https://api.github.com/search/repositories?q=2611.12869': r('gh-search-2611.12869.json'),
    'https://api.github.com/search/repositories?q=2611.12634': r('gh-search-2611.12634.json'),
    'https://www.googleapis.com/youtube/v3/search': { items: [] },
  }, opt.statuses);
}
