import { useState } from 'react';
import { useSdk } from '../../../_sdk/react';
import { isManager } from '../NewsroomView';
import { OverviewTab } from './OverviewTab';
import { RunsTab } from './RunsTab';
import { CallsTab } from './CallsTab';
import { PromptsTab, type PaperChoice } from './PromptsTab';
import { FixesTab } from './FixesTab';
import { SettingsTab } from './SettingsTab';

const TABS = [['overview', 'Overview'], ['runs', 'Runs'], ['calls', 'Calls'], ['prompts', 'Prompts'], ['fixes', 'Fixes'], ['settings', 'Settings']] as const;
export type ConsoleTab = (typeof TABS)[number][0];

/** The club AI ops console behind the gear. Managers only (the API refuses everyone else too). */
export function OpsConsole({ clubId, clubName, week, papers, onClose, start = 'overview', openFixes = 0 }: { clubId: string; clubName: string; week: string; papers: PaperChoice[]; onClose: () => void; start?: ConsoleTab; openFixes?: number }) {
  const { member } = useSdk();
  const [tab, setTab] = useState<ConsoleTab>(start);
  const [run, setRun] = useState<string | undefined>();
  if (!isManager(member.role, member.isSuperAdmin)) return <p className="p-4 text-sm">Only the club's owner, admins and moderators can open the AI ops console.</p>;
  return (
    <section aria-label="AI ops console" className="overflow-hidden rounded-lg border border-border bg-background">
      <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <h3 className="flex-1 text-lg font-semibold">{clubName} · AI ops</h3>
        <span className="text-xs text-muted-foreground">Edition {week}</span>
        <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm" onClick={onClose}>Back to the Gazette</button>
      </header>
      <div role="tablist" aria-label="Console sections" className="flex overflow-x-auto border-b border-border px-2">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" type="button" aria-selected={tab === k} onClick={() => { setTab(k); if (k !== 'calls') setRun(undefined); }}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground'}`}>
            {l}{k === 'fixes' && openFixes > 0 && <span className="ms-1 rounded bg-muted px-1.5 font-mono text-xs">{openFixes}</span>}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="p-4">
        {tab === 'overview' && <OverviewTab clubId={clubId} week={week} />}
        {tab === 'runs' && <RunsTab clubId={clubId} onOpenRun={(id) => { setRun(id); setTab('calls'); }} />}
        {tab === 'calls' && <CallsTab clubId={clubId} runId={run} />}
        {tab === 'prompts' && <PromptsTab clubId={clubId} papers={papers} />}
        {tab === 'fixes' && <FixesTab clubId={clubId} />}
        {tab === 'settings' && <SettingsTab clubId={clubId} />}
      </div>
    </section>
  );
}
