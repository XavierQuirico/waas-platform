'use client';

import { useEffect, useMemo, useState } from 'react';
import { PackageOpen, ClipboardCheck, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { AssetRequirement } from '@/lib/assets/asset-requirements';
import { canSubmitForReview } from '@/lib/assets/asset-requirements';
import {
  getAssetProgress,
  getInitialActiveRequirementKey,
  isAssetRequirementComplete,
  validateAssetFile,
} from '@/lib/assets/asset-ui';
import type { MaterialAssetStatus } from '@/lib/portal/material-chips';
import type { ProjectAsset } from '@/db/schema/project-assets';
import { AssetRequirementItem } from './AssetRequirementItem';
import { AssetUploadPanel } from './AssetUploadPanel';

interface AssetChecklistProps {
  projectId: string;
  requirements: AssetRequirement[];
  assets: ProjectAsset[];
  projectStatus: string;
  plan: 'BASIC' | 'PRO' | 'BUSINESS';
}

/** Versión más relevante de un material entre todas las subidas para un requisito. */
function pickPrimaryAsset(assets: ProjectAsset[]): ProjectAsset | undefined {
  const newestFirst = [...assets].reverse();
  return (
    newestFirst.find((a) => a.status === 'uploaded') ??
    newestFirst.find((a) => a.status === 'under_review') ??
    newestFirst.find((a) => a.status === 'approved') ??
    newestFirst.find((a) => a.status === 'rejected') ??
    newestFirst.find((a) => a.status === 'pending') ??
    newestFirst[0]
  );
}

export function AssetChecklist({
  projectId,
  requirements,
  assets: initialAssets,
  projectStatus,
  plan,
}: AssetChecklistProps) {
  const [assets, setAssets] = useState<ProjectAsset[]>(initialAssets);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(
    projectStatus === 'ASSETS_SUBMITTED' || projectStatus === 'ASSETS_UNDER_REVIEW',
  );
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isReadOnly =
    projectStatus === 'ASSETS_SUBMITTED' || projectStatus === 'ASSETS_UNDER_REVIEW';

  const required = useMemo(() => requirements.filter((r) => r.required), [requirements]);
  const optional = useMemo(() => requirements.filter((r) => !r.required), [requirements]);

  const assetRecords = useMemo(
    () => assets.map((a) => ({ assetKey: a.assetKey, status: a.status })),
    [assets],
  );
  const progress = useMemo(
    () => getAssetProgress(requirements, assetRecords),
    [requirements, assetRecords],
  );

  // ── Selección del requisito activo (master-detail / accordion) ─────────────
  const [activeKey, setActiveKey] = useState<string | null>(() =>
    getInitialActiveRequirementKey(requirements, assetRecords),
  );

  // ── Estado transitorio del panel activo (elevado para que desktop y mobile
  //    compartan la misma fuente de verdad) ───────────────────────────────────
  const [urlMode, setUrlMode] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [textSaveError, setTextSaveError] = useState<string | null>(null);

  const activeReq = useMemo(
    () => requirements.find((r) => r.key === activeKey) ?? requirements[0] ?? null,
    [requirements, activeKey],
  );

  // Al cambiar de requisito, reinicia el panel y prerellena texto/enlace guardado.
  useEffect(() => {
    if (!activeReq) return;
    const records = assets.filter((a) => a.assetKey === activeReq.key);
    setUrlMode(false);
    setUploadError(null);
    setTextSaveError(null);
    setDraftText(pickPrimaryAsset(records)?.textValue ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  function handleAssetUpdate(updated: ProjectAsset) {
    setAssets((prev) =>
      prev.some((a) => a.id === updated.id)
        ? prev.map((a) => (a.id === updated.id ? updated : a))
        : [...prev, updated],
    );
  }

  // ── Red: subir archivo (3 pasos R2) ────────────────────────────────────────
  async function uploadFile(req: AssetRequirement, file: File) {
    const err = validateAssetFile(file, req.formats);
    if (err) { setUploadError(err); return; }

    setUploadError(null);
    setIsUploading(true);
    try {
      const urlRes = await fetch('/api/trpc/assets.getUploadUrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            projectId,
            assetKey: req.key,
            mimeType: file.type,
            fileSize: file.size,
            fileIndex: assets.filter((a) => a.assetKey === req.key).length,
          },
        }),
      });
      if (!urlRes.ok) throw new Error('No se pudo preparar la subida. Intenta de nuevo.');

      const urlData = (await urlRes.json())?.result?.data?.json;
      if (!urlData?.uploadUrl || !urlData?.r2Key || !urlData?.assetId) {
        throw new Error('Respuesta inesperada del servidor. Intenta de nuevo.');
      }
      const { uploadUrl, r2Key, assetId } = urlData;

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadRes.ok) throw new Error('No se pudo subir el archivo. Intenta de nuevo.');

      const confirmRes = await fetch('/api/trpc/assets.confirmUpload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { assetId, r2Key, originalName: file.name } }),
      });
      if (!confirmRes.ok) {
        throw new Error('El archivo se subió pero no se pudo confirmar. Intenta de nuevo.');
      }

      const confirmedAsset = (await confirmRes.json())?.result?.data?.json?.asset;
      if (!confirmedAsset) throw new Error('Respuesta inesperada al confirmar. Intenta de nuevo.');

      handleAssetUpdate(confirmedAsset);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error al subir el archivo. Intenta de nuevo.');
    } finally {
      setIsUploading(false);
    }
  }

  // ── Red: guardar texto / enlace ────────────────────────────────────────────
  async function saveText(req: AssetRequirement) {
    if (!draftText.trim()) return;
    setTextSaveError(null);
    try {
      const res = await fetch('/api/trpc/assets.saveTextValue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: { projectId, assetKey: req.key, textValue: draftText.trim() },
        }),
      });
      if (!res.ok) throw new Error();
      const { result } = await res.json();
      handleAssetUpdate(result.data.json.asset);
    } catch {
      setTextSaveError('Error al guardar. Intenta de nuevo.');
    }
  }

  async function handleSubmitForReview() {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/trpc/assets.submitForReview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { projectId } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? 'Error al enviar materiales. Intenta de nuevo.');
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error inesperado. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Derivados de presentación por requisito ────────────────────────────────
  function metaFor(req: AssetRequirement) {
    const records = assets.filter((a) => a.assetKey === req.key);
    const primary = pickPrimaryAsset(records);
    const status = (primary?.status ?? 'pending') as MaterialAssetStatus;
    const complete = isAssetRequirementComplete(req, assetRecords);
    const canUpload =
      !isReadOnly &&
      status !== 'approved' &&
      (projectStatus !== 'ASSETS_INCOMPLETE' || status === 'rejected');
    return { records, primary, status, complete, canUpload };
  }

  const canSubmit =
    !isReadOnly &&
    !submitted &&
    canSubmitForReview(plan, assetRecords);

  const missingRequired = required.filter((r) => !isAssetRequirementComplete(r, assetRecords));

  // ── Estado enviado / en revisión ───────────────────────────────────────────
  if (submitted) {
    return (
      <div className="space-y-5">
        <PackageHeader progress={progress} status="review" />
        <div
          className="flex items-start gap-3 rounded-xl border p-5"
          style={{ borderColor: 'rgba(212,184,255,0.22)', background: 'rgba(212,184,255,0.06)' }}
        >
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" style={{ color: '#D4B8FF' }} aria-hidden="true" />
          <div>
            <p className="font-semibold" style={{ color: '#D4B8FF', fontFamily: 'var(--font-display)' }}>
              Materiales enviados a Xavier
            </p>
            <p className="mt-1 text-sm" style={{ color: 'rgba(249,249,249,0.45)' }}>
              Recibirás un email cuando todo esté confirmado. Si algo necesita corrección, te
              avisaremos con instrucciones claras.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderPanel = (req: AssetRequirement) => {
    const { records, status, canUpload, primary } = metaFor(req);
    return (
      <AssetUploadPanel
        requirement={req}
        assets={records}
        status={status}
        canUpload={canUpload}
        rejectionComment={primary?.rejectionComment ?? null}
        urlMode={urlMode}
        draftText={draftText}
        isUploading={isUploading}
        uploadError={uploadError}
        textSaveError={textSaveError}
        onUrlMode={setUrlMode}
        onDraftTextChange={setDraftText}
        onFile={(file) => uploadFile(req, file)}
        onSaveText={() => saveText(req)}
      />
    );
  };

  return (
    <div className="space-y-5">
      <PackageHeader progress={progress} status={isReadOnly ? 'locked' : 'editable'} />

      {/* ── Desktop: master-detail (lista + panel activo) ─────────────────── */}
      <div className="hidden lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start lg:gap-5">
        <div className="space-y-5">
          <RequirementGroup
            title="Requeridos"
            hint={`${progress.requiredComplete} de ${progress.requiredTotal} listos`}
          >
            {required.map((req) => {
              const { status, complete, canUpload } = metaFor(req);
              return (
                <AssetRequirementItem
                  key={req.key}
                  requirement={req}
                  status={status}
                  complete={complete}
                  canUpload={canUpload}
                  active={activeKey === req.key}
                  onSelect={() => setActiveKey(req.key)}
                />
              );
            })}
          </RequirementGroup>

          {optional.length > 0 && (
            <RequirementGroup title="Opcionales para mejorar tu sitio" muted>
              {optional.map((req) => {
                const { status, complete, canUpload } = metaFor(req);
                return (
                  <AssetRequirementItem
                    key={req.key}
                    requirement={req}
                    status={status}
                    complete={complete}
                    canUpload={canUpload}
                    active={activeKey === req.key}
                    onSelect={() => setActiveKey(req.key)}
                  />
                );
              })}
            </RequirementGroup>
          )}
        </div>

        <div
          className="lg:sticky lg:top-4 rounded-2xl border p-6"
          style={{ borderColor: 'rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)' }}
        >
          {activeReq ? renderPanel(activeReq) : null}
        </div>
      </div>

      {/* ── Mobile: accordion (un requisito expandido a la vez) ───────────── */}
      <div className="space-y-5 lg:hidden">
        <RequirementGroup
          title="Requeridos"
          hint={`${progress.requiredComplete} de ${progress.requiredTotal} listos`}
        >
          {required.map((req) => (
            <AccordionRow
              key={req.key}
              requirement={req}
              meta={metaFor(req)}
              active={activeKey === req.key}
              onToggle={() => setActiveKey(activeKey === req.key ? null : req.key)}
              renderPanel={renderPanel}
            />
          ))}
        </RequirementGroup>

        {optional.length > 0 && (
          <RequirementGroup title="Opcionales para mejorar tu sitio" muted>
            {optional.map((req) => (
              <AccordionRow
                key={req.key}
                requirement={req}
                meta={metaFor(req)}
                active={activeKey === req.key}
                onToggle={() => setActiveKey(activeKey === req.key ? null : req.key)}
                renderPanel={renderPanel}
              />
            ))}
          </RequirementGroup>
        )}
      </div>

      {/* ── Footer del paquete: enviar a revisión ─────────────────────────── */}
      {!isReadOnly && (
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: 'rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.02)' }}
        >
          {!canSubmit ? (
            <p className="mb-3 text-sm" style={{ color: 'rgba(249,249,249,0.5)' }}>
              {missingRequired.length > 0 ? (
                <>
                  Para enviar, falta completar:{' '}
                  <span style={{ color: '#FFB347', fontWeight: 600 }}>
                    {missingRequired.map((r) => r.label).join(', ')}
                  </span>
                  .
                </>
              ) : (
                'Completa todos los materiales requeridos para habilitar el envío.'
              )}
            </p>
          ) : (
            <p className="mb-3 text-sm" style={{ color: 'rgba(249,249,249,0.5)' }}>
              Todo listo. Al enviar, Xavier empezará a preparar tu sitio.
            </p>
          )}
          {submitError && (
            <p className="mb-3 text-sm" role="alert" style={{ color: '#F4A3A3' }}>
              {submitError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmitForReview}
            disabled={!canSubmit || isSubmitting}
            aria-disabled={!canSubmit || isSubmitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            style={{ background: '#FF8C00', color: '#121212', fontFamily: 'var(--font-body)' }}
          >
            {isSubmitting ? 'Enviando…' : 'Enviar materiales a revisión'}
            {!isSubmitting && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Cabecera del paquete con progreso ────────────────────────────────────────

function PackageHeader({
  progress,
  status,
}: {
  progress: ReturnType<typeof getAssetProgress>;
  status: 'editable' | 'review' | 'locked';
}) {
  const { requiredComplete, requiredTotal } = progress;
  const allReady = requiredComplete >= requiredTotal && requiredTotal > 0;
  const pct = requiredTotal === 0 ? 100 : Math.round((requiredComplete / requiredTotal) * 100);
  const accent = allReady ? '#5DD69C' : '#FF8C00';

  const explanation =
    status === 'review'
      ? 'Tus materiales están con Xavier. No necesitas hacer nada más por ahora.'
      : status === 'locked'
        ? 'Los materiales están cerrados para edición en esta etapa.'
        : 'Sube los materiales necesarios para que Xavier pueda preparar tu sitio.';

  return (
    <section
      className="rounded-2xl border p-5 sm:p-6"
      style={{ borderColor: 'rgba(255,255,255,0.09)', background: 'rgba(255,255,255,0.025)' }}
      aria-label="Paquete de materiales"
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: 'rgba(255,140,0,0.1)', color: '#FF8C00' }}
        >
          <PackageOpen size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h1
            className="text-xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}
          >
            Paquete de materiales
          </h1>
          <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            {explanation}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'rgba(249,249,249,0.7)' }}>
            {allReady ? (
              <CheckCircle2 size={13} style={{ color: '#5DD69C' }} aria-hidden="true" />
            ) : (
              <ClipboardCheck size={13} style={{ color: '#FFB347' }} aria-hidden="true" />
            )}
            {requiredComplete} de {requiredTotal} requeridos listos
          </span>
          {progress.optionalTotal > 0 && (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'rgba(249,249,249,0.35)' }}>
              <Sparkles size={11} aria-hidden="true" />
              {progress.optionalComplete}/{progress.optionalTotal} opcionales
            </span>
          )}
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Materiales requeridos: ${requiredComplete} de ${requiredTotal}`}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: accent }}
          />
        </div>
      </div>
    </section>
  );
}

// ─── Grupo de requisitos (requeridos / opcionales) ────────────────────────────

function RequirementGroup({
  title,
  hint,
  muted = false,
  children,
}: {
  title: string;
  hint?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h2
          className="text-xs font-semibold uppercase tracking-widest"
          style={{
            color: muted ? 'rgba(249,249,249,0.3)' : 'rgba(249,249,249,0.5)',
            fontFamily: 'var(--font-body)',
          }}
        >
          {title}
        </h2>
        {hint && (
          <span className="text-xs tabular-nums" style={{ color: 'rgba(249,249,249,0.35)' }}>
            {hint}
          </span>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

// ─── Fila accordion (mobile): item + panel inline ─────────────────────────────

function AccordionRow({
  requirement,
  meta,
  active,
  onToggle,
  renderPanel,
}: {
  requirement: AssetRequirement;
  meta: { status: MaterialAssetStatus; complete: boolean; canUpload: boolean };
  active: boolean;
  onToggle: () => void;
  renderPanel: (req: AssetRequirement) => React.ReactNode;
}) {
  return (
    <div>
      <AssetRequirementItem
        requirement={requirement}
        status={meta.status}
        complete={meta.complete}
        canUpload={meta.canUpload}
        active={active}
        onSelect={onToggle}
      />
      {active && (
        <div
          className="mt-2 rounded-xl border p-4"
          style={{ borderColor: 'rgba(255,140,0,0.2)', background: 'rgba(255,255,255,0.02)' }}
        >
          {renderPanel(requirement)}
        </div>
      )}
    </div>
  );
}
