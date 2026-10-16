'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Layers, Plus, Search, X } from 'lucide-react';
import {
  ACTIVE_STATES,
  CLOSED_STATES,
  ONBOARDING_STATES,
  PRODUCTION_STATES,
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from '@/lib/projects/state-machine';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { PlanBadge, type Plan } from '@/components/admin/PlanBadge';
import { SlaBadge } from '@/components/admin/SLABadge';
import { createProjectAction } from '../actions';

interface ProjectRow {
  id: string;
  status: string;
  plan: Plan;
  monthlyPriceCents: number;
  portfolioFlag: boolean;
  createdAt: Date;
  updatedAt: Date;
  proposalSentAt: Date | null;
  proposalExpiresAt: Date | null;
  productionDeadlineAt: Date | null;
  stagingReviewDeadlineAt: Date | null;
  stagingUrl: string | null;
  productionUrl: string | null;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string | null;
  businessName: string;
}

interface ClientOption {
  id: string;
  fullName: string;
  businessName: string;
  email: string;
  whatsapp: string | null;
  currentUrl: string | null;
}

interface QuoteOption {
  id: string;
  clientName: string;
  businessName: string;
  industry: string;
  projectType: string;
  plan: string | null;
  totalAmountProviderCents: number;
  domainTarget: string | null;
  internalNotes: string | null;
  status: string;
}

interface ProjectsQueueProps {
  projects: ProjectRow[];
  currentTab: string;
  currentPlan?: string;
  clients: ClientOption[];
  quotes: QuoteOption[];
}

const TABS: { key: string; label: string; statuses?: readonly ProjectStatus[] }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'preventa', label: 'Preventa', statuses: ['DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED'] as const },
  { key: 'onboarding', label: 'Onboarding', statuses: ['PAYMENT_RECEIVED', ...ONBOARDING_STATES] as const },
  { key: 'produccion', label: 'Producción', statuses: PRODUCTION_STATES },
  { key: 'activos', label: 'Activos', statuses: ACTIVE_STATES },
  { key: 'cerrados', label: 'Cerrados', statuses: CLOSED_STATES },
];

const PLAN_FILTERS = ['BASIC', 'PRO', 'BUSINESS', 'LEGACY'];

function daysInStatus(updatedAt: Date): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
}

function getSLAHours(project: ProjectRow): number | null {
  const deadline = project.productionDeadlineAt ?? project.stagingReviewDeadlineAt;
  if (!deadline) return null;
  const hours = Math.floor((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60));
  return Math.max(0, hours);
}

