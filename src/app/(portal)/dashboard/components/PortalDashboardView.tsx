import type { NavItem } from '@/lib/portal/nav';
import type { PortalStatusConfig, PortalDashboardVisualState, StepItem } from '@/lib/portal/dashboard-state';
import type { ProjectCardItem } from './PortalProjectList';
import { PortalStatusCard } from './PortalStatusCard';
import { PortalTimeline } from './PortalTimeline';
import { PortalProjectList } from './PortalProjectList';
import { PortalAreaGrid } from './PortalAreaGrid';
import { PortalHelpCard } from './PortalHelpCard';

const SECTION_LABEL_STYLE = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-3)',
  letterSpacing: '0.07em',
  textTransform: 'uppercase' as const,
  fontFamily: 'var(--font-body)',
  marginBottom: 12,
  marginTop: 0,
};

const CARD_STYLE = {
  background: 'var(--surface)',
  borderRadius: 12,
  padding: 20,
  boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
};

interface PortalDashboardViewProps {
  clientFirstName: string;
  visualState: PortalDashboardVisualState;
  statusConfig: PortalStatusConfig;
  productionUrl: string | null;
  navItems: NavItem[];
  projectItems: ProjectCardItem[];
  steps: StepItem[];
  currentStep: number;
}

export function PortalDashboardView({
  clientFirstName,
  visualState,
  statusConfig,
  productionUrl,
  navItems,
  projectItems,
  steps,
  currentStep,
}: PortalDashboardViewProps) {
  const areaItems = navItems.filter((item) => item.id !== 'inicio');

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 28,
            color: 'var(--text)',
            letterSpacing: '-0.03em',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          Hola, {clientFirstName}.
        </h1>
        <p
          style={{
            fontSize: 13,
            color: 'var(--text-3)',
            marginTop: 5,
            fontFamily: 'var(--font-body)',
          }}
        >
          Este es tu portal de QUIRICO STUDIOS.
        </p>
      </div>

      {/* Status card */}
      <PortalStatusCard
        config={statusConfig}
        productionUrl={productionUrl}
        visualState={visualState}
      />

      {/* Two-column: Steps + Projects */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 18,
          marginBottom: 22,
          alignItems: 'start',
        }}
      >
        <div style={CARD_STYLE}>
          <p style={SECTION_LABEL_STYLE}>Próximos pasos</p>
          <PortalTimeline steps={steps} currentStep={currentStep} />
        </div>

        <div style={CARD_STYLE}>
          <p style={SECTION_LABEL_STYLE}>Tus sitios y proyectos</p>
          <PortalProjectList projects={projectItems} />
        </div>
      </div>

      {/* Portal areas */}
      {areaItems.length > 0 && (
        <div style={{ marginBottom: 22 }}>
          <p style={SECTION_LABEL_STYLE}>Áreas del portal</p>
          <PortalAreaGrid areas={areaItems} />
        </div>
      )}

      {/* Help */}
      <PortalHelpCard />
    </div>
  );
}
