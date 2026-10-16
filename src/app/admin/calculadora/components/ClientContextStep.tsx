'use client';
// ============================================================
// Paso 1 — Contexto del Cliente
// Toggle: Modo Prompt (brief libre) / Modo Form (campos)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import type { ClientContextInput, Niche } from '@/lib/calculadora/types';

interface Props {
  onNext: (data: ClientContextInput) => void;
  /** Si se pasa, pre-llena todo el formulario (usado por Modo Prueba) */
  initialData?: ClientContextInput | null;
  /** Callback en tiempo real para el panel derecho */
  onFormChange?: (form: ClientContextInput) => void;
}

const NICHES_GRID: { value: Niche; emoji: string; label: string }[] = [
  { value: 'salud', emoji: '🏥', label: 'Salud' },
  { value: 'legal', emoji: '⚖️', label: 'Legal' },
  { value: 'fitness', emoji: '💪', label: 'Fitness' },
  { value: 'gastronomia', emoji: '🍽️', label: 'Gastronomía' },
  { value: 'inmobiliaria', emoji: '🏠', label: 'Inmobiliaria' },
  { value: 'educacion', emoji: '📚', label: 'Educación' },
  { value: 'marca_personal', emoji: '🌟', label: 'Marca Personal' },
  { value: 'otro', emoji: '📦', label: 'Otro' },
];

const INITIAL_FORM: ClientContextInput = {
  clientName: '',
  businessName: '',
  clientEmail: '',
  clientPhone: '',
  niche: 'otro',
  domainTarget: '',
  hasDomain: false,
  projectType: 'legacy',
  numPages: 5,
  complexityLevel: 'standard',
  subscriptionPlan: undefined,
  includeSetupFee: true,
  contentStatus: 'partial',
  needsBooking: false,
  needsCatalog: false,
  needsCheckout: false,
  needsBlog: false,
  needsMembership: false,
  freeformBrief: '',
  inspirationLinks: '',
  inputMode: 'form',
};

// Bug 12: Feature → plan mínimo requerido
const FEATURE_MIN_PLAN: Record<string, 'basic' | 'pro' | 'business'> = {
  needsBooking: 'pro',
  needsCatalog: 'business',
  needsCheckout: 'business',
  needsMembership: 'business',
};
const PLAN_ORDER = ['basic', 'pro', 'business'];

