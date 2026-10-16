// Inngest client — WaaS
import { Inngest } from 'inngest';

const client = new Inngest({ id: 'waas' });

/**
 * Con INNGEST_DISABLED=true los eventos no se envían (demos y entornos sin credenciales de
 * Inngest). Sin esta opción, `send` falla en producción cuando no hay INNGEST_EVENT_KEY y
 * cualquier acción que dispare un flujo en segundo plano devolvería un error.
 * Las funciones se siguen registrando con normalidad.
 */
export const inngest: Inngest =
  process.env.INNGEST_DISABLED === 'true'
    ? new Proxy(client, {
        get(target, property, receiver) {
          if (property === 'send') return async () => ({ ids: [] });
          return Reflect.get(target, property, receiver);
        },
      })
    : client;
