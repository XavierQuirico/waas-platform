'use client';

import { useRef, useState } from 'react';
import {
  UploadCloud,
  FolderOpen,
  Link2,
  FileText,
  Image as ImageIcon,
  Table2,
  File as FileIcon,
  Check,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import type { AssetRequirement } from '@/lib/assets/asset-requirements';
import type { ProjectAsset } from '@/db/schema/project-assets';
import { getAcceptedAssetMimes } from '@/lib/assets/asset-ui';
import {
  getMaterialRequirementChip,
  getMaterialStatusChip,
  type MaterialAssetStatus,
} from '@/lib/portal/material-chips';

/** Icono sobrio por tipo de material (lucide, nunca emoji). */
function MaterialIcon({ requirement, size = 16 }: { requirement: AssetRequirement; size?: number }) {
  const f = (requirement.formats ?? []).join(',');
  if (requirement.type === 'text' || requirement.type === 'textarea') {
    return <FileText size={size} aria-hidden="true" />;
  }
  if (/JPG|JPEG|PNG|WEBP|SVG/.test(f)) return <ImageIcon size={size} aria-hidden="true" />;
  if (/XLSX|CSV/.test(f)) return <Table2 size={size} aria-hidden="true" />;
  if (/DOCX|PDF|TXT|AI/.test(f)) return <FileText size={size} aria-hidden="true" />;
  return <FileIcon size={size} aria-hidden="true" />;
}

interface AssetUploadPanelProps {
  requirement: AssetRequirement;
  assets: ProjectAsset[];
  status: MaterialAssetStatus;
  canUpload: boolean;
  rejectionComment: string | null;
  // Controlled transient state (lifted to AssetChecklist so desktop & mobile stay in sync).
  urlMode: boolean;
  draftText: string;
  isUploading: boolean;
  uploadError: string | null;
  textSaveError: string | null;
  onUrlMode: (next: boolean) => void;
  onDraftTextChange: (value: string) => void;
  onFile: (file: File) => void;
  onSaveText: () => void;
}

export function AssetUploadPanel({
  requirement,
  assets,
  status,
  canUpload,
  rejectionComment,
  urlMode,
  draftText,
  isUploading,
  uploadError,
  textSaveError,
  onUrlMode,
  onDraftTextChange,
  onFile,
  onSaveText,
}: AssetUploadPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const statusConfig = getMaterialStatusChip(status);
  const requirementChip = getMaterialRequirementChip(!!requirement.required);
  const isTextType = requirement.type === 'text' || requirement.type === 'textarea';
  const isFileType = !isTextType;

  const sentFiles = assets.filter((a) => a.r2Key || a.textValue);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div
      data-testid="asset-active-panel"
      data-asset-key={requirement.key}
      data-asset-status={status}
    >
      {/* ── Cabecera del requisito ─────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className="mt-0.5 shrink-0"
            style={{ color: 'rgba(249,249,249,0.55)' }}
          >
            <MaterialIcon requirement={requirement} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3
                className="text-[15px] font-semibold leading-tight"
                style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
              >
                {requirement.label}
              </h3>
              <span
                className="rounded-full border px-2 py-0.5 font-semibold"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.04em',
                  color: requirementChip.text,
                  borderColor: requirementChip.border,
                  background: requirementChip.bg,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {requirementChip.label}
              </span>
            </div>
            {requirement.helpText && (
              <p
                className="mt-1 text-xs leading-relaxed"
                style={{ color: 'rgba(249,249,249,0.4)', fontFamily: 'var(--font-body)' }}
              >
                {requirement.helpText}
              </p>
            )}
          </div>
        </div>

        <span
          className="shrink-0 rounded-full border px-2.5 py-0.5 font-semibold uppercase"
          style={{
            fontSize: 9,
            letterSpacing: '0.06em',
            color: statusConfig.text,
            borderColor: statusConfig.border,
            background: statusConfig.bg,
            fontFamily: 'var(--font-body)',
          }}
          aria-label={`Estado: ${statusConfig.label}`}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* ── Comentario de Xavier (requiere ajuste) ─────────────── */}
      {status === 'rejected' && rejectionComment && (
        <div
          className="mt-3 flex gap-2 rounded-lg border p-3"
          style={{ borderColor: 'rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.06)' }}
          role="alert"
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" style={{ color: '#F4A3A3' }} aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#F4A3A3', fontFamily: 'var(--font-display)' }}>
              Necesita un ajuste
            </p>
            <p className="mt-0.5 text-xs" style={{ color: 'rgba(244,163,163,0.85)' }}>
              {rejectionComment}
            </p>
          </div>
        </div>
      )}

      {/* ── Área de carga ──────────────────────────────────────── */}
      {canUpload ? (
        <div className="mt-4">
          {isFileType && (
            <>
              {requirement.acceptsUrl && (
                <div
                  className="mb-3 inline-flex gap-1 rounded-lg p-1"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                  role="tablist"
                  aria-label="Cómo enviar este material"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={!urlMode}
                    onClick={() => onUrlMode(false)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150"
                    style={{
                      background: !urlMode ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: !urlMode ? 'rgba(249,249,249,0.92)' : 'rgba(249,249,249,0.45)',
                    }}
                  >
                    <UploadCloud size={13} aria-hidden="true" />
                    Archivo
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={urlMode}
                    onClick={() => onUrlMode(true)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-150"
                    style={{
                      background: urlMode ? 'rgba(255,255,255,0.1)' : 'transparent',
                      color: urlMode ? 'rgba(249,249,249,0.92)' : 'rgba(249,249,249,0.45)',
                    }}
                  >
                    <Link2 size={13} aria-hidden="true" />
                    Enlace
                  </button>
                </div>
              )}

              {!urlMode ? (
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition-colors duration-150"
                  style={{
                    borderColor: isDragOver ? 'rgba(255,140,0,0.45)' : 'rgba(255,255,255,0.12)',
                    background: isDragOver ? 'rgba(255,140,0,0.05)' : 'rgba(255,255,255,0.015)',
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                  aria-label={`Subir archivo para ${requirement.label}`}
                >
                  {isUploading ? (
                    <p className="text-sm" style={{ color: 'rgba(249,249,249,0.5)' }}>
                      Subiendo…
                    </p>
                  ) : (
                    <>
                      <UploadCloud size={26} style={{ color: 'rgba(255,140,0,0.7)' }} aria-hidden="true" />
                      <p className="mt-2.5 text-sm" style={{ color: 'rgba(249,249,249,0.6)' }}>
                        Arrastra aquí tu archivo
                      </p>
                      <span
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        style={{
                          borderColor: 'rgba(255,255,255,0.14)',
                          color: 'rgba(249,249,249,0.85)',
                          background: 'rgba(255,255,255,0.04)',
                        }}
                      >
                        <FolderOpen size={13} aria-hidden="true" />
                        Buscar archivo
                      </span>
                      {requirement.formats && (
                        <p className="mt-2.5 text-xs" style={{ color: 'rgba(249,249,249,0.28)' }}>
                          {requirement.formats.join(', ')} · {requirement.key.includes('photos') ? '25MB' : '50MB'} máx
                        </p>
                      )}
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={getAcceptedAssetMimes(requirement.formats)}
                    aria-label={`Subir archivo para ${requirement.label}`}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onFile(file);
                      e.target.value = '';
                    }}
                    multiple={!!requirement.minCount}
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="url"
                    value={draftText}
                    onChange={(e) => onDraftTextChange(e.target.value)}
                    placeholder="https://docs.google.com/…"
                    aria-label={`Enlace para ${requirement.label}`}
                    className="min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none"
                    style={{
                      borderColor: 'rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-body)',
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,140,0,0.5)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
                  />
                  <button
                    type="button"
                    onClick={onSaveText}
                    disabled={!draftText.trim()}
                    aria-label={`Guardar enlace para ${requirement.label}`}
                    className="shrink-0 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: '#FF8C00', color: '#121212', fontFamily: 'var(--font-body)' }}
                  >
                    Guardar enlace
                  </button>
                </div>
              )}
            </>
          )}

          {isTextType && (
            <div>
              {requirement.type === 'textarea' ? (
                <textarea
                  rows={4}
                  value={draftText}
                  onChange={(e) => onDraftTextChange(e.target.value)}
                  onBlur={onSaveText}
                  placeholder={requirement.helpText}
                  aria-label={requirement.label}
                  className="block w-full rounded-lg border px-3 py-2.5 text-sm leading-relaxed transition-colors focus:outline-none"
                  style={{
                    borderColor: 'rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,140,0,0.5)')}
                />
              ) : (
                <input
                  type="text"
                  value={draftText}
                  onChange={(e) => onDraftTextChange(e.target.value)}
                  onBlur={onSaveText}
                  placeholder={requirement.helpText}
                  aria-label={requirement.label}
                  className="block w-full rounded-lg border px-3 py-2.5 text-sm transition-colors focus:outline-none"
                  style={{
                    borderColor: 'rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(255,140,0,0.5)')}
                />
              )}
              <p className="mt-1.5 text-xs" style={{ color: 'rgba(249,249,249,0.3)' }}>
                Se guarda automáticamente cuando terminas de escribir.
              </p>
              {textSaveError && (
                <p role="alert" className="mt-1 text-xs" style={{ color: '#F4A3A3' }}>
                  {textSaveError}
                </p>
              )}
            </div>
          )}

          {uploadError && (
            <p role="alert" className="mt-2 text-xs" style={{ color: '#F4A3A3' }}>
              {uploadError}
            </p>
          )}
        </div>
      ) : (
        <div
          className="mt-4 flex items-center gap-2 rounded-lg border px-3 py-2.5"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}
        >
          <Lock size={13} style={{ color: 'rgba(249,249,249,0.4)' }} aria-hidden="true" />
          <p className="text-xs" style={{ color: 'rgba(249,249,249,0.45)' }}>
            {status === 'approved'
              ? 'Material recibido. Xavier ya lo tiene.'
              : 'Este material está en revisión. No puedes cambiarlo ahora.'}
          </p>
        </div>
      )}

      {/* ── Archivos / enlaces ya enviados ─────────────────────── */}
      {sentFiles.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Materiales enviados">
          {sentFiles.map((asset, i) => (
            <li
              key={asset.id}
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}
            >
              <span className="shrink-0" style={{ color: 'rgba(249,249,249,0.45)' }}>
                {asset.textValue && !asset.r2Key ? (
                  <Link2 size={14} aria-hidden="true" />
                ) : (
                  <MaterialIcon requirement={requirement} size={14} />
                )}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-xs"
                style={{ color: 'rgba(249,249,249,0.65)', fontFamily: 'var(--font-body)' }}
                title={asset.originalName || asset.textValue || undefined}
              >
                {asset.originalName || asset.textValue || `Archivo ${i + 1}`}
              </span>
              <Check size={13} className="shrink-0" style={{ color: '#5DD69C' }} aria-hidden="true" />
            </li>
          ))}
          {canUpload && (
            <li className="px-1 pt-0.5 text-xs" style={{ color: 'rgba(249,249,249,0.3)' }}>
              ¿Necesitas cambiarlo? Sube otro archivo y reemplaza el anterior.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
