'use client';

import { useMemo, useState } from 'react';
import { getManualPaymentOptions, registerManualPayment } from '../actions';

type LineType = 'setup_fee' | 'subscription' | 'maintenance' | 'ticket_addon' | 'legacy';

type PaymentLine = {
  id: string;
  type: LineType;
  sourceId: string;
  label: string;
  amount: string;
};

export type ManualPaymentProjectOption = {
  id: string;
  clientId: string;
  clientName: string;
  businessName: string;
  plan: string;
  status: string;
  monthlyPriceCents: number;
  setupFeeCents: number;
};

export type ManualPaymentQuoteOption = {
  id: string;
  clientName: string;
  businessName: string;
  status: string;
  projectType: 'subscription' | 'legacy';
  amountCents: number;
  plan: string | null;
};

export type ManualPaymentMaintenanceOption = {
  id: string;
  clientId: string;
  projectId: string | null;
  tier: string;
  amountCents: number;
  status: string;
};

export type ManualPaymentTicketOption = {
  id: string;
  projectId: string;
  ticketNumber: string;
  title: string;
  amountCents: number;
  status: string;
  addonName: string | null;
};

const SINGLE_LINE_TYPES: LineType[] = ['setup_fee', 'subscription', 'maintenance', 'legacy'];

function statusAfterPayment(status: string, lineTypes: LineType[]) {
  if (lineTypes.includes('setup_fee') && ['DRAFT', 'REQUIRES_REVIEW', 'PROPOSAL_SENT', 'PROPOSAL_EXPIRED'].includes(status)) {
    return 'PAYMENT_RECEIVED';
  }
  if (lineTypes.includes('subscription') && status === 'SUSPENDED') {
    return 'LIVE';
  }
  return null;
}

function dollars(cents: number) {
  return String(Math.round(cents / 100));
}

