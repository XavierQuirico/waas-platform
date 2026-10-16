// Entry point del wizard de intake público V2
// Lee ?plan= del searchParams y lo pasa al wizard como initialPlanIntent

import { IntakeWizard } from './components/IntakeWizard';

const VALID_PLANS = ['BASIC', 'PRO', 'BUSINESS', 'LEGACY'] as const;
type ValidPlan = typeof VALID_PLANS[number];

function parsePlanIntent(raw: string | string[] | undefined): ValidPlan | null {
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const upper = value.toUpperCase() as ValidPlan;
  return VALID_PLANS.includes(upper) ? upper : null;
}

interface EmpezarPageProps {
  searchParams: Promise<{ plan?: string | string[] }>;
}

export default async function EmpezarPage({ searchParams }: EmpezarPageProps) {
  const params = await searchParams;
  const initialPlanIntent = parsePlanIntent(params.plan);
  return <IntakeWizard initialPlanIntent={initialPlanIntent} />;
}
