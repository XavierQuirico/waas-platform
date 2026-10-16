// ============================================================
// Envío de correo — punto único
//
// - El remitente y la dirección de respuesta salen de la configuración, no de
//   cadenas repartidas por cada plantilla o función.
// - El cliente de Resend se crea la primera vez que se usa. Importar este
//   módulo nunca exige RESEND_API_KEY (build, tests y CI no tienen la clave).
// - EMAIL_DRY_RUN=true evita el envío real (entornos demo y de pruebas).
// ============================================================

import { Resend } from 'resend';

export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'QUIRICO STUDIOS <hola@quiricostudios.com>';
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'hola@quiricostudios.com';

type SendArgs = Parameters<Resend['emails']['send']>;
type SendResult = ReturnType<Resend['emails']['send']>;

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

function send(...args: SendArgs): SendResult {
  if (process.env.EMAIL_DRY_RUN === 'true') {
    return Promise.resolve({ data: { id: 'dry-run' }, error: null }) as SendResult;
  }
  return getClient().emails.send(...args);
}

export const resend = { emails: { send } };