function money(amount: number) {
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function lineTypeLabel(type: LineType) {
  const labels: Record<LineType, string> = {
    setup_fee: 'Setup',
    subscription: 'Plan',
    maintenance: 'Mantenimiento',
    ticket_addon: 'Ticket / add-on',
    legacy: 'Legacy',
  };
  return labels[type];
}

type ManualPaymentModalProps = {
  projects: ManualPaymentProjectOption[];
  quotes: ManualPaymentQuoteOption[];
  maintenanceContracts: ManualPaymentMaintenanceOption[];
  tickets: ManualPaymentTicketOption[];
  onClose: () => void;
};

type ManualPaymentOptions = Omit<ManualPaymentModalProps, 'onClose'>;

export function ManualPaymentLauncher() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ManualPaymentOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function openModal() {
    setOpen(true);
    setError('');
    if (options || loading) return;

    setLoading(true);
    try {
      setOptions(await getManualPaymentOptions());
    } catch {
      setError('No pude cargar las opciones de cobro. Intenta abrirlo de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          background: 'var(--amber)',
          border: '1px solid var(--amber)',
          color: '#1A1206',
          borderRadius: 100,
          padding: '8px 15px',
          fontSize: 12,
          fontWeight: 800,
          fontFamily: 'Inter Tight',
          cursor: 'pointer',
        }}
      >
        + Registrar cobro manual
      </button>

      {open && options && (
        <ManualPaymentModal
          projects={options.projects}
          quotes={options.quotes}
          maintenanceContracts={options.maintenanceContracts}
          tickets={options.tickets}
          onClose={() => setOpen(false)}
        />
      )}

      {open && !options && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}>
          <div style={{ width: 'min(520px, 100%)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, boxShadow: '0 20px 80px rgba(0,0,0,0.35)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <div>
                <h2 style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: 20, color: 'var(--text)', margin: 0 }}>Registrar cobro manual</h2>
                <p style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-3)', margin: '6px 0 0' }}>
                  {error || 'Cargando clientes, proyectos y partidas cobrables...'}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={{ background: 'transparent', border: 0, color: 'var(--text-3)', fontFamily: 'Inter Tight', fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
            </div>
            <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
              {[1, 2, 3].map((item) => (
                <div key={item} style={{ height: 42, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', opacity: loading ? 0.72 : 0.45 }} />
              ))}
            </div>
            {error && (
              <button type="button" onClick={openModal} style={{ marginTop: 14, background: 'var(--amber)', border: '1px solid var(--amber)', color: '#1A1206', borderRadius: 8, padding: '8px 12px', fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                Reintentar
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ManualPaymentModal({
  projects,
  quotes,
  maintenanceContracts,
  tickets,
  onClose,
}: ManualPaymentModalProps) {
  const initialClientId = projects[0]?.clientId ?? '';
  const initialClientProjects = projects.filter((project) => project.clientId === initialClientId);
  const [clientId, setClientId] = useState(initialClientId);
  const [projectId, setProjectId] = useState(initialClientProjects.length === 1 ? initialClientProjects[0].id : '');
  const [quoteId, setQuoteId] = useState('');
  const [lines, setLines] = useState<PaymentLine[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const selectedProject = projects.find((project) => project.id === projectId) ?? null;

  const clientOptions = useMemo(() => {
    const byClient = new Map<string, { id: string; clientName: string; businessName: string; projectCount: number }>();
    projects.forEach((project) => {
      const existing = byClient.get(project.clientId);
      if (existing) {
        existing.projectCount += 1;
        return;
      }
      byClient.set(project.clientId, {
        id: project.clientId,
        clientName: project.clientName,
        businessName: project.businessName,
        projectCount: 1,
      });
    });
    return Array.from(byClient.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [projects]);

  const clientProjects = useMemo(
    () => projects.filter((project) => project.clientId === clientId),
    [clientId, projects],
  );

  const clientQuotes = useMemo(() => {
    const client = clientOptions.find((item) => item.id === clientId);
    if (!client) return [];
    const clientName = client.clientName.toLowerCase();
    const businessName = client.businessName.toLowerCase();
    return quotes.filter(
      (quote) =>
        quote.clientName.toLowerCase() === clientName ||
        quote.businessName.toLowerCase() === businessName,
    );
  }, [clientId, clientOptions, quotes]);

  const selectedQuote = quotes.find((quote) => quote.id === quoteId) ?? null;
  const projectMaintenance = useMemo(
    () => maintenanceContracts.filter((contract) => contract.clientId === clientId && (!contract.projectId || contract.projectId === projectId)),
    [clientId, maintenanceContracts, projectId],
  );
  const projectTickets = useMemo(
    () => tickets.filter((ticket) => ticket.projectId === projectId),
    [projectId, tickets],
  );

  const lineTypes = lines.map((line) => line.type);
  const nextStatus = selectedProject ? statusAfterPayment(selectedProject.status, lineTypes) : null;
  const total = lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const requiresConfirmation = Boolean(nextStatus);
  const canSubmit = Boolean(projectId) && lines.length > 0 && total > 0 && (!requiresConfirmation || confirmed);

  const input: React.CSSProperties = { width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', color: 'var(--text)', fontFamily: 'Inter Tight', fontSize: 13, outline: 'none' };
  const label: React.CSSProperties = { fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 };
  const addButton: React.CSSProperties = { border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', borderRadius: 8, padding: '8px 10px', fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 800 };

  function resetForClient(nextClientId: string) {
    const nextProjects = projects.filter((project) => project.clientId === nextClientId);
    setClientId(nextClientId);
    setProjectId(nextProjects.length === 1 ? nextProjects[0].id : '');
    setQuoteId('');
    setLines([]);
    setConfirmed(false);
  }

  function resetForProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    setQuoteId('');
    setLines([]);
    setConfirmed(false);
  }

  function addOrReplaceSingleLine(line: PaymentLine) {
    setLines((current) => [
      ...current.filter((item) => item.type !== line.type),
      line,
    ]);
    setConfirmed(false);
  }

  function addLine(type: LineType) {
    if (!selectedProject) return;
    const id = `${type}-${Date.now()}-${lines.length}`;
    if (type === 'setup_fee') {
      addOrReplaceSingleLine({
        id,
        type,
        sourceId: selectedProject.id,
        label: `Setup inicial · ${selectedProject.businessName}`,
        amount: dollars(selectedProject.setupFeeCents),
      });
      return;
    }
    if (type === 'subscription') {
      addOrReplaceSingleLine({
        id,
        type,
        sourceId: selectedProject.id,
        label: `Mensualidad ${selectedProject.plan}`,
        amount: dollars(selectedProject.monthlyPriceCents),
      });
      return;
    }
    if (type === 'maintenance') {
      addOrReplaceSingleLine({
        id,
        type,
        sourceId: projectMaintenance[0]?.id ?? '',
        label: projectMaintenance[0] ? `Mantenimiento ${projectMaintenance[0].tier}` : 'Mantenimiento manual',
        amount: projectMaintenance[0] ? dollars(projectMaintenance[0].amountCents) : '0',
      });
      return;
    }
    if (type === 'legacy') {
      addOrReplaceSingleLine({
        id,
        type,
        sourceId: selectedProject.id,
        label: `Legacy · ${selectedProject.businessName}`,
        amount: '0',
      });
      return;
    }

    const ticket = projectTickets[0];
    setLines((current) => [
      ...current,
      {
        id,
        type,
        sourceId: ticket?.id ?? '',
        label: ticket ? `${ticket.ticketNumber} · ${ticket.title}` : 'Ticket / add-on pendiente',
        amount: ticket ? dollars(ticket.amountCents) : '0',
      },
    ]);
    setConfirmed(false);
  }

  function applyQuotePrefill() {
    if (!selectedQuote || !selectedProject) return;
    const baseType: LineType = selectedQuote.projectType === 'legacy' ? 'legacy' : 'subscription';
    const labelText = selectedQuote.projectType === 'legacy'
      ? `Legacy · ${selectedQuote.businessName} · desde cotización`
      : `Plan ${selectedQuote.plan ?? selectedProject.plan} · desde cotización`;
    addOrReplaceSingleLine({
      id: `quote-prefill-${Date.now()}`,
      type: baseType,
      sourceId: selectedQuote.id,
      label: labelText,
      amount: dollars(selectedQuote.amountCents),
    });
  }

  function updateLine(id: string, patch: Partial<PaymentLine>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
    setConfirmed(false);
  }

  function updateSource(line: PaymentLine, sourceId: string) {
    if (line.type === 'ticket_addon') {
      const ticket = tickets.find((item) => item.id === sourceId);
      updateLine(line.id, {
        sourceId,
        label: ticket ? `${ticket.ticketNumber} · ${ticket.title}` : line.label,
        amount: ticket ? dollars(ticket.amountCents) : line.amount,
      });
      return;
    }
    if (line.type === 'maintenance') {
      const contract = maintenanceContracts.find((item) => item.id === sourceId);
      updateLine(line.id, {
        sourceId,
        label: contract ? `Mantenimiento ${contract.tier}` : line.label,
        amount: contract ? dollars(contract.amountCents) : line.amount,
      });
    }
  }

  function sourceOptions(line: PaymentLine) {
    if (line.type === 'ticket_addon') {
      return projectTickets.map((ticket) => ({ id: ticket.id, label: `${ticket.ticketNumber} · ${ticket.title} · ${ticket.status}`, amount: ticket.amountCents }));
    }
    if (line.type === 'maintenance') {
      return projectMaintenance.map((contract) => ({ id: contract.id, label: `${contract.tier} · ${contract.status}`, amount: contract.amountCents }));
    }
    return [];
  }

  function isDisabled(type: LineType) {
    if (!projectId) return true;
    return SINGLE_LINE_TYPES.includes(type) && lines.some((line) => line.type === type);
  }

  const serializedLines = JSON.stringify(lines.map((line) => ({
    type: line.type,
    sourceId: line.sourceId || null,
    label: line.label,
    amountCents: Math.round((Number(line.amount) || 0) * 100),
  })));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.62)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 50 }}>
      <form action={registerManualPayment} style={{ width: 'min(860px, 100%)', maxHeight: 'calc(100vh - 48px)', overflow: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 22, boxShadow: '0 20px 80px rgba(0,0,0,0.35)' }}>
        <input type="hidden" name="lineItems" value={serializedLines} />
        <input type="hidden" name="linkedQuoteId" value={quoteId} />
        <input type="hidden" name="totalAmount" value={String(total)} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h2 style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: 22, color: 'var(--text)', margin: 0 }}>Registrar cobro manual</h2>
            <p style={{ fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-3)', margin: '6px 0 0' }}>
              Primero define el contexto, luego agrega las partidas reales del recibo.
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 0, color: 'var(--text-3)', fontFamily: 'Inter Tight', fontSize: 13, cursor: 'pointer' }}>Cerrar</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <label style={label}>Cliente
            <select name="clientId" value={clientId} onChange={(event) => resetForClient(event.target.value)} required style={input}>
              {clientOptions.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.clientName} · {client.businessName}
                </option>
              ))}
            </select>
          </label>
          <label style={label}>Proyecto / sitio
            <select name="projectId" value={projectId} onChange={(event) => resetForProject(event.target.value)} required disabled={!clientId} style={{ ...input, opacity: clientId ? 1 : 0.62, cursor: clientId ? 'pointer' : 'not-allowed' }}>
              {clientProjects.length !== 1 && <option value="">Seleccionar proyecto o sitio...</option>}
              {clientProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.businessName} · {project.plan} · {project.status}
                </option>
              ))}
            </select>
            {clientProjects.length === 1 && <span style={{ color: 'var(--text-3)', fontSize: 11 }}>Autoseleccionado porque este cliente solo tiene un proyecto cobrable.</span>}
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end', background: 'rgba(255,140,0,0.07)', border: '1px solid rgba(255,140,0,0.18)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <label style={label}>Vincular cotización existente
            <select value={quoteId} onChange={(event) => setQuoteId(event.target.value)} disabled={!projectId || clientQuotes.length === 0} style={{ ...input, opacity: projectId && clientQuotes.length > 0 ? 1 : 0.62 }}>
              <option value="">Sin cotización vinculada</option>
              {clientQuotes.map((quote) => (
                <option key={quote.id} value={quote.id}>
                  {quote.businessName} · {quote.projectType} · {money(quote.amountCents / 100)}
                </option>
              ))}
            </select>
            <span style={{ color: 'var(--text-3)', fontSize: 11 }}>
              La cotización solo rellena y documenta el cobro; no es una partida adicional.
            </span>
          </label>
          <button type="button" onClick={applyQuotePrefill} disabled={!selectedQuote || !projectId} style={{ ...addButton, height: 38, opacity: selectedQuote && projectId ? 1 : 0.55, cursor: selectedQuote && projectId ? 'pointer' : 'not-allowed' }}>
            Usar cotización
          </button>
        </div>

        <div style={{ background: 'rgba(107,159,255,0.07)', border: '1px solid rgba(107,159,255,0.16)', borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: 'Inter Tight', fontWeight: 800, color: 'var(--text)', fontSize: 13 }}>Partidas del cobro</div>
              <div style={{ fontFamily: 'Inter Tight', color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
                Agrega solo conceptos cobrables. Los tickets/add-ons vienen de trabajos existentes pendientes de pago.
              </div>
            </div>
            <div style={{ fontFamily: 'Clash Grotesk', fontWeight: 800, fontSize: 24, color: 'var(--amber)' }}>{money(total)}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 6, marginBottom: 10 }}>
            {(['setup_fee', 'subscription', 'maintenance', 'ticket_addon', 'legacy'] as LineType[]).map((type) => (
              <button key={type} type="button" disabled={isDisabled(type)} onClick={() => addLine(type)} style={{ ...addButton, opacity: isDisabled(type) ? 0.52 : 1, cursor: isDisabled(type) ? 'not-allowed' : 'pointer' }}>
                + {lineTypeLabel(type)}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lines.length === 0 && (
              <div style={{ padding: '14px 12px', border: '1px dashed var(--border)', borderRadius: 10, color: 'var(--text-3)', fontFamily: 'Inter Tight', fontSize: 12, textAlign: 'center' }}>
                Selecciona el cliente/proyecto y agrega al menos una partida.
              </div>
            )}
            {lines.map((line) => {
              const options = sourceOptions(line);
              const needsSource = line.type === 'ticket_addon' || line.type === 'maintenance';
              return (
                <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '112px 1fr 120px 32px', gap: 8, alignItems: 'center', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }}>
                  <span style={{ fontFamily: 'Inter Tight', fontSize: 11, fontWeight: 800, color: 'var(--amber)' }}>{lineTypeLabel(line.type)}</span>
                  {needsSource ? (
                    <select value={line.sourceId} onChange={(event) => updateSource(line, event.target.value)} style={input}>
                      <option value="">{line.type === 'ticket_addon' ? 'Seleccionar ticket/add-on...' : 'Seleccionar contrato...'}</option>
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label} · {money(option.amount / 100)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input value={line.label} onChange={(event) => updateLine(line.id, { label: event.target.value })} style={input} />
                  )}
                  <input type="number" min="0" step="1" value={line.amount} onChange={(event) => updateLine(line.id, { amount: event.target.value })} style={input} aria-label={`Precio ${lineTypeLabel(line.type)}`} />
                  <button type="button" onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))} style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', borderRadius: 8, height: 36, cursor: 'pointer' }}>
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <label style={label}>Metodo
            <select name="method" required defaultValue="Transferencia bancaria" style={input}>
              <option value="Transferencia bancaria">Transferencia bancaria</option>
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta">Tarjeta</option>
              <option value="PayPal manual">PayPal manual</option>
              <option value="Otro">Otro metodo documentado</option>
            </select>
          </label>
          <label style={label}>Fecha<input name="paidAt" required type="date" defaultValue={new Date().toISOString().slice(0, 10)} style={input} /></label>
          <label style={label}>Referencia<input name="reference" placeholder="Transfer ID, recibo, nota" style={input} /></label>
          <label style={{ ...label, gridColumn: 'span 2' }}>Notas<textarea name="notes" rows={3} placeholder="Contexto interno: quién confirmó, banco, acuerdo, excepción..." style={{ ...input, resize: 'vertical' }} /></label>
        </div>

        <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: nextStatus ? 'rgba(255,140,0,0.08)' : 'rgba(107,159,255,0.07)', border: `1px solid ${nextStatus ? 'rgba(255,140,0,0.24)' : 'rgba(107,159,255,0.18)'}` }}>
          <div style={{ fontFamily: 'Inter Tight', fontSize: 12, color: nextStatus ? 'var(--amber)' : '#6B9FFF', fontWeight: 800, marginBottom: 4 }}>
            {nextStatus ? 'Este cobro moverá el proyecto' : 'Este cobro quedará como pago documentado'}
          </div>
          <div style={{ fontFamily: 'Inter Tight', fontSize: 11, color: 'var(--text-3)', lineHeight: 1.45 }}>
            {selectedProject ? `${selectedProject.businessName}: ${selectedProject.status}${nextStatus ? ` → ${nextStatus}` : ''}` : 'Selecciona un proyecto para ver el impacto.'}
          </div>
          {requiresConfirmation && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontFamily: 'Inter Tight', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
              <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
              Confirmo que este cobro debe actualizar el estado del proyecto.
            </label>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onClose} style={{ border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', borderRadius: 8, padding: '8px 12px', fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={!canSubmit} style={{ background: 'var(--amber)', border: '1px solid var(--amber)', color: '#1A1206', borderRadius: 8, padding: '8px 14px', fontFamily: 'Inter Tight', fontSize: 12, fontWeight: 800, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}>Guardar pago</button>
        </div>
      </form>
    </div>
  );
}
