export type ProjectType = 'SUBSCRIPTION' | 'LEGACY' | 'PORTFOLIO';
export type BillingPlan = 'BASIC' | 'PRO' | 'BUSINESS' | null;

export function deriveProjectType(
  plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY',
  portfolioFlag: boolean,
): ProjectType {
  if (portfolioFlag) return 'PORTFOLIO';
  if (plan === 'LEGACY') return 'LEGACY';
  return 'SUBSCRIPTION';
}

export function deriveBillingPlan(
  plan: 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY',
  projectType: ProjectType,
): BillingPlan {
  if (projectType !== 'SUBSCRIPTION') return null;
  return plan as 'BASIC' | 'PRO' | 'BUSINESS';
}
