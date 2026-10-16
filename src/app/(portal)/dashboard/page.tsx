import { requirePortalClient } from '@/lib/portal/context';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { deriveProjectType } from '@/lib/portal/project-type';
import {
  derivePortalDashboardState,
  getPortalDashboardStatusConfig,
  getPortalDashboardSteps,
  getPortalDashboardCurrentStep,
  getProjectTypeLabel,
  getProjectDisplayName,
} from '@/lib/portal/dashboard-state';
import { getPortalNavItems, getLimitedPortalNavItems } from '@/lib/portal/nav';
import { toExternalUrl } from '@/lib/portal/url';
import type { ProjectStatus } from '@/lib/projects/state-machine';
import type { ProjectCardItem } from './components/PortalProjectList';
import { PortalDashboardView } from './components/PortalDashboardView';

export default async function PortalDashboard() {
  const { client } = await requirePortalClient();

  const allProjects = await db
    .select({
      id: projects.id,
      status: projects.status,
      plan: projects.plan,
      portfolioFlag: projects.portfolioFlag,
      stagingUrl: projects.stagingUrl,
      productionUrl: projects.productionUrl,
      domainTarget: projects.domainTarget,
      liveAt: projects.liveAt,
    })
    .from(projects)
    .where(eq(projects.clientId, client.id))
    .orderBy(desc(projects.createdAt))
    .limit(20);

  const primaryProject = allProjects[0] ?? null;
  const firstName = client.fullName.split(' ')[0] || client.fullName;

  if (!primaryProject) {
    const visualState = 'limited' as const;
    const statusConfig = getPortalDashboardStatusConfig({
      visualState,
      status: 'DRAFT',
      projectType: 'SUBSCRIPTION',
      projectId: null,
      stagingUrl: null,
      productionUrl: null,
    });
    const navItems = getLimitedPortalNavItems();
    const steps = getPortalDashboardSteps('SUBSCRIPTION');
    const currentStep = getPortalDashboardCurrentStep(visualState);

    return (
      <PortalDashboardView
        clientFirstName={firstName}
        visualState={visualState}
        statusConfig={statusConfig}
        productionUrl={null}
        navItems={navItems}
        projectItems={[]}
        steps={steps}
        currentStep={currentStep}
      />
    );
  }

  const plan = primaryProject.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
  const projectType = deriveProjectType(plan, primaryProject.portfolioFlag);
  const status = primaryProject.status as ProjectStatus;

  const visualState = derivePortalDashboardState({
    status,
    projectType,
    hasProject: true,
    stagingUrl: primaryProject.stagingUrl ?? null,
    productionUrl: primaryProject.productionUrl ?? null,
    liveAt: primaryProject.liveAt ?? null,
  });

  const statusConfig = getPortalDashboardStatusConfig({
    visualState,
    status,
    projectType,
    projectId: primaryProject.id,
    stagingUrl: primaryProject.stagingUrl ?? null,
    productionUrl: primaryProject.productionUrl ?? null,
  });

  const navItems = getPortalNavItems({ projectType, projectId: primaryProject.id });
  const steps = getPortalDashboardSteps(projectType);
  const currentStep = getPortalDashboardCurrentStep(visualState);

  const projectItems: ProjectCardItem[] = allProjects.map((p, index) => {
    const pPlan = p.plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY';
    const pType = deriveProjectType(pPlan, p.portfolioFlag);
    const pStatus = p.status as ProjectStatus;
    const pVisualState = derivePortalDashboardState({
      status: pStatus,
      projectType: pType,
      hasProject: true,
      stagingUrl: p.stagingUrl ?? null,
      productionUrl: p.productionUrl ?? null,
      liveAt: p.liveAt ?? null,
    });
    const href = pVisualState === 'active' ? '/mi-sitio' : `/proyecto/${p.id}`;

    return {
      id: p.id,
      displayName: getProjectDisplayName({
        index,
        total: allProjects.length,
        productionUrl: p.productionUrl ?? null,
        stagingUrl: p.stagingUrl ?? null,
        domainTarget: p.domainTarget ?? null,
      }),
      typeLabel: getProjectTypeLabel(pPlan, p.portfolioFlag),
      visualState: pVisualState,
      productionUrl: toExternalUrl(p.productionUrl ?? null),
      href,
    };
  });

  return (
    <PortalDashboardView
      clientFirstName={firstName}
      visualState={visualState}
      statusConfig={statusConfig}
      productionUrl={toExternalUrl(primaryProject.productionUrl ?? null)}
      navItems={navItems}
      projectItems={projectItems}
      steps={steps}
      currentStep={currentStep}
    />
  );
}