function sortBySLA(rows: ProjectRow[]): ProjectRow[] {
  return [...rows].sort((a, b) => {
    const ha = getSLAHours(a);
    const hb = getSLAHours(b);
    if (ha !== null && hb !== null) return ha - hb;
    if (ha !== null) return -1;
    if (hb !== null) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function getWAMessage(project: ProjectRow): string {
  const firstName = project.clientName.split(' ')[0];
  const portalLink = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://waas.app'}/dashboard`;

  const messages: Partial<Record<ProjectStatus, string>> = {
    AWAITING_ASSETS: `Hola ${firstName}, soy Xavier. Ya activé tu proyecto WaaS. Para comenzar, necesito que subas tus materiales desde tu portal: ${portalLink}. ¿Tienes alguna duda?`,
    ASSETS_INCOMPLETE: `Hola ${firstName}, revisé tus materiales y hay ajustes necesarios. Los detalles están en tu portal: ${portalLink}. ¿Puedes revisarlo hoy?`,
    STAGING_REVIEW: `Hola ${firstName}, tu preview está listo: ${project.stagingUrl ?? ''}. Tienes 72h para enviarme feedback desde el portal: ${portalLink}.`,
    REVISIONS: `Hola ${firstName}, recibí tu feedback. Estoy aplicando los cambios, te aviso cuando el nuevo preview esté listo.`,
    PROPOSAL_SENT: `Hola ${firstName}, te envié una propuesta por email. ¿La recibiste?`,
    PROPOSAL_EXPIRED: `Hola ${firstName}, tu propuesta expiró pero puedo generarte una nueva. ¿Te parece si la actualizamos?`,
    SUSPENDED: `Hola ${firstName}, tu sitio está suspendido por un problema de pago. ¿Pudiste actualizar tu método de pago? ${portalLink}`,
  };

  return messages[project.status as ProjectStatus] ?? `Hola ${firstName}, soy Xavier. ¿En qué puedo ayudarte?`;
}

function QuickActions({ project }: { project: ProjectRow }) {
  const status = project.status as ProjectStatus;
  const waLink = project.clientWhatsapp
    ? `https://wa.me/${project.clientWhatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(getWAMessage(project))}`
    : null;

  const WABtn = waLink ? (
    <a
      href={waLink}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
      style={{
        border: '1px solid rgba(93,214,156,0.25)',
        background: 'rgba(93,214,156,0.08)',
        color: '#5DD69C',
        borderRadius: 6,
        padding: '4px 8px',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'Inter Tight',
        textDecoration: 'none',
      }}
    >
      WhatsApp <ExternalLink size={10} strokeWidth={1.5} />
    </a>
  ) : null;

  const ActionBtn = ({ href, label }: { href: string; label: string }) => (
    <Link
      href={href}
      className="transition-opacity hover:opacity-80"
      style={{
        background: 'var(--surface-2)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        color: 'var(--text)',
        borderRadius: 6,
        padding: '4px 8px',
        fontSize: 11,
        fontWeight: 500,
        fontFamily: 'Inter Tight',
        textDecoration: 'none',
        display: 'inline-block',
      }}
    >
      {label}
    </Link>
  );

  switch (status) {
    case 'DRAFT':
    case 'REQUIRES_REVIEW':
      return (
        <div className="flex items-center gap-1.5">
          <ActionBtn href={`/admin/proyectos/${project.id}/proposal`} label="Crear propuesta" />
          {WABtn}
        </div>
      );
    case 'PROPOSAL_SENT':
    case 'PROPOSAL_EXPIRED':
      return (
        <div className="flex items-center gap-1.5">
          <ActionBtn href={`/admin/proyectos/${project.id}/proposal`} label="Re-enviar" />
          {WABtn}
        </div>
      );
    case 'AWAITING_ASSETS':
    case 'ASSETS_INCOMPLETE':
      return <div className="flex items-center gap-1.5">{WABtn}</div>;
    case 'ASSETS_SUBMITTED':
    case 'ASSETS_UNDER_REVIEW':
      return <ActionBtn href={`/admin/proyectos/${project.id}?tab=assets`} label="Revisar assets" />;
    case 'PRODUCTION_STARTED':
      return <ActionBtn href={`/admin/proyectos/${project.id}?tab=staging`} label="Subir staging" />;
    case 'STAGING_REVIEW':
      return (
        <div className="flex items-center gap-1.5">
          <ActionBtn href={`/admin/proyectos/${project.id}?tab=staging`} label="Ver feedback" />
          {WABtn}
        </div>
      );
    case 'REVISIONS':
      return <ActionBtn href={`/admin/proyectos/${project.id}?tab=staging`} label="Revisar cambios" />;
    case 'REVISIONS_DONE':
      return <ActionBtn href={`/admin/proyectos/${project.id}?tab=staging`} label="Publicar" />;
    case 'LIVE':
      return project.productionUrl ? (
        <a
          href={project.productionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
          style={{
            border: '1px solid rgba(93,214,156,0.25)',
            background: 'rgba(93,214,156,0.08)',
            color: '#5DD69C',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 500,
            fontFamily: 'Inter Tight',
            textDecoration: 'none',
          }}
        >
          Ver sitio <ExternalLink size={10} strokeWidth={1.5} />
        </a>
      ) : null;
    case 'SUSPENDED':
      return (
        <div className="flex items-center gap-1.5">
          <ActionBtn href={`/admin/proyectos/${project.id}`} label="Gestionar" />
          {WABtn}
        </div>
      );
    default:
      return <ActionBtn href={`/admin/proyectos/${project.id}`} label="Ver detalle" />;
  }
}

export function ProjectsQueue({ projects, currentTab, currentPlan, clients, quotes }: ProjectsQueueProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);

  function buildHref(tab: string, plan?: string) {
    const params = new URLSearchParams();
    params.set('tab', tab);
    if (plan) params.set('plan', plan);
    return `/admin/proyectos?${params.toString()}`;
  }

  function setPlan(plan: string) {
    router.push(buildHref(currentTab, plan || undefined));
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sortBySLA(
      projects.filter((project) => {
        if (!q) return true;
        return (
          project.clientName.toLowerCase().includes(q) ||
          project.businessName.toLowerCase().includes(q) ||
          project.clientEmail.toLowerCase().includes(q)
        );
      }),
    );
  }, [projects, search]);

  const tabsWithCounts = TABS.map((tab) => ({
    ...tab,
    count:
      tab.key === 'todos'
        ? projects.length
        : projects.filter((project) => tab.statuses?.includes(project.status as ProjectStatus)).length,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '28px 32px 0', flexShrink: 0 }}>
        <SectionHeader
          title="Cola de Proyectos"
          action={
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: 'var(--amber)',
                color: '#121212',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontFamily: 'Inter Tight',
                cursor: 'pointer',
              }}
            >
              <Plus size={14} strokeWidth={2} />
              Nuevo proyecto
            </button>
          }
        />

        <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <SearchBox value={search} onChange={setSearch} placeholder="Buscar por cliente o negocio..." />
          <PlanSelect value={currentPlan ?? ''} onChange={setPlan} />
        </div>

        <TabBar
          tabs={tabsWithCounts}
          active={currentTab}
          hrefFor={(tab) => buildHref(tab, currentPlan)}
        />
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 32px 32px' }}>
        {filtered.length === 0 ? (
          <EmptyProjectsState />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/admin/proyectos/${project.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      <NewProjectModal open={showNewModal} onClose={() => setShowNewModal(false)} clients={clients} quotes={quotes} />
    </div>
  );
}

// Infiere quién debe actuar según el estado — igual que el ActorPill del diseño
function getActor(status: ProjectStatus): 'Xavier' | 'Cliente' | null {
  const clientStates: ProjectStatus[] = [
    'PROPOSAL_SENT', 'AWAITING_ASSETS', 'ASSETS_INCOMPLETE', 'STAGING_REVIEW', 'SUSPENDED',
  ];
  const adminStates: ProjectStatus[] = [
    'DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_EXPIRED', 'PAYMENT_RECEIVED',
    'ASSETS_SUBMITTED', 'ASSETS_UNDER_REVIEW', 'PRODUCTION_STARTED',
    'REVISIONS', 'REVISIONS_DONE',
  ];
  if (clientStates.includes(status)) return 'Cliente';
  if (adminStates.includes(status)) return 'Xavier';
  return null;
}

function ActorPill({ actor }: { actor: 'Xavier' | 'Cliente' }) {
  const isAdmin = actor === 'Xavier';
  const color = isAdmin ? '#FF8C00' : '#6B9FFF';
  return (
    <span
      style={{
        background: color + '22',
        color,
        border: `1px solid ${color}55`,
        borderRadius: 100,
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 600,
        fontFamily: 'Inter Tight',
      }}
    >
      ⚡ {actor}
    </span>
  );
}

function ProjectCard({ project, onClick }: { project: ProjectRow; onClick: () => void }) {
  const slaHours = getSLAHours(project);
  const days = daysInStatus(project.updatedAt);
  const statusLabel = PROJECT_STATUS_LABELS[project.status as ProjectStatus] ?? project.status;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        cursor: 'pointer',
        transition: 'background 0.15s, border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,140,0,0.3)';
        e.currentTarget.style.background = 'var(--surface-2)';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
        e.currentTarget.style.background = 'var(--surface)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
        <div>
          <div style={{ fontFamily: 'Inter Tight', fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
            {project.businessName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{project.clientName}</div>
        </div>
        <PlanBadge plan={project.plan} />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <StatusBadge status={project.status as ProjectStatus} label={statusLabel} />
        {slaHours !== null && <SlaBadge hoursRemaining={slaHours} />}
        {project.portfolioFlag && <span className="badge-pill badge-amber">PORTFOLIO</span>}
        {getActor(project.status as ProjectStatus) !== null && (
          <ActorPill actor={getActor(project.status as ProjectStatus)!} />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'Inter Tight' }}>
          Creado {formatShortDate(project.createdAt)} · {days === 0 ? 'hoy' : `${days}d en estado`}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <QuickActions project={project} />
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <h1
        style={{
          fontFamily: 'Clash Grotesk',
          fontWeight: 700,
          fontSize: 22,
          color: 'var(--text)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </h1>
      {action}
    </div>
  );
}

function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative" style={{ flex: 1, maxWidth: 320, minWidth: 240 }}>
      <Search
        size={13}
        strokeWidth={1.5}
        className="absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--text-3)' }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: 'none',
          borderRadius: 8,
          padding: '8px 12px 8px 34px',
          fontFamily: 'Inter Tight',
          fontSize: 13,
          color: 'var(--text)',
          outline: 'none',
          boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        }}
      />
    </div>
  );
}

function PlanSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--surface)',
        border: 'none',
        borderRadius: 8,
        padding: '8px 12px',
        color: value ? 'var(--text)' : 'var(--text-3)',
        fontFamily: 'Inter Tight',
        fontSize: 13,
        cursor: 'pointer',
        outline: 'none',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
      }}
    >
      <option value="">Todos los planes</option>
      {PLAN_FILTERS.map((plan) => (
        <option key={plan} value={plan}>
          {plan}
        </option>
      ))}
    </select>
  );
}

