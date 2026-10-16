// ============================================================
// Template de Propuesta Ejecutiva WaaS
// Genera HTML para: email (Resend), PDF, preview en pantalla
// ============================================================

import type { ProposalData } from './types';
import { formatUSD } from './formulas';

// Renderiza la propuesta como HTML string (para Resend / snapshot en DB)
export async function renderProposalHtml(proposal: ProposalData): Promise<string> {
  const { calculation, paymentStructure } = proposal;
  const isLegacy = !proposal.subscriptionPlan;

  const BASE_IDS = new Set(['base_price_display', 'pages_extra_display']);

  const baseRows = calculation.components
    .filter((c) => BASE_IDS.has(c.id))
    .map(
      (c) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">${c.name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: right; font-weight: 500;">${formatUSD(c.price)}</td>
      </tr>`
    )
    .join('');

  const addonComponents = calculation.components.filter((c) => !BASE_IDS.has(c.id));

  const addonRows = addonComponents.length > 0
    ? `
      <tr>
        <td colspan="2" style="padding: 6px 12px 4px; background: #f3f4f6; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb;">Componentes adicionales</td>
      </tr>
      ${addonComponents
        .map((c) => {
          const priceDisplay = formatUSD(c.price);
          return `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">${c.name}</td>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151; text-align: right; font-weight: 500;">${priceDisplay}</td>
      </tr>`;
        })
        .join('')}`
    : '';

  const componentRows = baseRows + addonRows;

  const discountRow =
    calculation.finalDiscountPercent > 0
      ? `
      <tr>
        <td style="padding: 8px 12px; color: #059669; font-size: 14px;">Descuento (${(calculation.finalDiscountPercent * 100).toFixed(0)}%)</td>
        <td style="padding: 8px 12px; color: #059669; font-size: 14px; text-align: right; font-weight: 500;">−${formatUSD(calculation.finalDiscountAmount)}</td>
      </tr>`
      : '';

  const addOnDiscountRow =
    calculation.addOnDiscountPercent > 0
      ? `
      <tr>
        <td style="padding: 8px 12px; color: #059669; font-size: 14px;">Descuento por volumen add-ons (−10%)</td>
        <td style="padding: 8px 12px; color: #059669; font-size: 14px; text-align: right; font-weight: 500;">−${formatUSD(calculation.addOnDiscountAmount)}</td>
      </tr>`
      : '';

  const installmentsSection =
    paymentStructure === 'installments' && calculation.installments
      ? `
      <div style="margin-top: 24px; padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
        <h3 style="margin: 0 0 12px; font-size: 14px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px;">Estructura de Pago en Cuotas</h3>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">Cuota 1 — Al firmar (50%)</td>
            <td style="padding: 6px 0; font-size: 14px; color: #374151; text-align: right; font-weight: 600;">${formatUSD(calculation.installments.installment1)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">Cuota 2 — Entrega en staging (25%)</td>
            <td style="padding: 6px 0; font-size: 14px; color: #374151; text-align: right; font-weight: 600;">${formatUSD(calculation.installments.installment2)}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; font-size: 14px; color: #374151;">Cuota 3 — Aprobación final (25%)</td>
            <td style="padding: 6px 0; font-size: 14px; color: #374151; text-align: right; font-weight: 600;">${formatUSD(calculation.installments.installment3)}</td>
          </tr>
          <tr>
            <td colspan="2" style="padding-top: 8px; border-top: 2px solid #86efac;"></td>
          </tr>
          <tr>
            <td style="padding: 8px 0 4px; font-size: 15px; font-weight: 700; color: #15803d;">Total (precio fraccionado)</td>
            <td style="padding: 8px 0 4px; font-size: 15px; font-weight: 700; color: #15803d; text-align: right;">${formatUSD(calculation.installments.totalClientPays)}</td>
          </tr>
        </table>
        <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280; font-style: italic;">
          * El precio fraccionado incluye el costo de procesamiento de cada transacción PayPal.
          Para pago de contado el total es ${formatUSD(calculation.finalClientPriceRounded)}.
        </p>
      </div>`
      : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Propuesta Ejecutiva — ${proposal.businessName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; color: #111827;">

  <div style="max-width: 680px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="background: #111827; border-radius: 12px 12px 0 0; padding: 32px; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">Website as a Service</p>
      <h1 style="margin: 0 0 8px; font-size: 28px; font-weight: 800; color: #ffffff;">Propuesta Ejecutiva</h1>
      <p style="margin: 0; font-size: 16px; color: #d1d5db; font-weight: 500;">${proposal.businessName}</p>
    </div>

    <!-- Meta info -->
    <div style="background: #1f2937; padding: 16px 32px; display: flex; justify-content: space-between;">
      <div>
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">Preparada por</p>
        <p style="margin: 4px 0 0; font-size: 14px; color: #f3f4f6; font-weight: 600;">Xavier Quirico</p>
      </div>
      <div style="text-align: right;">
        <p style="margin: 0; font-size: 12px; color: #9ca3af;">Válida hasta</p>
        <p style="margin: 4px 0 0; font-size: 14px; color: #f59e0b; font-weight: 600;">${proposal.validUntil.toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
    </div>

    <!-- Body -->
    <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">

      <!-- Resumen del proyecto -->
      <div style="margin-bottom: 28px; padding: 20px; background: #f8fafc; border-radius: 8px; border-left: 4px solid #111827;">
        <h2 style="margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 700;">Resumen del Proyecto</h2>
        <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #374151;">${proposal.executiveSummary}</p>
      </div>

      </div>

      ${proposal.catalogSnapshot ? `
      <!-- Capacidades del catálogo -->
      <div style="margin-bottom: 28px;">
        <h2 style="margin: 0 0 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 700;">Capacidades del Proyecto</h2>
        
        ${proposal.catalogSnapshot.included.length > 0 ? `
        <div style="margin-bottom: 16px; padding: 16px; background: #ecfdf5; border-radius: 8px; border: 1px solid #a7f3d0;">
          <h3 style="margin: 0 0 12px; font-size: 13px; color: #065f46; font-weight: 700;">✓ Incluido en tu plan</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #064e3b; line-height: 1.6;">
            ${proposal.catalogSnapshot.included.map(cap => `<li>${cap.publicName || cap.name}</li>`).join('')}
          </ul>
        </div>` : ''}

        ${proposal.catalogSnapshot.recommendedAddOns.length > 0 ? `
        <div style="margin-bottom: 16px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 12px; font-size: 13px; color: #374151; font-weight: 700;">Recomendado como add-on</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #4b5563; line-height: 1.6;">
            ${proposal.catalogSnapshot.recommendedAddOns.map(cap => `<li>${cap.publicName || cap.name} ${cap.priceCents != null ? `(+${formatUSD(cap.priceCents / 100)})` : ''}</li>`).join('')}
          </ul>
        </div>` : ''}

        ${proposal.catalogSnapshot.quoteRequired.length > 0 ? `
        <div style="margin-bottom: 16px; padding: 16px; background: #fffbeb; border-radius: 8px; border: 1px solid #fde68a;">
          <h3 style="margin: 0 0 12px; font-size: 13px; color: #92400e; font-weight: 700;">⚠ Requiere cotización adicional</h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #78350f; line-height: 1.6;">
            ${proposal.catalogSnapshot.quoteRequired.map(cap => `<li>${cap.publicName || cap.name} — precio a confirmar</li>`).join('')}
          </ul>
        </div>` : ''}
      </div>
      ` : ''}

      <!-- Desglose de inversión -->
      <h2 style="margin: 0 0 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 700;">Desglose de Inversión</h2>

      <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 0;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Componente</th>
            <th style="padding: 10px 12px; text-align: right; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; border-bottom: 1px solid #e5e7eb;">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${componentRows}
        </tbody>
        <tfoot>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-top: 2px solid #e5e7eb;">Subtotal bruto</td>
            <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; border-top: 2px solid #e5e7eb; text-align: right;">${formatUSD(calculation.grossSubtotal)}</td>
          </tr>
          ${addOnDiscountRow}
          ${discountRow}
          ${isLegacy ? `
          <tr style="background: #f9fafb;">
            <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">Comisión de procesamiento PayPal</td>
            <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; text-align: right;">+${formatUSD(calculation.paypalFeeAmount)}</td>
          </tr>
          <tr style="background: #111827;">
            <td style="padding: 14px 12px; font-size: 16px; font-weight: 800; color: #ffffff;">INVERSIÓN TOTAL</td>
            <td style="padding: 14px 12px; font-size: 20px; font-weight: 800; color: #ffffff; text-align: right;">${formatUSD(calculation.finalClientPriceRounded)}</td>
          </tr>` : `
          <tr style="background: #111827;">
            <td style="padding: 14px 12px; font-size: 15px; font-weight: 800; color: #ffffff;">MENSUALIDAD</td>
            <td style="padding: 14px 12px; font-size: 18px; font-weight: 800; color: #FF8C00; text-align: right;">${formatUSD(calculation.netSubtotal)}/mes</td>
          </tr>
          ${calculation.netAddOnsTotal > 0 ? `
          <tr style="background: #1a1a1a;">
            <td style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #ffffff;">ADD-ONS (COBRO ÚNICO)</td>
            <td style="padding: 10px 12px; font-size: 16px; font-weight: 700; color: #e0e0e0; text-align: right;">${formatUSD(calculation.netAddOnsTotal)}</td>
          </tr>` : ''}
          ${calculation.setupFeeAmount > 0 ? `
          <tr style="background: #1a1a1a;">
            <td style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #ffffff;">ACTIVACIÓN ÚNICA (setup fee)</td>
            <td style="padding: 10px 12px; font-size: 16px; font-weight: 700; color: #e0e0e0; text-align: right;">${formatUSD(calculation.setupFeeAmount)}</td>
          </tr>` : ''}`}
        </tfoot>
      </table>

      ${installmentsSection}

      ${calculation.domainStatus !== 'none' ? `
      <!-- Nota de dominio -->
      <div style="margin-top: 16px; padding: 12px 16px; background: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
        <p style="margin: 0; font-size: 13px; color: #1e40af;">
          🌐 <strong>${calculation.domainStatus === 'client_has_domain'
            ? 'Dominio propio — el cliente ya cuenta con su dominio, solo configuramos los registros DNS.'
            : `Dominio: <em>${calculation.domainTarget ?? ''}</em> — precio de referencia anual: ${calculation.domainPrice !== undefined ? formatUSD(calculation.domainPrice) : '~$14'}. El cliente adquiere el dominio directamente; al recibir el pago final se entregan los registros DNS.`}
        </strong>
        </p>
      </div>` : ''}

      <!-- Cronograma -->
      <div style="margin-top: 28px;">
        <h2 style="margin: 0 0 16px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; font-weight: 700;">Cronograma</h2>
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
          <div style="display: flex; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; align-items: flex-start;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #111827; margin-top: 3px; margin-right: 12px; flex-shrink: 0;"></div>
            <div>
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #374151;">Inicio del proyecto</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">Una vez confirmado el primer pago</p>
            </div>
          </div>
          <div style="display: flex; padding: 12px 16px; border-bottom: 1px solid #e5e7eb; align-items: flex-start;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #6b7280; margin-top: 3px; margin-right: 12px; flex-shrink: 0;"></div>
            <div>
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #374151;">Entrega en staging (preview)</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">72 horas hábiles desde el inicio · ${proposal.stagingDeadline}</p>
            </div>
          </div>
          <div style="display: flex; padding: 12px 16px; align-items: flex-start;">
            <div style="width: 12px; height: 12px; border-radius: 50%; background: #6b7280; margin-top: 3px; margin-right: 12px; flex-shrink:0;"></div>
            <div>
              <p style="margin: 0; font-size: 13px; font-weight: 600; color: #374151;">Entrega final</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">Tras aprobación del cliente (ventana: 72h) · ~${proposal.finalDeliveryEstimate}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Términos -->
      <div style="margin-top: 28px; padding: 16px; background: #fefce8; border-radius: 8px; border: 1px solid #fde68a;">
        <h2 style="margin: 0 0 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #92400e; font-weight: 700;">Términos del Servicio</h2>
        <ul style="margin: 0; padding-left: 18px; font-size: 14px; color: #78350f; line-height: 1.8;">
          ${proposal.projectType === 'subscription'
            ? '<li>Permanencia mínima: <strong>6 meses</strong> desde la activación</li><li>El mantenimiento mensual incluye correcciones de contenido vía ticket</li><li>El sitio web es administrado exclusivamente por Xavier</li>'
            : '<li>El sitio es <strong>100% propiedad del cliente</strong> al recibir el pago final</li><li>Garantía de ajustes post-entrega: <strong>30 días</strong> sin costo adicional</li><li>Incluye repositorio Git + archivos Figma + sesión de handoff (60 min)</li>'}
          <li>Procesamiento de pagos vía <strong>PayPal Business</strong></li>
          <li>Validez de esta propuesta: <strong>${(proposal.validUntil.getTime() - proposal.createdAt.getTime()) / (1000 * 60 * 60 * 24) | 0} días naturales</strong></li>
        </ul>
      </div>

      <!-- CTA -->
      <div style="margin-top: 32px; text-align: center; padding: 24px; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
        <h3 style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #111827;">¿Listo para empezar?</h3>
        <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280;">Confirma esta propuesta para iniciar tu proyecto</p>
        <a href="#" style="display: inline-block; padding: 14px 32px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 700;">Confirmar y Pagar →</a>
      </div>

    </div>

    <!-- Footer -->
    <div style="margin-top: 24px; text-align: center;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">Xavier Quirico · Website as a Service · República Dominicana</p>
      <p style="margin: 4px 0 0; font-size: 12px; color: #d1d5db;">Propuesta generada el ${proposal.createdAt.toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
    </div>

  </div>
</body>
</html>`;

  return html;
}

// ─── Genera texto plano para WhatsApp / SMS ───────────────
export function renderProposalPlainText(proposal: ProposalData): string {
  const { calculation, paymentStructure } = proposal;
  const isLegacy = !proposal.subscriptionPlan;

  const priceLines = isLegacy
    ? [`  TOTAL: ${formatUSD(calculation.finalClientPriceRounded)}`]
    : [
        `  Mensualidad: ${formatUSD(calculation.netSubtotal)}/mes`,
        ...(calculation.setupFeeAmount > 0 ? [`  Activación única: ${formatUSD(calculation.setupFeeAmount)}`] : []),
        ...(calculation.netAddOnsTotal > 0 ? [`  Add-ons (cobro único): ${formatUSD(calculation.netAddOnsTotal)}`] : []),
      ];

  const lines: string[] = [
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `PROPUESTA EJECUTIVA`,
    `${proposal.businessName}`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📋 ${proposal.executiveSummary}`,
    ``,
    ...(proposal.catalogSnapshot && proposal.catalogSnapshot.included.length > 0 ? [
      `📦 INCLUIDO EN TU PLAN:`,
      ...proposal.catalogSnapshot.included.map(cap => `  ✓ ${cap.publicName || cap.name}`),
      ``,
    ] : []),
    ...(proposal.catalogSnapshot && proposal.catalogSnapshot.recommendedAddOns.length > 0 ? [
      `⚡ RECOMENDADO COMO ADD-ON:`,
      ...proposal.catalogSnapshot.recommendedAddOns.map(cap => `  • ${cap.publicName || cap.name} ${cap.priceCents != null ? `(+${formatUSD(cap.priceCents / 100)})` : ''}`),
      ``,
    ] : []),
    ...(proposal.catalogSnapshot && proposal.catalogSnapshot.quoteRequired.length > 0 ? [
      `⚠ REQUIERE COTIZACIÓN:`,
      ...proposal.catalogSnapshot.quoteRequired.map(cap => `  • ${cap.publicName || cap.name}`),
      ``,
    ] : []),
    `💰 DESGLOSE:`,
    ...calculation.components.map((c) => `  • ${c.name}: ${formatUSD(c.price)}`),
    ``,
    `  Subtotal: ${formatUSD(calculation.grossSubtotal)}`,
    ...(calculation.finalDiscountPercent > 0
      ? [`  Descuento -${(calculation.finalDiscountPercent * 100).toFixed(0)}%: -${formatUSD(calculation.finalDiscountAmount)}`]
      : []),
    ...(isLegacy ? [`  Comisión PayPal: +${formatUSD(calculation.paypalFeeAmount)}`] : []),
    `  ──────────────────`,
    ...priceLines,
    ``,
    ...(paymentStructure === 'installments' && calculation.installments
      ? [
          `📅 CUOTAS:`,
          `  Cuota 1 (al firmar): ${formatUSD(calculation.installments.installment1)}`,
          `  Cuota 2 (staging): ${formatUSD(calculation.installments.installment2)}`,
          `  Cuota 3 (final): ${formatUSD(calculation.installments.installment3)}`,
          ``,
        ]
      : []),
    `⏱ CRONOGRAMA:`,
    `  • Entrega en staging: ~72h hábiles`,
    `  • Revisión: 72h`,
    `  • Entrega final: ~${proposal.finalDeliveryEstimate}`,
    ``,
    `✅ Válida hasta: ${proposal.validUntil.toLocaleDateString('es-DO')}`,
    ``,
    // El enlace de pago se genera al confirmar el proyecto
    `Para confirmar, responde este mensaje.`,
    `Xavier Quirico · WaaS`,
  ];

  return lines.join('\n');
}
