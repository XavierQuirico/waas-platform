'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { Pencil, Check } from 'lucide-react';
import { updateClientConfig, type UpdateConfigState } from './actions';
import type {
  ConfigEditableSection,
  ConfigDisplayRow,
  ConfigEditableFieldName,
} from '@/lib/portal/configuration-view-model';
import {
  configDisplayOrEmpty,
  validateConfigField,
} from '@/lib/portal/configuration-view-model';
import { ReadonlyRow } from './ui';
import styles from './configuracion.module.css';

interface Props {
  section: ConfigEditableSection;
}

function fieldError(name: ConfigEditableFieldName, value: string): string | null {
  const res = validateConfigField(name, { [name]: value });
  return 'error' in res ? res.error : null;
}

export function EditableSection({ section }: Props) {
  const initial = React.useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of section.fields) map[f.name] = f.value;
    return map;
  }, [section.fields]);

  const [editing, setEditing] = React.useState(false);
  const [values, setValues] = React.useState<Record<string, string>>(initial);
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});
  const [state, formAction, isPending] = useActionState<UpdateConfigState, FormData>(
    updateClientConfig,
    null,
  );

  const succeeded = state?.ok === true && state.section === section.id;
  const failed = state?.ok === false && state.section === section.id;

  React.useEffect(() => {
    if (succeeded) setEditing(false);
  }, [succeeded]);

  React.useEffect(() => {
    setValues(initial);
    setErrors({});
  }, [initial]);

  const dirty = section.fields.some((f) => (values[f.name] ?? '') !== (initial[f.name] ?? ''));
  const missingRequired = section.fields.some(
    (f) => f.required && (values[f.name] ?? '').trim() === '',
  );
  const hasError = section.fields.some((f) => !!errors[f.name]);
  const canSave = dirty && !missingRequired && !hasError && !isPending;

  const startEdit = () => {
    setValues(initial);
    setErrors({});
    setEditing(true);
  };
  const cancelEdit = () => {
    setValues(initial);
    setErrors({});
    setEditing(false);
  };

  // Validación al intentar guardar (no agresiva tecla a tecla).
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const next: Record<string, string | null> = {};
    let bad = false;
    for (const f of section.fields) {
      const err = fieldError(f.name, values[f.name] ?? '');
      next[f.name] = err;
      if (err) bad = true;
    }
    setErrors(next);
    if (bad) e.preventDefault();
  };

  return (
    <section
      aria-label={section.title}
      className={`${styles.panelSection} ${editing ? styles.panelSectionEditing : ''}`}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardHeadText}>
          <div className={styles.cardTitleRow}>
            <h3 className={styles.cardTitle}>{section.title}</h3>
          </div>
          <p className={styles.cardDesc}>{section.description}</p>
        </div>
        {!editing && (
          <button type="button" onClick={startEdit} className={styles.btnGhost}>
            <Pencil size={13} aria-hidden="true" />
            Editar
          </button>
        )}
      </div>

      {editing && (
        <div className={styles.editMeta} aria-live="polite">
          <span className={styles.editMetaDot} aria-hidden="true" />
          <span>Editando · {section.title}</span>
          {dirty && <span className={styles.unsaved}>· Cambios sin guardar</span>}
        </div>
      )}

      {succeeded && (
        <div role="status" aria-live="polite" className={styles.alertOk}>
          <Check size={15} aria-hidden="true" />
          Cambios guardados.
        </div>
      )}

      {failed && (
        <div role="alert" className={styles.alertErr}>
          {state?.ok === false ? state.error : ''}
        </div>
      )}

      {editing ? (
        <form action={formAction} onSubmit={handleSubmit} noValidate>
          <input type="hidden" name="__section" value={section.id} />
          <div className={styles.fields}>
            {section.fields.map((f) => {
              const inputId = `cfg-${f.name}`;
              const errId = `${inputId}-error`;
              const err = errors[f.name];
              return (
                <div key={f.name} className={styles.field}>
                  <label htmlFor={inputId} className={styles.label}>
                    {f.label}
                    {!f.required && <span className={styles.optional}>(opcional)</span>}
                  </label>
                  <input
                    id={inputId}
                    name={f.name}
                    type={f.type === 'tel' ? 'tel' : f.type === 'url' ? 'url' : 'text'}
                    inputMode={f.type === 'tel' ? 'tel' : undefined}
                    value={values[f.name] ?? ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setValues((prev) => ({ ...prev, [f.name]: v }));
                      if (errors[f.name]) setErrors((prev) => ({ ...prev, [f.name]: null }));
                    }}
                    onBlur={(e) =>
                      setErrors((prev) => ({ ...prev, [f.name]: fieldError(f.name, e.target.value) }))
                    }
                    maxLength={f.maxLength}
                    placeholder={f.placeholder}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? errId : undefined}
                    className={`${styles.input} ${err ? styles.inputError : ''}`}
                  />
                  {err ? (
                    <div id={errId} role="alert" className={styles.fieldError}>
                      {err}
                    </div>
                  ) : (
                    f.hint && <div className={styles.fieldHint}>{f.hint}</div>
                  )}
                </div>
              );
            })}
          </div>

          {section.readonlyRows.length > 0 && (
            <div className={`${styles.rows} ${styles.embeddedRows}`}>
              {section.readonlyRows.map((row) => (
                <ReadonlyRow key={row.id} row={row} />
              ))}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="submit"
              disabled={!canSave}
              aria-disabled={!canSave}
              className={styles.btnPrimary}
            >
              {isPending ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isPending}
              className={styles.btnSecondary}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.rows}>
          {section.fields.map((f) => (
            <ReadonlyRow
              key={f.name}
              row={
                {
                  id: f.name,
                  label: f.label,
                  value: configDisplayOrEmpty(f.value),
                } satisfies ConfigDisplayRow
              }
            />
          ))}
          {section.readonlyRows.map((row) => (
            <ReadonlyRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </section>
  );
}
