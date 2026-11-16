/**
 * Builds static pages of the add-on's screens from real pipeline output (the 16 Nov sample) and the real
 * components. Run through `npm run harness`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestSdkProvider, testSdk } from '../../_sdk/testing';
import { NewsroomView, type NewsroomStoryData } from '../ui';
import { screens as managerScreens } from './screens-manager';
import { runEdition } from '../pipeline/run.mjs';
import { toNewsroomData } from '../pipeline/present.mjs';
import { fakeDeps } from '../../_sdk/fakes.mjs';
import { recordedNet, samplePapers } from '../tests/helpers.mjs';
import { sampleModel, memoryStore } from '../tests/scripted.mjs';
import { loadPromptFiles } from '../prompts/index.mjs';

const OUT = path.join(process.cwd(), 'gazette-voice', 'harness', 'out');
fs.mkdirSync(OUT, { recursive: true });

async function stories(lang: 'en' | 'ur'): Promise<NewsroomStoryData[]> {
  const P = loadPromptFiles();
  const { club, papers } = samplePapers();
  const ps = lang === 'ur' ? [papers[0]] : papers;
  const deps = fakeDeps({ callModel: sampleModel({}, { lang }).callModel, net: recordedNet({ newsOk: true }).net });
  const { records } = await runEdition({ runId: 'h', club, lang, papers: ps, config: { sources: ['hn', 'hf', 's2', 'news', 'github'], writerModel: 'claude-sonnet-5', cheapModel: 'deepseek-v4-flash', budgetUsd: 0.5, rates: {} }, prompts: { frame: P.frame, stages: { scout: P.scout, 'write.en': P['write.en'], 'write.ur': P['write.ur'], rewrite: P.rewrite, skeptic: P.skeptic, editor: P.editor, level: P.level }, voices: {}, learned: {} }, store: memoryStore(), deps });
  return records.map((r, i) => toNewsroomData(r, { storyId: `s${i}`, paperPath: ps[i].path, masthead: lang === 'ur' ? 'اے آئی گزٹ' : club.masthead }) as NewsroomStoryData);
}

export function page(title: string, body: string, opts: { dark?: boolean; width: number; rtl?: boolean }) {
  return `<!DOCTYPE html><html lang="${opts.rtl ? 'ur' : 'en'}" class="${opts.dark ? 'dark' : ''}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><link rel="stylesheet" href="harness.css"></head><body><main style="max-width:${opts.width}px;margin:0 auto;padding:16px">${body}</main></body></html>`;
}

const masthead = (name: string, meta: string, gear = false) => `<header class="flex items-end gap-4 border-b-4 border-double border-foreground px-4 pb-2 pt-4"><h2 class="flex-1 text-3xl font-semibold">${name}</h2><span class="text-sm text-muted-foreground">${meta}</span></header><nav class="flex border-b border-border px-4 text-sm"><span class="border-b-2 border-primary px-3 py-2 font-medium">Newsroom</span><span class="px-3 py-2 text-muted-foreground">Easy</span><span class="px-3 py-2 text-muted-foreground">Expert</span></nav>`;

async function main() {
  const en = await stories('en');
  const ur = await stories('ur');
  const plain = { ...en[1], story_id: 'p', state: 'plain' as const, easy: { headline: 'Predicting how one model change shifts other behavior', text: 'Researchers found a surprisingly consistent rule: how much a model changes intended behavior is linked to how much unintended behavior shifts across models.' } };
  const withUpdate = { ...en[0], story_id: 'u', update: 'Illustration of an Update line: when the day 3 check finds a notable new item, one sentence like this is added with its [link](https://news.ycombinator.com/item?id=50325454).' };
  const view = (list: NewsroomStoryData[], sdkOver: Parameters<typeof testSdk>[0] = {}, manager = true) =>
    renderToStaticMarkup(<TestSdkProvider sdk={testSdk({ role: manager ? 'moderator' : 'member', ...sdkOver })}><NewsroomView clubId="club_ai" clubSlug="ai" stories={list} onOpenConsole={() => {}} actions={{ onSuggestFix: () => {}, onHistory: () => {} }} /></TestSdkProvider>);
  const off = { prefs: { get: () => JSON.stringify({ highlight: false, levels: [] }), set: () => {} } };
  const noExpert = { prefs: { get: () => JSON.stringify({ highlight: true, levels: ['easy', 'advanced'] }), set: () => {} } };
  const pages: Array<[string, string, { dark?: boolean; width: number; rtl?: boolean }]> = [
    ['newsroom-desktop-light', masthead('The AI Gazette', 'Week 46, 2026 · 10 papers') + view([en[0], en[1], withUpdate, plain]), { width: 1080 }],
    ['newsroom-desktop-dark', masthead('The AI Gazette', 'Week 46, 2026 · 10 papers') + view([en[0], en[1]]), { width: 1080, dark: true }],
    ['newsroom-phone', masthead('The AI Gazette', 'Week 46') + view([en[0]]), { width: 390 }],
    ['newsroom-terms-off', masthead('The AI Gazette', 'Highlight terms switched off') + view([en[0]], off), { width: 1080 }],
    ['newsroom-no-expert', masthead('The AI Gazette', 'Expert terms hidden') + view([en[0]], noExpert), { width: 1080 }],
    ['newsroom-member-view', masthead('The AI Gazette', 'A member: no gear') + view([en[0]], {}, false), { width: 1080 }],
    ['newsroom-urdu', `<div dir="rtl">${masthead('اے آئی گزٹ', 'ہفتہ ۴۶')}</div>` + view(ur, { lang: 'ur' }), { width: 1080, rtl: true }],
    ...managerScreens(en),
  ];
  for (const [name, body, opts] of pages) fs.writeFileSync(path.join(OUT, `${name}.html`), page(name, body, opts));
  console.log(`harness: wrote ${pages.length} pages to ${OUT}`);
}

// Run by vitest (see harness.vitest.mjs) so TSX, ES modules and fixture paths work as in the tests.
import { it } from 'vitest';
it('builds the harness pages', async () => { await main(); }, 60000);
