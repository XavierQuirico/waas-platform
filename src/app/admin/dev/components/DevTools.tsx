'use client';

import { useState } from 'react';
import { CreateTestProject } from './CreateTestProject';
import { CreateTestClient } from './CreateTestClient';
import { AdvanceProjectState } from './AdvanceProjectState';
import { ResetSLATimer } from './ResetSLATimer';
import { SimulatePaypalWebhook } from './SimulatePaypalWebhook';
import { SimulatePaymentFailed } from './SimulatePaymentFailed';
import { SimulateUptimeRobotAlert } from './SimulateUptimeRobotAlert';
import { TriggerInngestEvent } from './TriggerInngestEvent';
import { ProjectEventLog } from './ProjectEventLog';
import { CleanDevData } from './CleanDevData';

type Tab =
  | 'create_project'
  | 'create_client'
  | 'advance'
  | 'reset_sla'
  | 'paypal_ok'
  | 'paypal_fail'
  | 'uptimerobot'
  | 'inngest'
  | 'log'
  | 'clean';

const TABS: { id: Tab; label: string }[] = [
  { id: 'create_project', label: 'Crear proyecto' },
  { id: 'create_client', label: 'Crear cliente' },
  { id: 'advance', label: 'Avanzar estado' },
  { id: 'reset_sla', label: 'Reset SLA' },
  { id: 'paypal_ok', label: 'Simular pago OK' },
  { id: 'paypal_fail', label: 'Simular pago fallido' },
  { id: 'uptimerobot', label: 'Simular UptimeRobot' },
  { id: 'inngest', label: 'Trigger Inngest' },
  { id: 'log', label: 'Event log' },
  { id: 'clean', label: 'Limpiar datos' },
];

export function DevTools() {
  const [activeTab, setActiveTab] = useState<Tab>('create_project');
  const [lastCreatedProjectId, setLastCreatedProjectId] = useState<string | null>(null);

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors font-[\'Roobert\']',
              activeTab === tab.id
                ? 'bg-amber-500/20 text-amber-400'
                : 'text-white/40 hover:text-white/70',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      {activeTab === 'create_project' && (
        <CreateTestProject onCreated={(id) => { setLastCreatedProjectId(id); setActiveTab('log'); }} />
      )}
      {activeTab === 'create_client' && <CreateTestClient />}
      {activeTab === 'advance' && (
        <AdvanceProjectState defaultProjectId={lastCreatedProjectId ?? undefined} />
      )}
      {activeTab === 'reset_sla' && <ResetSLATimer />}
      {activeTab === 'paypal_ok' && <SimulatePaypalWebhook />}
      {activeTab === 'paypal_fail' && <SimulatePaymentFailed />}
      {activeTab === 'uptimerobot' && <SimulateUptimeRobotAlert />}
      {activeTab === 'inngest' && <TriggerInngestEvent defaultProjectId={lastCreatedProjectId ?? undefined} />}
      {activeTab === 'log' && <ProjectEventLog defaultProjectId={lastCreatedProjectId ?? undefined} />}
      {activeTab === 'clean' && <CleanDevData />}
    </div>
  );
}
