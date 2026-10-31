import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { QuotationWithItems } from "./types";

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function formatAddress(customer: NonNullable<QuotationWithItems["customer"]>): string {
  const parts = [
    customer.billing_address_line1,
    customer.billing_address_line2,
    [customer.billing_city, customer.billing_state, customer.billing_postal_code]
      .filter(Boolean)
      .join(", "),
    customer.billing_country,
  ].filter(Boolean);
  return parts.join("\n");
}

/**
 * Builds a quotation PDF from the frozen quotation snapshot (header + line items).
 * Safe to call after catalog prices change — uses persisted quotation_items only.
 */
export async function buildQuotationPdf(
  quotation: QuotationWithItems
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  let y = page.getHeight() - margin;

  const drawText = (
    text: string,
    x: number,
    size: number,
    bold = false,
    color = rgb(0.12, 0.16, 0.22)
  ) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: bold ? fontBold : font,
      color,
    });
  };

  drawText("Brightloop", margin, 22, true, rgb(0.09, 0.35, 0.85));
  y -= 28;
  drawText("Quotation", margin, 16, true);
  y -= 22;
  drawText(quotation.quotation_number, margin, 11);
  y -= 16;
  drawText(`Status: ${quotation.status.toUpperCase()}`, margin, 10);
  drawText(`Valid until: ${quotation.valid_until}`, margin + 200, 10);
  y -= 24;

  const customer = quotation.customer;
  if (customer) {
    drawText("Bill To", margin, 11, true);
    y -= 14;
    drawText(customer.company_name, margin, 10, true);
    y -= 12;
    drawText(`${customer.contact_name} · ${customer.email}`, margin, 9);
    y -= 12;
    const address = formatAddress(customer);
    if (address) {
      for (const line of address.split("\n")) {
        drawText(line, margin, 9);
        y -= 11;
      }
    }
    y -= 8;
  }

  drawText("Line Items", margin, 11, true);
  y -= 16;

  const colDesc = margin;
  const colQty = margin + 280;
  const colUnit = margin + 330;
  const colTotal = margin + 410;

  drawText("Description", colDesc, 9, true);
  drawText("Qty", colQty, 9, true);
  drawText("Unit", colUnit, 9, true);
  drawText("Total", colTotal, 9, true);
  y -= 12;
  page.drawLine({
    start: { x: margin, y },
    end: { x: page.getWidth() - margin, y },
    thickness: 0.5,
    color: rgb(0.85, 0.88, 0.92),
  });
  y -= 14;

  for (const item of quotation.items) {
    if (y < 120) break;
    const desc =
      item.description.length > 48
        ? `${item.description.slice(0, 45)}…`
        : item.description;
    drawText(desc, colDesc, 9);
    drawText(String(item.quantity), colQty, 9);
    drawText(formatMoney(item.unit_price, quotation.currency), colUnit, 9);
    drawText(formatMoney(item.total_amount, quotation.currency), colTotal, 9);
    y -= 14;
  }

  y -= 8;
  page.drawLine({
    start: { x: margin + 280, y },
    end: { x: page.getWidth() - margin, y },
    thickness: 0.5,
    color: rgb(0.85, 0.88, 0.92),
  });
  y -= 18;

  const totalsX = margin + 330;
  drawText("Subtotal", totalsX, 10);
  drawText(formatMoney(quotation.subtotal, quotation.currency), colTotal, 10);
  y -= 14;
  drawText("Discount", totalsX, 10);
  drawText(formatMoney(quotation.discount_amount, quotation.currency), colTotal, 10);
  y -= 14;
  drawText("Tax", totalsX, 10);
  drawText(formatMoney(quotation.tax_amount, quotation.currency), colTotal, 10);
  y -= 16;
  drawText("Total", totalsX, 12, true);
  drawText(formatMoney(quotation.total_amount, quotation.currency), colTotal, 12, true);
  y -= 28;

  if (quotation.terms) {
    drawText("Terms & Conditions", margin, 10, true);
    y -= 12;
    const terms =
      quotation.terms.length > 600
        ? `${quotation.terms.slice(0, 597)}…`
        : quotation.terms;
    for (const chunk of terms.match(/.{1,90}/g) ?? []) {
      if (y < 60) break;
      drawText(chunk, margin, 8);
      y -= 10;
    }
  }

  if (quotation.notes) {
    y -= 8;
    drawText("Notes", margin, 10, true);
    y -= 12;
    drawText(quotation.notes.slice(0, 200), margin, 8);
  }

  page.drawText("Generated from quotation snapshot — prices reflect values at issue time.", {
    x: margin,
    y: 36,
    size: 7,
    font,
    color: rgb(0.5, 0.55, 0.6),
  });

  return doc.save();
}
