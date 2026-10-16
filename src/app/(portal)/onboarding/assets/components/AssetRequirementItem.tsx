'use client';

import {
  FileText,
  Image as ImageIcon,
  Table2,
  File as FileIcon,
  Check,
  ChevronRight,
} from 'lucide-react';
import type { AssetRequirement } from '@/lib/assets/asset-requirements';
import { getMaterialStatusChip, type MaterialAssetStatus } from '@/lib/portal/material-chips';

function MaterialIcon({ requirement }: { requirement: AssetRequirement }) {
  const f = (requirement.formats ?? []).join(',');
  if (requirement.type === 'text' || requirement.type === 'textarea') return <FileText size={15} aria-hidden="true" />;
  if (/JPG|JPEG|PNG|WEBP|SVG/.test(f)) return <ImageIcon size={15} aria-hidden="true" />;
  if (/XLSX|CSV/.test(f)) return <Table2 size={15} aria-hidden="true" />;
  if (/DOCX|PDF|TXT|AI/.test(f)) return <FileText size={15} aria-hidden="true" />;
  return <FileIcon size={15} aria-hidden="true" />;
}

interface AssetRequirementItemProps {
  requirement: AssetRequirement;
  status: MaterialAssetStatus;
  complete: boolean;
  canUpload: boolean;
  active: boolean;
  onSelect: () => void;
}

export function AssetRequirementItem({
  requirement,
  status,
  complete,
  canUpload,
  active,
  onSelect,
}: AssetRequirementItemProps) {
  const statusConfig = getMaterialStatusChip(status);

  return (
    <button
      type="button"
      data-testid="asset-item"
      data-asset-key={requirement.key}
      data-asset-status={status}
      data-complete={complete ? 'true' : 'false'}
      data-can-upload={canUpload ? 'true' : 'false'}
      onClick={onSelect}
      aria-current={active ? 'true' : undefined}
      className="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150"
      style={{
        borderColor: active ? 'rgba(255,140,0,0.4)' : 'rgba(255,255,255,0.07)',
        background: active ? 'rgba(255,140,0,0.06)' : 'rgba(255,255,255,0.015)',
      }}
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
        style={{
          background: complete ? 'rgba(93,214,156,0.12)' : 'rgba(255,255,255,0.05)',
          color: complete ? '#5DD69C' : 'rgba(249,249,249,0.5)',
        }}
      >
        {complete ? <Check size={15} aria-hidden="true" /> : <MaterialIcon requirement={requirement} />}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[13px] font-medium leading-tight"
          style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }}
        >
          {requirement.label}
        </span>
        <span
          className="text-[10px] font-semibold uppercase tracking-wide"
          style={{ color: statusConfig.text, letterSpacing: '0.04em' }}
        >
          {statusConfig.label}
        </span>
      </span>

      <ChevronRight
        size={15}
        className="shrink-0"
        style={{ color: active ? 'rgba(255,140,0,0.7)' : 'rgba(249,249,249,0.25)' }}
        aria-hidden="true"
      />
    </button>
  );
}
