// Destino tras iniciar sesión según el rol (admin, cliente o sin asignar).
// Lógica pura: no requiere base de datos ni sesión.
import { describe, it, expect } from "vitest";
import { resolveDestinationForRole } from "../lib/routing/auth-destination-pure";

describe("resolveDestinationForRole — lógica pura sin DB", () => {
  it("admin + /dashboard → /admin (bug fix: /dashboard está en ADMIN_SAFE_PATHS)", () => {
    expect(resolveDestinationForRole("admin", "/dashboard")).toBe("/admin");
  });

  it("admin + /admin → /admin", () => {
    expect(resolveDestinationForRole("admin", "/admin")).toBe("/admin");
  });

  it("admin + /clientes → /clientes (ruta admin válida preservada)", () => {
    expect(resolveDestinationForRole("admin", "/clientes")).toBe("/clientes");
  });

  it("admin + /proyectos/abc123 → /proyectos/abc123", () => {
    expect(resolveDestinationForRole("admin", "/proyectos/abc123")).toBe("/proyectos/abc123");
  });

  it("admin + / → /admin (no es ruta admin)", () => {
    expect(resolveDestinationForRole("admin", "/")).toBe("/admin");
  });

  it("client + /dashboard → /dashboard", () => {
    expect(resolveDestinationForRole("client", "/dashboard")).toBe("/dashboard");
  });

  it("client + /incidencias → /incidencias (ruta portal válida)", () => {
    expect(resolveDestinationForRole("client", "/incidencias")).toBe("/incidencias");
  });

  it("client + /admin → /dashboard (bloqueo de ruta admin)", () => {
    expect(resolveDestinationForRole("client", "/admin")).toBe("/dashboard");
  });

  it("client + /clientes → /dashboard (ruta admin bloqueada aunque sea portal-like)", () => {
    expect(resolveDestinationForRole("client", "/clientes")).toBe("/dashboard");
  });

  it("client + /admin/proyectos/xyz → /dashboard (path admin bloqueado)", () => {
    expect(resolveDestinationForRole("client", "/admin/proyectos/xyz")).toBe("/dashboard");
  });

  it("client + / → /dashboard (ruta pública → portal)", () => {
    expect(resolveDestinationForRole("client", "/")).toBe("/dashboard");
  });

  it("unassigned + /dashboard → /portal/activar", () => {
    expect(resolveDestinationForRole("unassigned", "/dashboard")).toBe("/portal/activar");
  });

  it("unassigned + /admin → /portal/activar", () => {
    expect(resolveDestinationForRole("unassigned", "/admin")).toBe("/portal/activar");
  });

  it("unassigned + /incidencias → /portal/activar", () => {
    expect(resolveDestinationForRole("unassigned", "/incidencias")).toBe("/portal/activar");
  });
});
