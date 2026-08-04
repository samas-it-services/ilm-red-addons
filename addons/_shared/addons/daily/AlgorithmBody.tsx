/**
 * ai-algorithm-of-day body (design 1a). Tabs: In plain words · How it works · Pseudocode · Check
 * yourself. Renders a section only when its payload keys exist. Tokens only; labels via
 * useT('bookclubs') dailyCard.* with English defaults. See AGENT_PROMPT §4.1 for the contract.
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/I18nProvider';
import { LEARNING_TOKENS as TK } from '@/components/learning/tokens';
import { DailyTabs, type DailyTab } from './DailyTabs';
import { KnnScatter } from './KnnScatter';
import { Chip, CopyButton, SectionHeading, StatCell, type BodyProps } from './parts';

export function AlgorithmBody({ payload }: BodyProps) {
  const { t } = useT('bookclubs');

  const family = typeof payload.family === 'string' ? payload.family : null;
  const difficulty = typeof payload.difficulty === 'string' ? payload.difficulty : null;
  const hook = typeof payload.hook === 'string' ? payload.hook : null;
  const complexity = payload.complexity && typeof payload.complexity === 'object' ? payload.complexity : null;
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  const pseudocode = typeof payload.pseudocode === 'string' ? payload.pseudocode : null;
  const quiz = payload.quiz && typeof payload.quiz === 'object' ? payload.quiz : null;
  const diagramKind = payload.diagram?.kind;
  const explainer = typeof payload.explainer === 'string' ? payload.explainer : null;

  const COMPLEXITY_LABELS: [string, string][] = [
    ['train', t('dailyCard.algo.train', { defaultValue: 'Train' })],
    ['predict', t('dailyCard.algo.predict', { defaultValue: 'Predict' })],
    ['memory', t('dailyCard.algo.memory', { defaultValue: 'Memory' })],
    ['hyperparams', t('dailyCard.algo.hyperparams', { defaultValue: 'Hyperparams' })],
  ];

  const tabs: DailyTab[] = [];

  // In plain words — explainer + complexity grid
  tabs.push({
    key: 'plain',
    label: t('dailyCard.algo.plain', { defaultValue: 'In plain words' }),
    render: () => (
      <div className="space-y-4">
        {explainer ? (
          <p className="max-w-[68ch] whitespace-pre-line text-[14px] leading-relaxed text-foreground/90" dir="auto">{explainer}</p>
        ) : null}
        {complexity ? (
          <div>
            <SectionHeading>{t('dailyCard.algo.complexity', { defaultValue: 'Complexity' })}</SectionHeading>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {COMPLEXITY_LABELS.filter(([k]) => typeof complexity[k] === 'string').map(([k, label]) => (
                <StatCell key={k} label={label} value={complexity[k]} />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    ),
  });

  // How it works — diagram (only the hard-coded kind) then steps
  if (steps.length || diagramKind === 'knn-scatter') {
    tabs.push({
      key: 'how',
      label: t('dailyCard.algo.how', { defaultValue: 'How it works' }),
      render: () => (
        <div className="space-y-4">
          {diagramKind === 'knn-scatter' ? <KnnScatter legend={payload.diagram?.legend} /> : null}
          {steps.length ? (
            <ol className="space-y-2.5">
              {steps.map((s: { label?: string; body?: string }, i: number) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] font-bold text-primary" style={{ background: TK.primarySoft }}>{i + 1}</span>
                  <div className="min-w-0">
                    {s.label ? <div className="text-[13.5px] font-semibold text-foreground" dir="auto">{s.label}</div> : null}
                    {s.body ? <div className="text-[13px] leading-relaxed text-muted-foreground" dir="auto">{s.body}</div> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ),
    });
  }

  // Pseudocode — <pre> + copy
  if (pseudocode) {
    tabs.push({
      key: 'code',
      label: t('dailyCard.algo.pseudocode', { defaultValue: 'Pseudocode' }),
      render: () => (
        <div className="space-y-2">
          <pre className="overflow-x-auto rounded-xl border border-border bg-background p-3 font-mono text-[12.5px] leading-relaxed text-foreground">{pseudocode}</pre>
          <CopyButton
            text={pseudocode}
            label={t('dailyCard.algo.copy', { defaultValue: 'Copy' })}
            copiedLabel={t('dailyCard.algo.copied', { defaultValue: 'Copied' })}
          />
        </div>
      ),
    });
  }

  // Check yourself — quiz
  if (quiz && Array.isArray(quiz.options)) {
    tabs.push({
      key: 'quiz',
      label: t('dailyCard.algo.quiz', { defaultValue: 'Check yourself' }),
      render: () => <Quiz quiz={quiz} />,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {/* Gold (--mastery, "earned") is reserved for the correct quiz answer; these are plain chips. */}
        {family ? <Chip>{family}</Chip> : null}
        {difficulty ? <Chip>{t(`dailyCard.difficulty.${difficulty}`, { defaultValue: difficulty })}</Chip> : null}
        {hook ? <Chip>{hook}</Chip> : null}
      </div>
      <DailyTabs tabs={tabs} ariaLabel={t('dailyCard.algo.tabs', { defaultValue: 'Algorithm sections' })} />
    </div>
  );
}

function Quiz({ quiz }: { quiz: { prompt?: string; options: string[]; answer?: number; explain?: string } }) {
  const { t } = useT('bookclubs');
  const [chosen, setChosen] = useState<number | null>(null);
  const graded = chosen !== null;
  const answer = typeof quiz.answer === 'number' ? quiz.answer : -1;

  return (
    <div className="space-y-3">
      {quiz.prompt ? <p className="text-[14px] font-semibold text-foreground" dir="auto">{quiz.prompt}</p> : null}
      <div className="space-y-2" role="group" aria-label={t('dailyCard.algo.quiz', { defaultValue: 'Check yourself' })}>
        {quiz.options.map((opt, i) => {
          const isCorrect = i === answer;
          const isChosen = i === chosen;
          const showCorrect = graded && isCorrect;
          const showWrong = graded && isChosen && !isCorrect;
          return (
            <button
              key={i}
              type="button"
              disabled={graded}
              aria-describedby={showWrong || showCorrect ? 'quiz-explain' : undefined}
              onClick={() => setChosen(i)}
              className={cn(
                'flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-[13.5px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                graded ? 'cursor-default' : 'hover:bg-muted',
                showCorrect || showWrong ? 'font-semibold' : 'border-border text-foreground',
              )}
              style={{
                borderColor: showCorrect ? TK.mastery : showWrong ? TK.primary : undefined,
                color: showCorrect ? TK.mastery : showWrong ? TK.primary : undefined,
                background: showCorrect ? TK.masterySoft : showWrong ? TK.primarySoft : undefined,
              }}
            >
              <span className="min-w-0 flex-1" dir="auto">{opt}</span>
              {showCorrect ? <span className="text-[11.5px] font-bold uppercase">{t('dailyCard.quiz.correct', { defaultValue: 'Correct' })}</span> : null}
              {showWrong ? <span className="text-[11.5px] font-bold uppercase">{t('dailyCard.quiz.incorrect', { defaultValue: 'Not quite' })}</span> : null}
            </button>
          );
        })}
      </div>
      {graded && quiz.explain ? (
        <p id="quiz-explain" className="max-w-[68ch] rounded-xl border border-border bg-muted/40 p-3 text-[13px] leading-relaxed text-muted-foreground" dir="auto">
          {quiz.explain}
        </p>
      ) : null}
    </div>
  );
}
