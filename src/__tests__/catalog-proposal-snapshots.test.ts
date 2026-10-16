import { describe, it, expect, vi, beforeEach } from 'vitest';

// Define process.env before anything else
process.env.ADMIN_CLERK_USER_ID = 'test_admin_id';

import { db } from '@/db';
import { appRouter } from '@/server/routers';
import { createProjectAction } from '@/app/admin/proyectos/actions';
import { renderProposalHtml, renderProposalPlainText } from '@/lib/calculadora/proposal-template';

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'test_admin_id' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Mock inngest so it doesn't fail on sendProposal
vi.mock('@/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

describe('Commercial proposal snapshots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies catalogSnapshot from quote to project when creating from quote', async () => {
    const mockSnapshot = {
      plan: 'PRO',
      included: [{ name: 'Included 1' }],
      recommendedAddOns: [{ code: 'ADDON_1', priceCents: 1000 }],
      quoteRequired: [],
      generatedAt: new Date().toISOString()
    };

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ catalogSnapshot: mockSnapshot }])
    };
    (db.select as any).mockReturnValue(mockSelect);

    const mockInsert = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'new-project-id' }])
    };
    (db.insert as any).mockReturnValue(mockInsert);

    await createProjectAction({
      clientId: 'client-id',
      plan: 'PRO',
      monthlyPriceCents: 5000,
      setupFeeCents: 5000,
      portfolioFlag: false,
      quoteId: 'quote-id',
    });

    expect(mockInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        catalogSnapshot: mockSnapshot,
      })
    );
  });

  it('validates selected addons and calculates total on the server side', async () => {
    const caller = appRouter.createCaller({ userId: 'test_admin_id' } as any);

    const mockSnapshot = {
      recommendedAddOns: [
        { code: 'ADDON_1', priceCents: 1500 },
        { code: 'ADDON_2', priceCents: 2000 },
      ]
    };

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'mock-id', status: 'DRAFT', catalogSnapshot: mockSnapshot }])
    };
    (db.select as any).mockReturnValue(mockSelect);

    const mockUpdate = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{ id: 'project-id', status: 'PROPOSAL_SENT' }])
    };
    (db.update as any).mockReturnValue(mockUpdate);

    // mock the audit insert
    const mockInsert = {
      values: vi.fn().mockReturnThis(),
    };
    (db.insert as any).mockReturnValue(mockInsert);

    await caller.admin.sendProposal({
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      selectedAddOns: ['ADDON_1', 'ADDON_2'],
      snapshotSource: 'project_snapshot'
    });

    expect(mockInsert.values).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          selectedAddOns: ['ADDON_1', 'ADDON_2'],
          snapshotSource: 'project_snapshot',
          calculatedAddOnTotalCents: 3500
        })
      })
    );
  });

  it('rejects invalid selected addons', async () => {
    const caller = appRouter.createCaller({ userId: 'test_admin_id' } as any);

    const mockSnapshot = {
      recommendedAddOns: [
        { code: 'ADDON_1', priceCents: 1500 },
      ]
    };

    const mockSelect = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'mock-id', status: 'DRAFT', catalogSnapshot: mockSnapshot }])
    };
    (db.select as any).mockReturnValue(mockSelect);

    await expect(caller.admin.sendProposal({
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      selectedAddOns: ['INVALID_ADDON']
    })).rejects.toThrow(/Add-on seleccionado inválido/);
  });

  it('renders snapshot blocks in HTML and plaintext templates', async () => {
    const mockSnapshot = {
      plan: 'PRO',
      included: [{ name: 'Included 1', publicName: 'Included One' }],
      recommendedAddOns: [{ name: 'Addon 1', code: 'ADDON_1', priceCents: 1000 }],
      quoteRequired: [{ name: 'Custom Feature' }],
      generatedAt: new Date().toISOString()
    };

    const proposalData = {
      clientName: 'Client',
      businessName: 'Business',
      industry: 'Industry',
      projectType: 'saas',
      executiveSummary: 'Summary',
      createdAt: new Date(),
      validUntil: new Date(),
      status: 'draft' as any,
      catalogSnapshot: mockSnapshot,
      calculation: {
        components: [],
        totals: { clientTotal: 50, setupTotal: 0, providerNet: 50 },
      },
      paymentStructure: {
        initialPaymentCents: 5000,
        monthlyPaymentCents: 5000,
      }
    };

    const html = await renderProposalHtml(proposalData as any);
    expect(html).toContain('Included One');
    expect(html).toContain('Addon 1');
    expect(html).toContain('Custom Feature');

    const plaintext = await renderProposalPlainText(proposalData as any);
    expect(plaintext).toContain('✓ Included One');
    expect(plaintext).toContain('• Addon 1');
    expect(plaintext).toContain('• Custom Feature');
  });
});
