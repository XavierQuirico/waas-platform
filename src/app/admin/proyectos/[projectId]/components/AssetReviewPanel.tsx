'use client';

// Panel 2 columnas: lista de assets (izquierda) + preview (derecha)
// Acciones: aprobar, rechazar con comentario inline
// Start Production: solo cuando TODOS los assets requeridos están approved

import { useState } from 'react';
import type { AssetRequirement } from '@/lib/assets/asset-requirements';
import type { ProjectAsset } from '@/db/schema/project-assets';

interface ProjectSummary {
  id: string;
  status: string;
  plan: string;
  productionDeadlineAt?: Date | null;
}

interface AssetReviewPanelProps {
  projectId: string;
  plan: 'BASIC' | 'PRO' | 'BUSINESS';
  requirements: AssetRequirement[];
  assets: ProjectAsset[];
  project: ProjectSummary;
  canReview: boolean;
}

const STATUS_CONFIG = {
  pending:      { label: 'Pendiente',   className: 'bg-gray-100 text-gray-500' },
  uploaded:     { label: 'Subido',      className: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'En revisión', className: 'bg-purple-100 text-purple-700' },
  approved:     { label: 'Aprobado ✓',  className: 'bg-green-100 text-green-700' },
  rejected:     { label: 'Rechazado',   className: 'bg-red-100 text-red-700' },
} as const;

type AssetStatus = keyof typeof STATUS_CONFIG;

