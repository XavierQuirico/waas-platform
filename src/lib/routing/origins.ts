// ============================================================
// Orígenes de cada superficie (público, portal, admin)
//
// En producción la aplicación puede servirse desde tres subdominios y el
// middleware redirige entre ellos. Cada origen se puede sobreescribir con una
// variable de entorno. Con NEXT_PUBLIC_SINGLE_HOST=true no se redirige entre
// dominios: todo se sirve desde el host actual (demos y entornos de preview).
//
// Se accede a process.env de forma estática: el runtime de Edge solo
// sustituye las variables referenciadas literalmente.
// ============================================================

const IS_PROD = process.env.NODE_ENV === 'production';
const SINGLE_HOST = process.env.NEXT_PUBLIC_SINGLE_HOST === 'true';
const MULTI_HOST = IS_PROD && !SINGLE_HOST;

export const PORTAL_ORIGIN: string | null = MULTI_HOST
  ? (process.env.PORTAL_ORIGIN ?? 'https://portal.quiricostudios.com')
  : null;

export const ADMIN_ORIGIN: string | null = MULTI_HOST
  ? (process.env.ADMIN_ORIGIN ?? 'https://admin.quiricostudios.com')
  : null;

export const PUBLIC_ORIGIN: string | null = MULTI_HOST
  ? (process.env.PUBLIC_ORIGIN ?? 'https://quiricostudios.com')
  : null;
