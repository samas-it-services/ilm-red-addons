/**
 * Accessible tab strip for the daily-card bodies (COMPONENT_SPEC "Accessibility").
 * Real <button role="tab"> in a role="tablist" with aria-selected and arrow-key movement. Tabs are
 * client state only — no URL param, no persistence. Tokens only, no hex.
 */
import React, { useId, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { LEARNING_TOKENS as TK } from '@/components/learning/tokens';

export interface DailyTab {
  key: string;
  label: string;
  render: () => React.ReactNode;
}

export function DailyTabs({ tabs, ariaLabel }: { tabs: DailyTab[]; ariaLabel: string }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: React.KeyboardEvent, i: number) => {
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab, i) => {
          const selected = i === active;
          return (
            <button
              key={tab.key}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="tab"
              id={`${base}-tab-${i}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${i}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKey(e, i)}
              className={cn(
                '-mb-px min-h-11 rounded-t-lg border-b-2 px-3 py-2 text-[13px] font-semibold',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
              style={selected ? { background: TK.primarySoft } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`${base}-panel-${i}`}
          aria-labelledby={`${base}-tab-${i}`}
          hidden={i !== active}
          className="pt-4"
        >
          {i === active ? tab.render() : null}
        </div>
      ))}
    </div>
  );
}