export function ClientContextStep({ onNext, initialData, onFormChange }: Props) {
  const [mode, setMode] = useState<'form' | 'prompt'>('form');
  const [form, setForm] = useState<ClientContextInput>({ ...INITIAL_FORM, inputMode: mode });
  const [promptText, setPromptText] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof ClientContextInput, string>>>({});
  const [upgradeNotice, setUpgradeNotice] = useState<string | null>(null);
  const [contextOpen, setContextOpen] = useState(false);
  const onFormChangeRef = useRef(onFormChange);

  // Cuando el padre inyecta datos (modo prueba), sincronizamos el estado local
  useEffect(() => {
    if (!initialData) return;
    setForm({ ...initialData, inputMode: 'form' });
    setMode('form');
    setPromptText(initialData.freeformBrief ?? '');
    setErrors({});
  }, [initialData]);

  // Keep ref current so the effect below doesn't re-run when parent re-renders
  useEffect(() => { onFormChangeRef.current = onFormChange; });

  // Notify parent of form changes in real time (for right panel preview)
  useEffect(() => {
    onFormChangeRef.current?.(form);
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.clientName.trim()) newErrors.clientName = 'Requerido';
    if (!form.businessName.trim()) newErrors.businessName = 'Requerido';
    if (mode === 'prompt' && !promptText.trim()) {
      newErrors.freeformBrief = 'Escribe el brief del cliente';
    }
    if (form.clientEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail)) {
      newErrors.clientEmail = 'Email inválido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;

    const data: ClientContextInput = {
      ...form,
      freeformBrief: mode === 'prompt' ? promptText : form.freeformBrief,
      inputMode: mode,
      clientEmail: form.clientEmail,
      clientPhone: form.clientPhone,
      hasDomain: form.hasDomain,
    };
    onNext(data);
  }

  // Bug 12: handle feature checkbox change with auto-upgrade logic
  function handleFeatureChange(field: string, checked: boolean) {
    let updatedForm = { ...form, [field]: checked };

    if (checked && form.projectType === 'subscription') {
      const required = FEATURE_MIN_PLAN[field];
      if (required) {
        const currentIdx = PLAN_ORDER.indexOf(form.subscriptionPlan ?? 'basic');
        const requiredIdx = PLAN_ORDER.indexOf(required);
        if (currentIdx < requiredIdx) {
          updatedForm = { ...updatedForm, subscriptionPlan: required };
          const planLabel = required.toUpperCase();
          setUpgradeNotice(`Plan actualizado a ${planLabel} — requerido para esta funcionalidad`);
          setTimeout(() => setUpgradeNotice(null), 4000);
        }
      }
    }

    setForm(updatedForm);
  }

  // Bug 12: handle plan change with auto-downgrade of incompatible features
  function handlePlanChange(plan: 'basic' | 'pro' | 'business') {
    let updatedForm = { ...form, subscriptionPlan: plan };

    if (plan === 'basic') {
      updatedForm = { ...updatedForm, needsBooking: false, needsCatalog: false, needsCheckout: false, needsMembership: false };
    } else if (plan === 'pro') {
      updatedForm = { ...updatedForm, needsCatalog: false, needsCheckout: false, needsMembership: false };
    }
    setForm(updatedForm);
  }

  return (
    <div className="space-y-6">
      {/* Toggle de modo */}
      <div className="flex items-center gap-1 p-1 bg-white/8 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => {
            if (mode === 'prompt' && promptText.trim()) {
              setForm((f) => ({ ...f, inputMode: 'form', freeformBrief: promptText }));
            } else {
              setForm((f) => ({ ...f, inputMode: 'form' }));
            }
            setMode('form');
          }}
          className={`px-4 py-2 rounded-md text-sm font-['Inter_Tight'] font-medium transition-all ${
            mode === 'form'
              ? 'bg-[#FF8C00] text-[#121212] shadow'
              : 'text-[rgba(249,249,249,0.4)] hover:text-[rgba(249,249,249,0.6)]'
          }`}
        >
          Campos estructurados
        </button>
        <button
          type="button"
          onClick={() => {
            if (mode === 'form' && form.freeformBrief.trim() && !promptText.trim()) {
              setPromptText(form.freeformBrief);
            }
            setForm((f) => ({ ...f, inputMode: 'prompt' }));
            setMode('prompt');
          }}
          className={`px-4 py-2 rounded-md text-sm font-['Inter_Tight'] font-medium transition-all ${
            mode === 'prompt'
              ? 'bg-[#FF8C00] text-[#121212] shadow'
              : 'text-[rgba(249,249,249,0.4)] hover:text-[rgba(249,249,249,0.6)]'
          }`}
        >
          Brief libre (IA)
        </button>
      </div>

      {/* ── DATOS DEL CLIENTE (siempre visibles) ── */}
      <div>
        <p className="text-[9px] font-['Inter_Tight'] font-medium uppercase tracking-[.14em] text-[#FF8C00] mb-2">DATOS DEL CLIENTE</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
              Nombre del cliente *
            </label>
            <input
              type="text"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              placeholder="Ej: María González"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150"
            />
            {errors.clientName && <p className="mt-1 text-xs text-red-400">{errors.clientName}</p>}
          </div>

          <div>
            <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
              Nombre del negocio *
            </label>
            <input
              type="text"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              placeholder="Ej: Clínica Dra. González"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150"
            />
            {errors.businessName && <p className="mt-1 text-xs text-red-400">{errors.businessName}</p>}
          </div>
        </div>

        {/* Bug 4: Email y teléfono */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">Email del cliente</label>
            <input
              type="email"
              value={form.clientEmail ?? ''}
              onChange={(e) => {
                setForm({ ...form, clientEmail: e.target.value });
                if (e.target.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                  setErrors((prev) => ({ ...prev, clientEmail: 'Email inválido' }));
                } else {
                  setErrors((prev) => ({ ...prev, clientEmail: undefined }));
                }
              }}
              placeholder="cliente@ejemplo.com"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150"
            />
            {errors.clientEmail && <p className="mt-1 text-xs text-red-400">{errors.clientEmail}</p>}
          </div>
          <div>
            <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">Teléfono del cliente</label>
            <input
              type="tel"
              value={form.clientPhone ?? ''}
              onChange={(e) => setForm({ ...form, clientPhone: e.target.value })}
              placeholder="809-XXX-XXXX"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150"
            />
          </div>
        </div>
      </div>

      {/* Modo Prompt */}
      {mode === 'prompt' && (
        <div className="space-y-4">
          <div className="p-3 bg-[#0047AB]/10 rounded-lg border border-[#0047AB]/30">
            <p className="text-sm font-['Inter_Tight'] text-white/80">
              <strong className="text-white">Modo IA:</strong> Pega el mensaje del cliente o tus notas de la llamada. La IA identificará el niche, las funcionalidades y sugerirá los componentes.
            </p>
          </div>

          <div>
            <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
              Brief del cliente *
            </label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={8}
              placeholder="Ej: 'Hola, soy dentista y quiero una web donde mis pacientes puedan agendar citas. No tengo logo todavía pero sí tengo fotos. Me gustan sitios como...' — o pega tus notas de la llamada"
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150 font-['Inter_Tight']"
            />
            {errors.freeformBrief && (
              <p className="mt-1 text-xs text-red-400">{errors.freeformBrief}</p>
            )}
          </div>

          {/* Tipo de proyecto incluso en modo prompt */}
          <div className="grid grid-cols-2 gap-3">
            {(['legacy', 'subscription'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm({ ...form, projectType: type })}
                className={`p-3 border rounded-lg text-sm font-['Inter_Tight'] font-medium transition-all duration-200 ${
                  form.projectType === type
                    ? 'bg-[rgba(255,255,255,0.06)] border-[#FF8C00] ring-1 ring-[#FF8C00]/20 text-[#F9F9F9]'
                    : 'bg-[rgba(255,255,255,0.04)] border-white/10 text-[rgba(249,249,249,0.6)] hover:border-white/20 hover:bg-white/8 hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(0,0,0,.4)]'
                }`}
              >
                {type === 'legacy' ? 'Pago único (LEGACY)' : 'Suscripción mensual'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modo Form */}
      {mode === 'form' && (
        <div className="space-y-5">
          {/* ── TIPO DE PROYECTO ── */}
          <div className="border-t border-white/8 pt-5">
            <p className="text-[9px] font-['Inter_Tight'] font-medium uppercase tracking-[.14em] text-[#FF8C00] mb-2">TIPO DE PROYECTO</p>
            <div className="grid grid-cols-2 gap-3">
              {(['legacy', 'subscription'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm({ ...form, projectType: type })}
                  className={`p-3 border rounded-lg text-sm font-['Inter_Tight'] font-medium transition-all duration-200 text-left ${
                    form.projectType === type
                      ? 'bg-[rgba(255,255,255,0.06)] border-[#FF8C00] ring-1 ring-[#FF8C00]/20 text-[#F9F9F9]'
                      : 'bg-[rgba(255,255,255,0.04)] border-white/10 text-[rgba(249,249,249,0.6)] hover:border-white/20 hover:bg-white/8 hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(0,0,0,.4)]'
                  }`}
                >
                  <div className="font-semibold">
                    {type === 'legacy' ? 'Pago único' : 'Suscripción'}
                  </div>
                  <div className={`text-xs mt-1 ${form.projectType === type ? 'text-white/40' : 'text-[rgba(249,249,249,0.4)]'}`}>
                    {type === 'legacy' ? 'LEGACY — desde $1,500' : 'BASIC/PRO/BUSINESS'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Plan de suscripción (solo si subscription) */}
          {form.projectType === 'subscription' && (
            <div>
              <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-2">Plan</label>
              <div className="grid grid-cols-3 gap-2">
                {(['basic', 'pro', 'business'] as const).map((plan) => {
                  const prices = { basic: 49, pro: 89, business: 139 };
                  return (
                    <button
                      key={plan}
                      type="button"
                      onClick={() => handlePlanChange(plan)}
                      className={`p-3 border rounded-lg text-sm font-['Inter_Tight'] transition-all duration-200 ${
                        form.subscriptionPlan === plan
                          ? 'bg-[rgba(255,255,255,0.06)] border-[#FF8C00] ring-1 ring-[#FF8C00]/20 text-[#F9F9F9]'
                          : 'bg-[rgba(255,255,255,0.04)] border-white/10 text-[rgba(249,249,249,0.6)] hover:border-white/20 hover:bg-white/8 hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(0,0,0,.4)]'
                      }`}
                    >
                      <div className="font-bold font-['Clash_Grotesk'] text-[#FF8C00]">{plan.toUpperCase()}</div>
                      <div className="text-xs font-['Clash_Grotesk'] font-bold text-[#FF8C00]">${prices[plan]}/mes</div>
                      <div className="text-[10px] font-['Inter_Tight'] mt-1 text-white/40">
                        {plan === 'basic' ? 'Solo sitio informativo' : plan === 'pro' ? '+ Sistema de citas' : '+ Catálogo y checkout'}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Banner de upgrade (UX-9) */}
              {upgradeNotice && (
                <div className="mt-2 flex items-start gap-2 p-3 bg-[#0047AB]/10 border border-[#0047AB]/30 rounded-sm">
                  <span className="text-[9px] font-['Inter_Tight'] font-medium uppercase tracking-[.12em] text-[#0047AB] shrink-0">PLAN ACTUALIZADO</span>
                  <span className="text-sm font-['Inter_Tight'] text-white/80">{upgradeNotice}</span>
                </div>
              )}

              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.includeSetupFee ?? true}
                  onChange={(e) => setForm({ ...form, includeSetupFee: e.target.checked })}
                  className="rounded border-white/20 bg-transparent focus:ring-[#FF8C00]"
                />
                <span className="text-sm font-['Inter_Tight'] text-white/80">Incluir Setup Fee (+$50)</span>
              </label>
            </div>
          )}

          {/* ── DETALLE DEL PROYECTO ── */}
          <div className="border-t border-white/8 pt-5">
            <p className="text-[9px] font-['Inter_Tight'] font-medium uppercase tracking-[.14em] text-[#FF8C00] mb-2">DETALLE DEL PROYECTO</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Niche — emoji cards */}
              <div className="md:col-span-2">
                <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-2">Niche</label>
                <div className="grid grid-cols-4 gap-2">
                  {NICHES_GRID.map((n) => (
                    <button key={n.value} type="button"
                      onClick={() => setForm({ ...form, niche: n.value as Niche })}
                      className={`p-2.5 rounded-lg border-2 text-center transition-all duration-150 ${
                        form.niche === n.value
                          ? 'border-[#FF8C00] bg-[rgba(255,140,0,0.1)]'
                          : 'border-white/10 bg-white/4 hover:border-white/20 hover:bg-white/8'
                      }`}
                    >
                      <div className="text-xl mb-1">{n.emoji}</div>
                      <div className={`text-[10px] font-['Inter_Tight'] font-medium leading-tight ${
                        form.niche === n.value ? 'text-[#FF8C00]' : 'text-white/60'
                      }`}>{n.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bug 1: Dominio — checkbox + inputs condicionales */}
              <div>
                <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">Dominio</label>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={form.hasDomain ?? false}
                    onChange={(e) => setForm({ ...form, hasDomain: e.target.checked, domainTarget: '' })}
                    className="rounded border-white/20 bg-transparent focus:ring-[#FF8C00]"
                  />
                  <span className="text-sm font-['Inter_Tight'] text-white/80">El cliente ya tiene dominio propio</span>
                </label>
                {form.hasDomain ? (
                  <input
                    type="text"
                    value={form.domainTarget ?? ''}
                    onChange={(e) => setForm({ ...form, domainTarget: e.target.value })}
                    placeholder="ej: clinicagonzalez.com"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150"
                  />
                ) : (
                  <input
                    type="text"
                    value={form.domainTarget ?? ''}
                    onChange={(e) => setForm({ ...form, domainTarget: e.target.value })}
                    placeholder="ej: clinicagonzalez.com (comprará)"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Solo LEGACY: páginas y complejidad */}
          {form.projectType === 'legacy' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
                  Número de páginas estimado
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.numPages ?? 5}
                  onChange={(e) => setForm({ ...form, numPages: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150"
                />
                <p className="mt-1 text-xs text-[rgba(249,249,249,0.4)]">Las primeras 5 páginas están incluidas en la base</p>
              </div>

              <div>
                <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-2">
                  Complejidad visual
                </label>
                <div className="space-y-1">
                  {[
                    { value: 'standard', label: 'Estándar ×1.0', desc: 'Layouts limpios' },
                    { value: 'premium', label: 'Premium ×1.30', desc: 'Animaciones, layouts asimétricos' },
                    { value: 'ultra_premium', label: 'Ultra-Premium ×1.50', desc: 'Scroll storytelling, micro-interacciones' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="complexity"
                        value={opt.value}
                        checked={form.complexityLevel === opt.value}
                        onChange={() => setForm({ ...form, complexityLevel: opt.value as typeof form.complexityLevel })}
                        className="mt-0.5 accent-[#FF8C00]"
                      />
                      <span>
                        <span className="text-sm font-['Inter_Tight'] font-medium text-white/80">{opt.label}</span>
                        <span className="text-xs text-[rgba(249,249,249,0.4)] ml-2">{opt.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Estado del contenido */}
          <div>
            <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-2">Estado del contenido</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'ready', label: 'Tiene todo', desc: 'Textos, logos, fotos' },
                { value: 'partial', label: 'Tiene algo', desc: 'Falta completar' },
                { value: 'none', label: 'No tiene nada', desc: 'Necesita copywriting' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, contentStatus: opt.value as typeof form.contentStatus })}
                  className={`p-3 border rounded-lg text-sm font-['Inter_Tight'] transition-all duration-200 text-left ${
                    form.contentStatus === opt.value
                      ? 'bg-[rgba(255,255,255,0.06)] border-[#FF8C00] ring-1 ring-[#FF8C00]/20 text-[#F9F9F9]'
                      : 'bg-[rgba(255,255,255,0.04)] border-white/10 text-[rgba(249,249,249,0.6)] hover:border-white/20 hover:bg-white/8 hover:translate-y-[-2px] hover:shadow-[0_8px_20px_rgba(0,0,0,.4)]'
                  }`}
                >
                  <div className="font-medium">{opt.label}</div>
                  <div className={`text-xs mt-0.5 ${form.contentStatus === opt.value ? 'text-white/40' : 'text-[rgba(249,249,249,0.4)]'}`}>
                    {opt.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Funcionalidades críticas */}
          <div>
            <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-2">
              Funcionalidades críticas (marca las que apliquen)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {[
                { field: 'needsBooking', label: 'Citas online', hint: '→ Plan PRO' },
                { field: 'needsCatalog', label: 'Catálogo/Menú', hint: '→ Plan BUSINESS' },
                { field: 'needsCheckout', label: 'Checkout/Venta', hint: '→ BUSINESS + e-com' },
                { field: 'needsBlog', label: 'Blog/Noticias', hint: '→ Add-on blog' },
                { field: 'needsMembership', label: 'Área miembros', hint: '→ Módulo membresía' },
              ].map((item) => (
                <label key={item.field} className="flex items-start gap-2 cursor-pointer p-3 border border-white/10 rounded-lg bg-white/5 hover:border-white/20 hover:bg-white/8 transition-all duration-150">
                  <input
                    type="checkbox"
                    checked={form[item.field as keyof ClientContextInput] as boolean}
                    onChange={(e) => handleFeatureChange(item.field, e.target.checked)}
                    className="mt-0.5 rounded border-white/20 bg-transparent accent-[#FF8C00]"
                  />
                  <span>
                    <span className="text-sm font-['Inter_Tight'] font-medium text-white/80">{item.label}</span>
                    {(form.projectType === 'subscription' || !['→ Plan PRO', '→ Plan BUSINESS', '→ BUSINESS + e-com'].includes(item.hint)) && (
                      <span className="block text-xs text-[rgba(249,249,249,0.4)]">{item.hint}</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ── CONTEXTO ADICIONAL — accordion colapsado ── */}
          <div className="border-t border-white/8 pt-5">
            <button
              type="button"
              onClick={() => setContextOpen((o) => !o)}
              className="flex items-center justify-between w-full mb-3"
            >
              <p className="text-[9px] font-['Inter_Tight'] font-medium uppercase tracking-[.14em] text-[#FF8C00]">
                CONTEXTO ADICIONAL — mejora la precisión de la IA
              </p>
              <span className={`text-white/40 text-xs transition-transform duration-200 ${contextOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {contextOpen && (
              <div className="space-y-4">
                {/* Brief libre */}
                <div>
                  <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
                    Contexto adicional / Brief libre
                    <span className="ml-2 text-xs text-white/30 font-normal">(la IA usará este texto para ajustar sugerencias)</span>
                  </label>
                  <textarea
                    value={form.freeformBrief}
                    onChange={(e) => setForm({ ...form, freeformBrief: e.target.value })}
                    rows={4}
                    placeholder="Detalles adicionales del proyecto, requerimientos especiales, ideas del cliente..."
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150"
                  />
                </div>

                {/* Links de inspiración */}
                <div>
                  <label className="block text-sm font-['Inter_Tight'] font-medium text-white/60 mb-1">
                    Links de inspiración / referencia
                  </label>
                  <textarea
                    value={form.inspirationLinks ?? ''}
                    onChange={(e) => setForm({ ...form, inspirationLinks: e.target.value })}
                    rows={2}
                    placeholder="https://ejemplo.com, https://otro.com"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm font-['Inter_Tight'] text-[#F9F9F9] placeholder-white/30 focus:border-[#FF8C00] focus:ring-[3px] focus:ring-[#FF8C00]/15 focus:outline-none transition-[border-color,box-shadow] duration-150 font-['Inter_Tight']"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-3 bg-[#FF8C00] text-[#121212] rounded-lg text-sm font-['Clash_Grotesk'] font-semibold hover:bg-[#E67E00] transition-all duration-200 hover:scale-[1.03] hover:shadow-[0_0_20px_rgba(255,140,0,.35)] active:scale-[0.98]"
        >
          Analizar con IA →
        </button>
      </div>
    </div>
  );
}
