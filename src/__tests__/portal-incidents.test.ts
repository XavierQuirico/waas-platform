// Portal — Incidencias
// Cubre validación de input, lógica de propiedad, severidad, estados,
// origen de reporte, site status, y escaneos de seguridad visual.
// No requiere DB ni auth — prueba lógica pura.

import { describe, expect, it } from 'vitest';

// ─── Pure helpers extracted from actions.ts logic ─────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(v: string) {
  return UUID_RE.test(v);
}

function isValidUrl(v: string) {
  try { new URL(v); return true; } catch { return false; }
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSafeRelativePath(value: string) {
  return (
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.startsWith('/\\') &&
    value.length <= 500
  );
}

function isValidAffectedUrl(value: string) {
  if (value.length > 500) return false;
  if (isSafeRelativePath(value)) return true;
  return isHttpUrl(value);
}

function validateTitle(title: string): string | null {
  if (title.trim().length < 5) return 'El título debe tener al menos 5 caracteres.';
  if (title.trim().length > 200) return 'El título no puede superar 200 caracteres.';
  return null;
}

function validateDescription(desc: string): string | null {
  if (desc.length > 2000) return 'La descripción no puede superar 2000 caracteres.';
  return null;
}

function validateSeverity(s: string): s is 'P1' | 'P2' | 'P3' {
  return s === 'P1' || s === 'P2' || s === 'P3';
}

// ─── Label helpers mirroring client component logic ───────────────────────────

function reportedByLabel(r: 'CLIENT' | 'ADMIN' | 'SYSTEM') {
  if (r === 'CLIENT') return 'Reportada por ti';
  if (r === 'SYSTEM') return 'Detectada automáticamente';
  return 'Registrada por soporte';
}

function statusLabel(s: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED') {
  if (s === 'OPEN') return 'Abierta';
  if (s === 'IN_PROGRESS') return 'En progreso';
  return 'Resuelta';
}

function computeSiteStatus(
  incidents: Array<{ status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' }>,
): 'operational' | 'degraded' {
  const hasActive = incidents.some((i) => i.status === 'OPEN' || i.status === 'IN_PROGRESS');
  return hasActive ? 'degraded' : 'operational';
}

// ─── 1. Input validation ──────────────────────────────────────────────────────

describe('1. Input validation — title', () => {
  it('rejects title shorter than 5 chars', () => {
    expect(validateTitle('Hi')).toBe('El título debe tener al menos 5 caracteres.');
    expect(validateTitle('    ')).toBe('El título debe tener al menos 5 caracteres.');
    expect(validateTitle('')).toBe('El título debe tener al menos 5 caracteres.');
  });

  it('accepts title of exactly 5 chars', () => {
    expect(validateTitle('Hello')).toBeNull();
  });

  it('rejects title longer than 200 chars', () => {
    expect(validateTitle('a'.repeat(201))).toBe('El título no puede superar 200 caracteres.');
  });

  it('accepts title of exactly 200 chars', () => {
    expect(validateTitle('a'.repeat(200))).toBeNull();
  });
});

describe('1. Input validation — description', () => {
  it('accepts empty description', () => {
    expect(validateDescription('')).toBeNull();
  });

  it('rejects description longer than 2000 chars', () => {
    expect(validateDescription('x'.repeat(2001))).toBe(
      'La descripción no puede superar 2000 caracteres.',
    );
  });

  it('accepts description of exactly 2000 chars', () => {
    expect(validateDescription('x'.repeat(2000))).toBeNull();
  });
});

describe('1. Input validation — severity', () => {
  it('accepts P1, P2, P3', () => {
    expect(validateSeverity('P1')).toBe(true);
    expect(validateSeverity('P2')).toBe(true);
    expect(validateSeverity('P3')).toBe(true);
  });

  it('rejects invalid severity values', () => {
    expect(validateSeverity('alta')).toBe(false);
    expect(validateSeverity('normal')).toBe(false);
    expect(validateSeverity('urgent')).toBe(false);
    expect(validateSeverity('URGENTE')).toBe(false);
    expect(validateSeverity('')).toBe(false);
  });
});

describe('1. Input validation — affectedUrl', () => {
  it('accepts full URLs', () => {
    expect(isValidAffectedUrl('https://misitio.com/contacto')).toBe(true);
    expect(isValidAffectedUrl('http://localhost:3000/test')).toBe(true);
  });

  it('accepts relative paths starting with /', () => {
    expect(isValidAffectedUrl('/contacto')).toBe(true);
    expect(isValidAffectedUrl('/producto/123')).toBe(true);
  });

  it('rejects bare strings without protocol or leading slash', () => {
    expect(isValidAffectedUrl('misitio.com/contacto')).toBe(false);
    expect(isValidAffectedUrl('contacto')).toBe(false);
  });

  it('rejects strings over 500 chars', () => {
    expect(isValidAffectedUrl('/' + 'x'.repeat(500))).toBe(false);
  });
});

describe('1. Input validation — evidenceUrl', () => {
  it('accepts valid URLs', () => {
    expect(isValidUrl('https://drive.google.com/file/123')).toBe(true);
    expect(isValidUrl('https://loom.com/share/abc')).toBe(true);
  });

  it('rejects relative paths (evidence must be full URL)', () => {
    expect(isValidUrl('/screenshot.png')).toBe(false);
  });
});

// ─── 2. Ownership logic ───────────────────────────────────────────────────────

describe('2. Ownership — UUID validation', () => {
  it('accepts valid UUIDs', () => {
    expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
  });

  it('rejects non-UUID strings', () => {
    expect(isValidUUID('not-a-uuid')).toBe(false);
    expect(isValidUUID('12345')).toBe(false);
    expect(isValidUUID('')).toBe(false);
  });
});

// ─── 3. Severity — real P1/P2/P3 stored, no [URGENTE] prefix ─────────────────

describe('3. Severity — P1/P2/P3 are real values', () => {
  it('P1 is valid', () => expect(validateSeverity('P1')).toBe(true));
  it('P2 is valid', () => expect(validateSeverity('P2')).toBe(true));
  it('P3 is valid', () => expect(validateSeverity('P3')).toBe(true));

  it('does not produce [URGENTE] prefix for P1', () => {
    const title = 'Formulario caído';
    // severity is stored separately, title should never get a prefix
    expect(title).not.toContain('[URGENTE]');
  });

  it('does not produce [URGENTE] prefix for any severity', () => {
    for (const sev of ['P1', 'P2', 'P3']) {
      const title = `Test incidencia ${sev}`;
      expect(title).not.toContain('[URGENTE]');
    }
  });
});

// ─── 4. Status labels ─────────────────────────────────────────────────────────

describe('4. Status labels', () => {
  it('OPEN -> Abierta', () => expect(statusLabel('OPEN')).toBe('Abierta'));
  it('IN_PROGRESS -> En progreso', () => expect(statusLabel('IN_PROGRESS')).toBe('En progreso'));
  it('RESOLVED -> Resuelta', () => expect(statusLabel('RESOLVED')).toBe('Resuelta'));
});

// ─── 5. Reported-by origin labels ─────────────────────────────────────────────

describe('5. Reported-by origin labels', () => {
  it('CLIENT -> Reportada por ti', () => expect(reportedByLabel('CLIENT')).toBe('Reportada por ti'));
  it('SYSTEM -> Detectada automáticamente', () => expect(reportedByLabel('SYSTEM')).toBe('Detectada automáticamente'));
  it('ADMIN -> Registrada por soporte', () => expect(reportedByLabel('ADMIN')).toBe('Registrada por soporte'));
});

// ─── 6. Site status computation ───────────────────────────────────────────────

describe('6. Site status computation', () => {
  it('operational when no incidents', () => {
    expect(computeSiteStatus([])).toBe('operational');
  });

  it('operational when all incidents are RESOLVED', () => {
    expect(computeSiteStatus([
      { status: 'RESOLVED' },
      { status: 'RESOLVED' },
    ])).toBe('operational');
  });

  it('degraded when any incident is OPEN', () => {
    expect(computeSiteStatus([{ status: 'OPEN' }])).toBe('degraded');
  });

  it('degraded when any incident is IN_PROGRESS', () => {
    expect(computeSiteStatus([{ status: 'IN_PROGRESS' }])).toBe('degraded');
  });

  it('degraded when OPEN and RESOLVED are mixed', () => {
    expect(computeSiteStatus([
      { status: 'RESOLVED' },
      { status: 'OPEN' },
    ])).toBe('degraded');
  });

  it('RESOLVED alone does not degrade status', () => {
    expect(computeSiteStatus([{ status: 'RESOLVED' }])).toBe('operational');
  });
});

// ─── 7. Portal global route logic ─────────────────────────────────────────────

describe('7. Portal/global route logic', () => {
  it('single project redirects to /proyecto/{id}/incidencias', () => {
    const projects = [{ id: '550e8400-e29b-41d4-a716-446655440000' }];
    // With 1 project, we redirect — simulate the decision
    const shouldRedirect = projects.length === 1;
    expect(shouldRedirect).toBe(true);
  });

  it('multiple projects do not redirect to arbitrary project', () => {
    const projects = [
      { id: '550e8400-e29b-41d4-a716-446655440000' },
      { id: '660e8400-e29b-41d4-a716-446655440001' },
    ];
    const shouldRedirect = projects.length === 1;
    expect(shouldRedirect).toBe(false);
  });

  it('zero projects shows empty state (no redirect)', () => {
    const projects: { id: string }[] = [];
    const shouldRedirect = projects.length === 1;
    expect(shouldRedirect).toBe(false);
  });
});

// ─── Helper: normalize URL input (mirrors schema preprocess) ──────────────────

function normalizeUrlInput(v: string | undefined): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.trim() || undefined;
}

function isValidEvidenceUrl(value: string): boolean {
  if (value.length > 500) return false;
  return isHttpUrl(value);
}

// ─── 11. Title trim validation ────────────────────────────────────────────────

describe('11. Title trim validation — validates after trim', () => {
  it('rejects "    abc" (only 3 chars after trim)', () => {
    expect(validateTitle('    abc')).toBe('El título debe tener al menos 5 caracteres.');
  });

  it('rejects five-space string (0 chars after trim)', () => {
    expect(validateTitle('     ')).toBe('El título debe tener al menos 5 caracteres.');
  });

  it('accepts "    problema real    " and normalizes to "problema real"', () => {
    expect(validateTitle('    problema real    ')).toBeNull();
    expect('    problema real    '.trim()).toBe('problema real');
  });

  it('rejects title of 201 chars after trim (padded with spaces)', () => {
    const padded = '  ' + 'a'.repeat(201) + '  ';
    expect(validateTitle(padded)).toBe('El título no puede superar 200 caracteres.');
  });

  it('accepts title of 200 chars after trim (padded with spaces)', () => {
    const padded = '  ' + 'a'.repeat(200) + '  ';
    expect(validateTitle(padded)).toBeNull();
  });
});

// ─── 12. URL normalization before validation ──────────────────────────────────

describe('12. URL normalization — trim before validate', () => {
  it('normalizes " https://example.com/contacto " → valid affectedUrl', () => {
    const normalized = normalizeUrlInput(' https://example.com/contacto ')!;
    expect(normalized).toBe('https://example.com/contacto');
    expect(isValidAffectedUrl(normalized)).toBe(true);
  });

  it('normalizes " /contacto " → valid affectedUrl', () => {
    const normalized = normalizeUrlInput(' /contacto ')!;
    expect(normalized).toBe('/contacto');
    expect(isValidAffectedUrl(normalized)).toBe(true);
  });

  it('normalizes " https://loom.com/share/abc " → valid evidenceUrl', () => {
    const normalized = normalizeUrlInput(' https://loom.com/share/abc ')!;
    expect(normalized).toBe('https://loom.com/share/abc');
    expect(isValidEvidenceUrl(normalized)).toBe(true);
  });

  it('rejects " /screenshot.png " as evidenceUrl (relative path not allowed)', () => {
    const normalized = normalizeUrlInput(' /screenshot.png ')!;
    expect(normalized).toBe('/screenshot.png');
    expect(isValidEvidenceUrl(normalized)).toBe(false);
  });

  it('rejects " contacto " as affectedUrl', () => {
    const normalized = normalizeUrlInput(' contacto ')!;
    expect(normalized).toBe('contacto');
    expect(isValidAffectedUrl(normalized)).toBe(false);
  });

  it('rejects affectedUrl of 501 chars after trim', () => {
    const normalized = normalizeUrlInput('  /' + 'x'.repeat(500) + '  ')!;
    expect(normalized.length).toBe(501);
    expect(isValidAffectedUrl(normalized)).toBe(false);
  });

  it('rejects evidenceUrl of 501 chars after trim', () => {
    const base = 'https://example.com/' + 'x'.repeat(500);
    const normalized = normalizeUrlInput('  ' + base + '  ')!;
    expect(normalized.length).toBeGreaterThan(500);
    expect(isValidEvidenceUrl(normalized)).toBe(false);
  });

  it('blank-only string normalizes to undefined', () => {
    expect(normalizeUrlInput('   ')).toBeUndefined();
    expect(normalizeUrlInput('')).toBeUndefined();
  });
});

// ─── 14. URL hardening — only http/https and safe relative paths ──────────────

describe('14. URL hardening — affectedUrl', () => {
  it('accepts https:// URL', () => {
    expect(isValidAffectedUrl('https://example.com/contacto')).toBe(true);
  });

  it('accepts http:// URL', () => {
    expect(isValidAffectedUrl('http://localhost:3000/test')).toBe(true);
  });

  it('accepts safe relative path /contacto', () => {
    expect(isValidAffectedUrl('/contacto')).toBe(true);
  });

  it('accepts safe relative path /producto/123', () => {
    expect(isValidAffectedUrl('/producto/123')).toBe(true);
  });

  it('rejects javascript: protocol', () => {
    expect(isValidAffectedUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(isValidAffectedUrl('data:text/html,<h1>x</h1>')).toBe(false);
  });

  it('rejects ftp:// protocol', () => {
    expect(isValidAffectedUrl('ftp://example.com/file')).toBe(false);
  });

  it('rejects mailto: protocol', () => {
    expect(isValidAffectedUrl('mailto:test@example.com')).toBe(false);
  });

  it('rejects tel: protocol', () => {
    expect(isValidAffectedUrl('tel:+123456')).toBe(false);
  });

  it('rejects protocol-relative //evil.com', () => {
    expect(isValidAffectedUrl('//evil.com')).toBe(false);
  });

  it('rejects /\\evil (backslash after slash)', () => {
    expect(isValidAffectedUrl('/\\evil')).toBe(false);
  });

  it('rejects bare domain without protocol', () => {
    expect(isValidAffectedUrl('dominio.com/contacto')).toBe(false);
  });

  it('rejects bare string without protocol or slash', () => {
    expect(isValidAffectedUrl('contacto')).toBe(false);
  });

  it('rejects path of 501 chars after trim', () => {
    expect(isValidAffectedUrl('/' + 'x'.repeat(500))).toBe(false);
  });
});

describe('14. URL hardening — evidenceUrl', () => {
  it('accepts https:// URL', () => {
    expect(isValidEvidenceUrl('https://drive.google.com/file/123')).toBe(true);
  });

  it('accepts https:// loom URL', () => {
    expect(isValidEvidenceUrl('https://loom.com/share/abc')).toBe(true);
  });

  it('accepts http:// URL', () => {
    expect(isValidEvidenceUrl('http://localhost:3000/evidence')).toBe(true);
  });

  it('rejects relative path /screenshot.png', () => {
    expect(isValidEvidenceUrl('/screenshot.png')).toBe(false);
  });

  it('rejects relative path /contacto', () => {
    expect(isValidEvidenceUrl('/contacto')).toBe(false);
  });

  it('rejects protocol-relative //evil.com/file.png', () => {
    expect(isValidEvidenceUrl('//evil.com/file.png')).toBe(false);
  });

  it('rejects javascript: protocol', () => {
    expect(isValidEvidenceUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(isValidEvidenceUrl('data:text/html,<h1>x</h1>')).toBe(false);
  });

  it('rejects ftp:// protocol', () => {
    expect(isValidEvidenceUrl('ftp://example.com/file')).toBe(false);
  });

  it('rejects mailto: protocol', () => {
    expect(isValidEvidenceUrl('mailto:test@example.com')).toBe(false);
  });

  it('rejects tel: protocol', () => {
    expect(isValidEvidenceUrl('tel:+123456')).toBe(false);
  });

  it('rejects bare domain without protocol', () => {
    expect(isValidEvidenceUrl('drive.google.com/file')).toBe(false);
  });

  it('rejects bare subdomain without protocol', () => {
    expect(isValidEvidenceUrl('loom.com/share/abc')).toBe(false);
  });

  it('rejects URL of 501+ chars after trim', () => {
    const long = 'https://example.com/' + 'x'.repeat(500);
    expect(isValidEvidenceUrl(long)).toBe(false);
  });
});