export function AssetReviewPanel({
  projectId,
  requirements,
  assets: initialAssets,
  project,
  canReview,
}: AssetReviewPanelProps) {
  const [assets, setAssets] = useState<ProjectAsset[]>(initialAssets);
  const [selectedAsset, setSelectedAsset] = useState<ProjectAsset | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startingProduction, setStartingProduction] = useState(false);
  const [deployingStaging, setDeployingStaging] = useState(false);
  const [stagingUrl, setStagingUrl] = useState('');
  const [productionStarted, setProductionStarted] = useState(false);
  const [productionUrl, setProductionUrl] = useState('');
  const [markingLive, setMarkingLive] = useState(false);
  const [markedLive, setMarkedLive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Verifica si todos los assets requeridos están aprobados
  function allRequiredApproved(): boolean {
    return requirements.every((req) => {
      if (!req.required) return true;
      if (req.minCount) {
        const count = assets.filter(
          (a) => a.assetKey === req.key && a.status === 'approved'
        ).length;
        return count >= req.minCount;
      }
      return assets.some((a) => a.assetKey === req.key && a.status === 'approved');
    });
  }

  async function approve(assetId: string) {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/trpc/admin.reviewAsset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { assetId, action: 'approved' } }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setAssets((prev) =>
        prev.map((a) => (a.id === assetId ? { ...a, status: 'approved' as const } : a))
      );
    } catch {
      setActionError('No se pudo aprobar el asset. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitRejection(assetId: string) {
    if (!rejectComment.trim()) return;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/trpc/admin.reviewAsset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: { assetId, action: 'rejected', comment: rejectComment.trim() },
        }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? { ...a, status: 'rejected' as const, rejectionComment: rejectComment.trim() }
            : a
        )
      );
      setRejectingId(null);
      setRejectComment('');
    } catch {
      setActionError('No se pudo rechazar el asset. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStartProduction() {
    setStartingProduction(true);
    setActionError(null);
    try {
      const res = await fetch('/api/trpc/admin.startProduction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { projectId } }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setProductionStarted(true);
    } catch {
      setActionError('No se pudo iniciar producción. Intenta de nuevo.');
    } finally {
      setStartingProduction(false);
    }
  }

  async function handleDeployStaging() {
    if (!stagingUrl.trim()) return;
    setDeployingStaging(true);
    setActionError(null);
    try {
      const res = await fetch('/api/trpc/admin.deployToStaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { projectId, stagingUrl: stagingUrl.trim() } }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
    } catch {
      setActionError('No se pudo desplegar a staging. Intenta de nuevo.');
    } finally {
      setDeployingStaging(false);
    }
  }

  async function handleMarkLive() {
    if (!productionUrl.trim()) return;
    setMarkingLive(true);
    setActionError(null);
    try {
      const res = await fetch('/api/trpc/admin.markLive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ json: { projectId, productionUrl: productionUrl.trim() } }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setMarkedLive(true);
    } catch {
      setActionError('No se pudo marcar como LIVE. Intenta de nuevo.');
    } finally {
      setMarkingLive(false);
    }
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}
    <div className="flex gap-6">
      {/* Columna izquierda: lista de assets */}
      <div className="w-96 shrink-0 space-y-3">
        {requirements.map((req) => {
          const reqAssets = assets.filter((a) => a.assetKey === req.key);
          const primaryAsset = reqAssets[0];
          const status = (primaryAsset?.status ?? 'pending') as AssetStatus;
          const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;

          return (
            <div
              key={req.key}
              className={[
                'rounded-lg border p-3',
                status === 'approved'
                  ? 'border-green-200 bg-green-50'
                  : status === 'rejected'
                  ? 'border-red-200 bg-red-50'
                  : 'border-gray-200 bg-white',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">{req.label}</span>
                    {req.required && (
                      <span className="text-xs text-gray-400">Requerido</span>
                    )}
                  </div>

                  {req.minCount && reqAssets.length > 0 && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      {reqAssets.filter((a) => a.status !== 'pending').length} /{' '}
                      {req.minCount} mín
                    </p>
                  )}

                  {/* Comentario de rechazo */}
                  {primaryAsset?.rejectionComment && (
                    <p className="mt-1 text-xs text-red-600">
                      {primaryAsset.rejectionComment}
                    </p>
                  )}
                </div>

                <span
                  className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    config.className,
                  ].join(' ')}
                >
                  {config.label}
                </span>
              </div>

              {/* Archivos subidos */}
              {reqAssets.length > 0 && (
                <div className="mt-2 space-y-1">
                  {reqAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedAsset(asset)}
                        className="truncate text-xs text-blue-600 underline"
                      >
                        {asset.originalName || asset.textValue || `Archivo`}
                      </button>

                      {/* Acciones de revisión */}
                      {canReview && asset.status !== 'approved' && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => approve(asset.id)}
                            disabled={isSubmitting}
                            className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingId(asset.id);
                              setRejectComment('');
                            }}
                            disabled={isSubmitting}
                            className="rounded bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                          >
                            ✗
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea de rechazo inline */}
              {rejectingId &&
                reqAssets.some((a) => a.id === rejectingId) && (
                  <div className="mt-2">
                    <textarea
                      rows={2}
                      value={rejectComment}
                      onChange={(e) => setRejectComment(e.target.value)}
                      placeholder="¿Por qué se rechaza este asset?"
                      className="block w-full rounded border border-red-200 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
                    />
                    <div className="mt-1 flex gap-1">
                      <button
                        type="button"
                        onClick={() => submitRejection(rejectingId)}
                        disabled={!rejectComment.trim() || isSubmitting}
                        className="rounded bg-red-500 px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
                      >
                        Confirmar rechazo
                      </button>
                      <button
                        type="button"
                        onClick={() => setRejectingId(null)}
                        className="rounded px-3 py-1 text-xs text-gray-500 hover:bg-gray-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
            </div>
          );
        })}

        {/* Acciones principales */}
        <div className="space-y-2 pt-2">
          {/* Start Production */}
          {project.status === 'ASSETS_UNDER_REVIEW' && (
            <button
              type="button"
              onClick={handleStartProduction}
              disabled={!allRequiredApproved() || startingProduction || productionStarted}
              className="w-full rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {productionStarted
                ? '✓ Producción iniciada'
                : startingProduction
                ? 'Iniciando...'
                : 'Iniciar producción — el contador de 72h arranca ahora'}
            </button>
          )}
          {!allRequiredApproved() && project.status === 'ASSETS_UNDER_REVIEW' && (
            <p className="text-center text-xs text-amber-600">
              Aprueba todos los assets requeridos para habilitar este botón.
            </p>
          )}

          {/* Deploy to Staging */}
          {project.status === 'PRODUCTION_STARTED' && (
            <div className="space-y-2">
              <input
                type="url"
                value={stagingUrl}
                onChange={(e) => setStagingUrl(e.target.value)}
                placeholder="https://tu-cliente.vercel.app"
                className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                type="button"
                onClick={handleDeployStaging}
                disabled={!stagingUrl.trim() || deployingStaging}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {deployingStaging ? 'Desplegando...' : 'Desplegar a Staging →'}
              </button>
            </div>
          )}

          {/* Mark as LIVE — cuando el cliente aprobó en STAGING_REVIEW, o cuando Xavier decide publicar */}
          {(project.status === 'STAGING_REVIEW' || project.status === 'REVISIONS_DONE') && (
            <div className="space-y-2">
              {markedLive ? (
                <p className="rounded-lg bg-green-50 p-3 text-center text-sm text-green-700 font-medium">
                  ✓ Sitio marcado como LIVE
                </p>
              ) : (
                <>
                  <input
                    type="url"
                    value={productionUrl}
                    onChange={(e) => setProductionUrl(e.target.value)}
                    placeholder="https://dominio-cliente.com"
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button
                    type="button"
                    onClick={handleMarkLive}
                    disabled={!productionUrl.trim() || markingLive}
                    className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    {markingLive ? 'Publicando...' : '🎉 Marcar como LIVE →'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Re-desplegar a staging — durante REVISIONS */}
          {project.status === 'REVISIONS' && (
            <div className="space-y-2">
              <p className="text-xs text-amber-600">
                El cliente solicitó cambios. Cuando los apliques, re-despliega a staging para una nueva revisión.
              </p>
              <input
                type="url"
                value={stagingUrl}
                onChange={(e) => setStagingUrl(e.target.value)}
                placeholder="Nueva URL de staging..."
                className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
              <button
                type="button"
                onClick={handleDeployStaging}
                disabled={!stagingUrl.trim() || deployingStaging}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {deployingStaging ? 'Re-desplegando...' : 'Re-desplegar a staging →'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Columna derecha: preview del asset seleccionado */}
      <div className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-4">
        {selectedAsset ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700">
                {selectedAsset.originalName ?? selectedAsset.textValue ?? 'Preview'}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✕ Cerrar
              </button>
            </div>

            {/* Preview de imagen */}
            {selectedAsset.mimeType?.startsWith('image/') && selectedAsset.r2Key ? (
              <div className="flex items-center justify-center">
                <img
                  src={`/api/asset-proxy?key=${encodeURIComponent(selectedAsset.r2Key)}`}
                  alt={selectedAsset.originalName ?? ''}
                  className="max-h-[500px] max-w-full rounded-lg object-contain"
                />
              </div>
            ) : selectedAsset.textValue ? (
              /* Preview de texto/URL */
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <p className="break-all text-sm text-gray-700">{selectedAsset.textValue}</p>
                {selectedAsset.textValue.startsWith('http') && (
                  <a
                    href={selectedAsset.textValue}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-blue-600 underline"
                  >
                    Abrir enlace →
                  </a>
                )}
              </div>
            ) : selectedAsset.r2Key ? (
              /* Enlace de descarga para PDFs/DOCx */
              <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
                <p className="mb-3 text-sm text-gray-500">
                  {selectedAsset.mimeType ?? 'Documento'}
                </p>
                <a
                  href={`/api/asset-proxy?key=${encodeURIComponent(selectedAsset.r2Key)}&download=1`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Descargar archivo
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sin contenido disponible.</p>
            )}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center text-center">
            <div>
              <p className="text-sm text-gray-400">
                Haz clic en un archivo de la lista izquierda
              </p>
              <p className="mt-1 text-xs text-gray-300">para verlo aquí</p>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