function TabBar({
  tabs,
  active,
  hrefFor,
}: {
  tabs: { key: string; label: string; count: number }[];
  active: string;
  hrefFor: (tab: string) => string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        background: 'var(--surface)',
        borderRadius: 10,
        padding: 4,
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
        width: 'fit-content',
        flexWrap: 'wrap',
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={hrefFor(tab.key)}
            style={{
              padding: '6px 13px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter Tight',
              fontWeight: 500,
              fontSize: 12,
              background: isActive ? 'var(--surface-2)' : 'transparent',
              color: isActive ? 'var(--text)' : 'var(--text-3)',
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
            }}
          >
            {tab.label}
            <span
              style={{
                background: isActive ? 'var(--amber)' : 'rgba(255,255,255,0.1)',
                color: isActive ? '#121212' : 'var(--text-3)',
                borderRadius: 100,
                padding: '1px 6px',
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {tab.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function EmptyProjectsState() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        borderRadius: 12,
        padding: 40,
        boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
        textAlign: 'center',
      }}
    >
      <Layers size={32} strokeWidth={1} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
      <p style={{ fontSize: 14, color: 'var(--text-3)', fontFamily: 'Inter Tight' }}>No hay proyectos en esta fase.</p>
      <Link
        href="/admin/proyectos?tab=todos"
        style={{ marginTop: 8, display: 'inline-block', fontSize: 13, color: 'var(--amber)', fontFamily: 'Inter Tight' }}
        className="hover:underline"
      >
        Ver todos →
      </Link>
    </div>
  );
}

type ModalStep = 'initial' | 'cotizacion' | 'cliente' | 'form';
type UIPlan = 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY' | 'PORTFOLIO';

const PLAN_PRICES: Record<UIPlan, { monthly: number; setup: number }> = {
  BASIC: { monthly: 49, setup: 50 },
  PRO: { monthly: 89, setup: 50 },
  BUSINESS: { monthly: 139, setup: 50 },
  LEGACY: { monthly: 0, setup: 0 },
  PORTFOLIO: { monthly: 0, setup: 0 },
};

function getQuotePlanLabel(quote: QuoteOption) {
  if (quote.projectType === 'legacy') return 'legacy';
  return quote.plan ?? '-';
}

function NewProjectModal({
  open,
  onClose,
  clients,
  quotes,
}: {
  open: boolean;
  onClose: () => void;
  clients: ClientOption[];
  quotes: QuoteOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<ModalStep>('initial');
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuoteOption | null>(null);
  const [plan, setPlan] = useState<UIPlan>('PRO');
  const [monthlyPrice, setMonthlyPrice] = useState('89');
  const [setupFee, setSetupFee] = useState('50');
  const [domainTarget, setDomainTarget] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function resetAndClose() {
    setStep('initial');
    setSearch('');
    setSelectedClient(null);
    setSelectedQuote(null);
    setPlan('PRO');
    setMonthlyPrice('89');
    setSetupFee('50');
    setDomainTarget('');
    setInternalNotes('');
    setError('');
    onClose();
  }

  function handlePlanChange(newPlan: UIPlan) {
    setPlan(newPlan);
    const prices = PLAN_PRICES[newPlan];
    setMonthlyPrice(prices.monthly > 0 ? String(prices.monthly) : '0');
    setSetupFee(prices.setup > 0 ? String(prices.setup) : '0');
  }

  function handleSelectQuote(quote: QuoteOption) {
    setSelectedQuote(quote);
    setSearch(quote.businessName);
    const dbPlan: UIPlan = ['BASIC', 'PRO', 'BUSINESS', 'LEGACY'].includes(quote.plan ?? '')
      ? (quote.plan as UIPlan)
      : quote.projectType === 'legacy'
        ? 'LEGACY'
      : 'PRO';
    setPlan(dbPlan);
    setMonthlyPrice(String(Math.round(quote.totalAmountProviderCents / 100)));
    setSetupFee('50');
    if (quote.domainTarget) setDomainTarget(quote.domainTarget);
    setStep('cliente');
  }

  function handleSelectClient(client: ClientOption) {
    setSelectedClient(client);
    setStep('form');
  }

  function handleBack() {
    if (step === 'form') {
      setStep('cliente');
    } else if (step === 'cliente') {
      setStep(selectedQuote ? 'cotizacion' : 'initial');
    } else if (step === 'cotizacion') {
      setStep('initial');
    }
  }

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (client) =>
        client.fullName.toLowerCase().includes(q) ||
        client.businessName.toLowerCase().includes(q) ||
        client.email.toLowerCase().includes(q) ||
        (client.currentUrl?.toLowerCase().includes(q) ?? false),
    );
  }, [clients, search]);

  const filteredQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quotes;
    return quotes.filter(
      (quote) =>
        quote.clientName.toLowerCase().includes(q) ||
        quote.businessName.toLowerCase().includes(q),
    );
  }, [quotes, search]);

  const newClientHref = useMemo(() => {
    const params = new URLSearchParams({ newClient: 'true' });
    if (selectedQuote) {
      params.set('fullName', selectedQuote.clientName);
      params.set('businessName', selectedQuote.businessName);
      params.set('industry', selectedQuote.industry);
      if (selectedQuote.domainTarget) params.set('domain', selectedQuote.domainTarget);
      if (selectedQuote.internalNotes) params.set('notes', selectedQuote.internalNotes);
    }
    return `/admin/clientes?${params.toString()}`;
  }, [selectedQuote]);

  async function handleSubmit() {
    if (!selectedClient) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await createProjectAction({
        clientId: selectedClient.id,
        plan: plan === 'PORTFOLIO' ? 'BASIC' : (plan as 'BASIC' | 'PRO' | 'BUSINESS' | 'LEGACY'),
        monthlyPriceCents: Math.round(parseFloat(monthlyPrice || '0') * 100),
        setupFeeCents: Math.round(parseFloat(setupFee || '0') * 100),
        domainTarget: domainTarget || undefined,
        internalNotes: internalNotes || undefined,
        portfolioFlag: plan === 'PORTFOLIO',
        quoteId: selectedQuote?.id,
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      resetAndClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear proyecto');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  const MODAL_TITLES: Record<ModalStep, string> = {
    initial: 'Nuevo Proyecto',
    cotizacion: 'Vincular cotización',
    cliente: 'Seleccionar cliente',
    form: 'Crear proyecto',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button
        type="button"
        aria-label="Cerrar modal"
        onClick={resetAndClose}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', border: 'none' }}
      />
      <div
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderRadius: 16,
          padding: 28,
          width: 540,
          maxWidth: 'calc(100vw - 32px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
          zIndex: 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {step !== 'initial' && (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ←
              </button>
            )}
            <h2 style={{ fontFamily: 'Clash Grotesk', fontWeight: 700, fontSize: 18, color: 'var(--text)' }}>
              {MODAL_TITLES[step]}
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 4, lineHeight: 1 }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {step === 'initial' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ marginTop: -6 }}>
              <p style={{ margin: 0, fontFamily: 'Inter Tight', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>
                Elige el punto de partida. Si ya existe una cotización, usaremos sus datos para acelerar la creación.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStep('cotizacion');
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr auto',
                alignItems: 'center',
                gap: 12,
                padding: 14,
                background: 'linear-gradient(135deg, rgba(255,140,0,0.12), rgba(255,255,255,0.035))',
                borderRadius: 12,
                border: '1px solid rgba(255,140,0,0.28)',
                textAlign: 'left',
                cursor: 'pointer',
                width: '100%',
                boxShadow: '0 10px 28px rgba(0,0,0,0.18)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,140,0,0.48)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,140,0,0.28)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,140,0,0.14)',
                  color: 'var(--amber)',
                }}
              >
                <Layers size={17} strokeWidth={1.8} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4, fontFamily: 'Inter Tight' }}>
                  Vincular cotización existente
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Inter Tight', lineHeight: 1.35 }}>
                  Prellena plan, precio, dominio y datos base del cliente.
                </div>
              </div>
              <span style={{ fontSize: 18, color: 'var(--amber)', lineHeight: 1 }}>→</span>
            </button>
            <Divider label="o" />
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStep('cliente');
              }}
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr auto',
                alignItems: 'center',
                gap: 12,
                background: 'var(--amber)',
                color: '#121212',
                borderRadius: 12,
                padding: 14,
                fontFamily: 'Inter Tight',
                fontWeight: 700,
                fontSize: 13,
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(18,18,18,0.12)',
                }}
              >
                <Plus size={17} strokeWidth={2.2} />
              </span>
              <span>
                Seleccionar cliente
                <span style={{ display: 'block', marginTop: 4, fontSize: 11, fontWeight: 500, opacity: 0.7 }}>
                  Para proyectos sin cotización previa.
                </span>
              </span>
              <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </button>
          </div>
        )}

        {step === 'cotizacion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por cliente o negocio..."
              autoFocus
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                fontFamily: 'Inter Tight',
                fontSize: 13,
                color: 'var(--text)',
                outline: 'none',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {filteredQuotes.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'Inter Tight', padding: '16px 0', textAlign: 'center' }}>
                  No hay cotizaciones disponibles
                </p>
              ) : (
                filteredQuotes.map((quote) => {
                  const quotePlanLabel = getQuotePlanLabel(quote);

                  return (
                    <button
                    key={quote.id}
                    type="button"
                    onClick={() => handleSelectQuote(quote)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: 'var(--surface-2)',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,140,0,0.3)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', fontFamily: 'Inter Tight' }}>
                        {quote.businessName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{quote.clientName}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--amber)', fontFamily: 'Inter Tight' }}>
                        {quotePlanLabel}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        ${Math.round(quote.totalAmountProviderCents / 100)}/mes
                      </div>
                    </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {step === 'cliente' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {selectedQuote && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(0,71,171,0.08)',
                  borderRadius: 8,
                  border: '1px solid rgba(0,71,171,0.2)',
                  fontSize: 11,
                  color: '#6B9FFF',
                  fontFamily: 'Inter Tight',
                }}
              >
                Cotización: <strong>{selectedQuote.businessName}</strong>
                {` · ${getQuotePlanLabel(selectedQuote)}`}
              </div>
            )}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, negocio, email o dominio..."
              autoFocus
              style={{
                width: '100%',
                background: 'var(--surface-2)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                fontFamily: 'Inter Tight',
                fontSize: 13,
                color: 'var(--text)',
                outline: 'none',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {filteredClients.length === 0 ? (
                <div
                  style={{
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: 18,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontFamily: 'Inter Tight', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                    No hay clientes para seleccionar
                  </div>
                  <div style={{ marginTop: 4, fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)' }}>
                    Crea el cliente en su drawer para mantener el flujo de datos completo.
                  </div>
                </div>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: 12,
                      padding: '12px 14px',
                      background: 'var(--surface-2)',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                      transition: 'border-color 0.15s, transform 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255,140,0,0.34)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', fontFamily: 'Inter Tight' }}>
                        {client.fullName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--amber)', fontFamily: 'Inter Tight', marginTop: 2 }}>
                        {client.businessName}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'Inter Tight', marginTop: 6 }}>
                        {client.email}
                        {client.currentUrl ? ` · ${client.currentUrl}` : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          color: client.whatsapp ? '#5DD69C' : 'var(--text-3)',
                          background: client.whatsapp ? 'rgba(93,214,156,0.1)' : 'rgba(255,255,255,0.05)',
                          borderRadius: 999,
                          padding: '3px 7px',
                          fontFamily: 'Inter Tight',
                          fontWeight: 600,
                        }}
                      >
                        {client.whatsapp ? 'WhatsApp listo' : 'Sin WhatsApp'}
                      </span>
                      <span style={{ fontSize: 16, color: 'var(--text-3)' }}>→</span>
                    </div>
                  </button>
                ))
              )}
              <Link
                href={newClientHref}
                style={{
                  display: 'block',
                  fontSize: selectedQuote ? 13 : 12,
                  color: selectedQuote ? '#121212' : 'var(--text-3)',
                  background: selectedQuote ? 'var(--amber)' : 'transparent',
                  fontFamily: 'Inter Tight',
                  textDecoration: 'none',
                  padding: selectedQuote ? '9px 12px' : '8px 0',
                  textAlign: 'center',
                  borderRadius: 8,
                  fontWeight: selectedQuote ? 700 : 500,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!selectedQuote) {
                    (e.currentTarget as HTMLAnchorElement).style.color = 'var(--amber)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.color = selectedQuote ? '#121212' : 'var(--text-3)';
                }}
              >
                {selectedQuote ? '+ Crear cliente con datos de la cotización' : '+ Crear nuevo cliente'}
              </Link>
            </div>
          </div>
        )}

        {step === 'form' && selectedClient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--surface-2)',
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 12,
                fontFamily: 'Inter Tight',
              }}
            >
              <span style={{ color: 'var(--text-3)' }}>Cliente: </span>
              <strong style={{ color: 'var(--text)' }}>{selectedClient.fullName}</strong>
              <span style={{ color: 'var(--text-3)' }}> - {selectedClient.businessName}</span>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'Inter Tight' }}>
                Plan <span style={{ color: 'var(--amber)' }}>*</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['BASIC', 'PRO', 'BUSINESS', 'LEGACY', 'PORTFOLIO'] as UIPlan[]).map((planOption) => (
                  <button
                    key={planOption}
                    type="button"
                    onClick={() => handlePlanChange(planOption)}
                    style={{
                      flex: 1,
                      padding: '7px 4px',
                      borderRadius: 7,
                      border: plan === planOption ? '1px solid rgba(255,140,0,0.5)' : '1px solid var(--border)',
                      background: plan === planOption ? 'rgba(255,140,0,0.1)' : 'var(--surface-2)',
                      color: plan === planOption ? 'var(--amber)' : 'var(--text-3)',
                      fontFamily: 'Inter Tight',
                      fontWeight: 600,
                      fontSize: 10,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {planOption === 'PORTFOLIO' ? 'Portfolio' : planOption}
                  </button>
                ))}
              </div>
              {plan === 'PORTFOLIO' && (
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, fontFamily: 'Inter Tight' }}>
                  $0 · sin PayPal · sin SLA · no cuenta en MRR
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'Inter Tight' }}>
                  Dominio objetivo
                </div>
                <input
                  type="text"
                  value={domainTarget}
                  onChange={(e) => setDomainTarget(e.target.value)}
                  placeholder="negocio.com"
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: 'none',
                    borderRadius: 7,
                    padding: '8px 10px',
                    fontFamily: 'Inter Tight',
                    fontSize: 13,
                    color: 'var(--text)',
                    outline: 'none',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
                  }}
                />
              </div>
              <div />
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'Inter Tight' }}>
                  Precio mensual ($)
                </div>
                <input
                  type="number"
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(e.target.value)}
                  min="0"
                  step="1"
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: 'none',
                    borderRadius: 7,
                    padding: '8px 10px',
                    fontFamily: 'Inter Tight',
                    fontSize: 13,
                    color: 'var(--text)',
                    outline: 'none',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'Inter Tight' }}>
                  Setup fee ($)
                </div>
                <input
                  type="number"
                  value={setupFee}
                  onChange={(e) => setSetupFee(e.target.value)}
                  min="0"
                  step="1"
                  style={{
                    width: '100%',
                    background: 'var(--surface-2)',
                    border: 'none',
                    borderRadius: 7,
                    padding: '8px 10px',
                    fontFamily: 'Inter Tight',
                    fontSize: 13,
                    color: 'var(--text)',
                    outline: 'none',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, fontFamily: 'Inter Tight' }}>
                Notas internas
              </div>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Notas iniciales del proyecto..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--surface-2)',
                  border: 'none',
                  borderRadius: 7,
                  padding: '8px 10px',
                  fontFamily: 'Inter Tight',
                  fontSize: 13,
                  color: 'var(--text)',
                  outline: 'none',
                  resize: 'vertical',
                  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
                }}
              />
            </div>

            {error && (
              <p style={{ fontSize: 12, color: '#FF6B6B', fontFamily: 'Inter Tight', margin: 0 }}>{error}</p>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
              <button
                type="button"
                onClick={resetAndClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--surface-2)',
                  color: 'var(--text-2)',
                  fontFamily: 'Inter Tight',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--amber)',
                  color: '#121212',
                  fontFamily: 'Inter Tight',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'Creando...' : 'Crear proyecto'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' }}>
      <span style={{ fontSize: 10, fontFamily: 'Inter Tight', color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(128,128,128,0.15)' }} />
    </div>
  );
}

function formatShortDate(date: Date) {
  return new Date(date).toLocaleDateString('es-DO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
