import { describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({ currentUser: vi.fn() }));

import {
  emailsMatch,
  pickVerifiedPrimaryEmail,
} from '@/lib/portal/verified-email';
import { canLinkPendingClient, resolveClientLink } from '@/lib/portal/client-link-logic';

const verified = { id: 'idn_1', emailAddress: 'ana@example.com', verification: { status: 'verified' } };
const unverified = { id: 'idn_2', emailAddress: 'victim@example.com', verification: { status: 'unverified' } };

describe('pickVerifiedPrimaryEmail', () => {
  it('devuelve el email principal cuando Clerk lo marca como verificado', () => {
    expect(
      pickVerifiedPrimaryEmail({ primaryEmailAddressId: 'idn_1', emailAddresses: [verified] }),
    ).toBe('ana@example.com');
  });

  it('ignora un email principal sin verificar', () => {
    expect(
      pickVerifiedPrimaryEmail({ primaryEmailAddressId: 'idn_2', emailAddresses: [unverified] }),
    ).toBeNull();
  });

  it('ignora un email verificado que no es el principal', () => {
    expect(
      pickVerifiedPrimaryEmail({
        primaryEmailAddressId: 'idn_2',
        emailAddresses: [verified, unverified],
      }),
    ).toBeNull();
  });

  it('devuelve null si no hay usuario o no hay verificación', () => {
    expect(pickVerifiedPrimaryEmail(null)).toBeNull();
    expect(
      pickVerifiedPrimaryEmail({
        primaryEmailAddressId: 'idn_3',
        emailAddresses: [{ id: 'idn_3', emailAddress: 'x@example.com' }],
      }),
    ).toBeNull();
  });
});

describe('emailsMatch', () => {
  it('compara sin distinguir mayúsculas ni espacios', () => {
    expect(emailsMatch(' Ana@Example.com ', 'ana@example.com')).toBe(true);
  });

  it('no coincide con valores vacíos', () => {
    expect(emailsMatch(null, 'ana@example.com')).toBe(false);
    expect(emailsMatch('ana@example.com', '')).toBe(false);
  });
});

describe('canLinkPendingClient — evita tomar el control de la solicitud de otra persona', () => {
  const pendingAndAuthenticated = resolveClientLink('pending_abc', 'user_attacker');

  it('permite enlazar cuando el email del formulario es el email verificado de la cuenta', () => {
    expect(pendingAndAuthenticated).toBe('update_clerk_id');
    expect(
      canLinkPendingClient({
        decision: pendingAndAuthenticated,
        verifiedEmail: 'ana@example.com',
        contactEmail: 'ANA@example.com',
      }),
    ).toBe(true);
  });

  it('bloquea el enlace cuando el email del formulario es de otra persona', () => {
    expect(
      canLinkPendingClient({
        decision: pendingAndAuthenticated,
        verifiedEmail: 'attacker@example.com',
        contactEmail: 'victim@example.com',
      }),
    ).toBe(false);
  });

  it('bloquea el enlace si la cuenta no tiene un email verificado', () => {
    expect(
      canLinkPendingClient({
        decision: pendingAndAuthenticated,
        verifiedEmail: null,
        contactEmail: 'victim@example.com',
      }),
    ).toBe(false);
  });

  it('no interfiere con las demás decisiones', () => {
    expect(
      canLinkPendingClient({ decision: 'use_as_is', verifiedEmail: null, contactEmail: 'a@b.co' }),
    ).toBe(true);
    expect(
      canLinkPendingClient({ decision: 'conflict', verifiedEmail: null, contactEmail: 'a@b.co' }),
    ).toBe(true);
  });
});
