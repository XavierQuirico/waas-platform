// ============================================================
// tRPC Root Router — WaaS
// Registra todos los sub-routers de la aplicación
// ============================================================

import { router } from '@/server/trpc';
import { intakeRouter } from './intake';
import { assetsRouter } from './assets';
import { adminRouter } from './admin';
import { projectsRouter } from './projects';
import { incidentsRouter } from './incidents';
import { devRouter } from './dev';

export const appRouter = router({
  intake: intakeRouter,
  assets: assetsRouter,
  admin: adminRouter,
  projects: projectsRouter,
  incidents: incidentsRouter,
  dev: devRouter,
});

export type AppRouter = typeof appRouter;
