import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { InvoiceWithDetails } from "./types";

/**
 * Generates an official PDF document for an invoice.
 */
export async function generateInvoicePdf(invoice: InvoiceWithDetails): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Colors
  const primaryColor = rgb(0.1, 0.35, 0.85); // Blue
  const darkTextColor = rgb(0.1, 0.12, 0.18);
  const mutedTextColor = rgb(0.45, 0.48, 0.55);
  const borderColor = rgb(0.88, 0.9, 0.94);
  const tableHeaderBg = rgb(0.96, 0.97, 0.99);

  let cursorY = height - 50;

  // 1. Header & Company Brand
  page.drawText("BRIGHTLOOP", {
    x: 50,
    y: cursorY,
    size: 22,
    font: fontBold,
    color: primaryColor,
  });

  page.drawText("INVOICE", {
    x: width - 150,
    y: cursorY,
    size: 22,
    font: fontBold,
    color: darkTextColor,
  });

  cursorY -= 20;

  page.drawText("Enterprise Recurring Billing Platform", {
    x: 50,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: mutedTextColor,
  });

  page.drawText(invoice.invoice_number, {
    x: width - 150,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: primaryColor,
  });

  cursorY -= 35;

  // Horizontal separator
  page.drawLine({
    start: { x: 50, y: cursorY },
    end: { x: width - 50, y: cursorY },
    thickness: 1,
    color: borderColor,
  });

  cursorY -= 25;

  // 2. Bill-To & Metadata Columns
  page.drawText("BILLED TO:", {
    x: 50,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: mutedTextColor,
  });

  page.drawText("INVOICE DETAILS:", {
    x: 350,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: mutedTextColor,
  });

  cursorY -= 16;

  // Customer Name
  const customerName = invoice.customer?.company_name || invoice.customer?.contact_name || "Valued Customer";
  page.drawText(customerName, {
    x: 50,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: darkTextColor,
  });

  page.drawText(`Issue Date: ${invoice.issue_date}`, {
    x: 350,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: darkTextColor,
  });

  cursorY -= 14;

  if (invoice.customer?.email) {
    page.drawText(invoice.customer.email, {
      x: 50,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: darkTextColor,
    });
  }

  page.drawText(`Due Date: ${invoice.due_date}`, {
    x: 350,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: darkTextColor,
  });

  cursorY -= 14;

  page.drawText(`Status: ${invoice.status.toUpperCase()}`, {
    x: 350,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: invoice.status === "paid" ? rgb(0.1, 0.65, 0.3) : rgb(0.85, 0.4, 0.1),
  });

  cursorY -= 30;

  // 3. Line Items Table Header
  const tableX = 50;
  const tableW = width - 100;

  page.drawRectangle({
    x: tableX,
    y: cursorY - 6,
    width: tableW,
    height: 22,
    color: tableHeaderBg,
  });

  page.drawText("DESCRIPTION", {
    x: tableX + 10,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: mutedTextColor,
  });

  page.drawText("QTY", {
    x: tableX + 260,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: mutedTextColor,
  });

  page.drawText("UNIT PRICE", {
    x: tableX + 320,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: mutedTextColor,
  });

  page.drawText("TAX", {
    x: tableX + 400,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: mutedTextColor,
  });

  page.drawText("TOTAL", {
    x: tableX + 440,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: mutedTextColor,
  });

  cursorY -= 22;

  // 4. Line Items Rows
  for (const item of invoice.items) {
    page.drawLine({
      start: { x: tableX, y: cursorY + 12 },
      end: { x: tableX + tableW, y: cursorY + 12 },
      thickness: 0.5,
      color: borderColor,
    });

    const desc = item.description.length > 40 ? item.description.substring(0, 37) + "..." : item.description;

    page.drawText(desc, {
      x: tableX + 10,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: darkTextColor,
    });

    page.drawText(item.quantity.toString(), {
      x: tableX + 265,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: darkTextColor,
    });

    page.drawText(`$${item.unit_amount.toFixed(2)}`, {
      x: tableX + 320,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: darkTextColor,
    });

    page.drawText(`$${item.tax_amount.toFixed(2)}`, {
      x: tableX + 400,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: darkTextColor,
    });

    page.drawText(`$${item.total_amount.toFixed(2)}`, {
      x: tableX + 440,
      y: cursorY,
      size: 9,
      font: fontBold,
      color: darkTextColor,
    });

    cursorY -= 20;
  }

  cursorY -= 20;

  // 5. Summary Section
  const summaryX = 350;

  page.drawText("Subtotal:", {
    x: summaryX,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: mutedTextColor,
  });
  page.drawText(`$${invoice.subtotal.toFixed(2)}`, {
    x: summaryX + 100,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: darkTextColor,
  });

  cursorY -= 15;

  if (invoice.discount_amount > 0) {
    page.drawText("Discount:", {
      x: summaryX,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: mutedTextColor,
    });
    page.drawText(`-$${invoice.discount_amount.toFixed(2)}`, {
      x: summaryX + 100,
      y: cursorY,
      size: 9,
      font: fontRegular,
      color: rgb(0.1, 0.65, 0.3),
    });
    cursorY -= 15;
  }

  page.drawText("Tax Total:", {
    x: summaryX,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: mutedTextColor,
  });
  page.drawText(`$${invoice.tax_amount.toFixed(2)}`, {
    x: summaryX + 100,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: darkTextColor,
  });

  cursorY -= 20;

  // Total
  page.drawLine({
    start: { x: summaryX, y: cursorY + 12 },
    end: { x: summaryX + 145, y: cursorY + 12 },
    thickness: 1,
    color: primaryColor,
  });

  page.drawText("Total Amount:", {
    x: summaryX,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: darkTextColor,
  });
  page.drawText(`$${invoice.total_amount.toFixed(2)}`, {
    x: summaryX + 90,
    y: cursorY,
    size: 12,
    font: fontBold,
    color: primaryColor,
  });

  cursorY -= 18;

  page.drawText("Amount Paid:", {
    x: summaryX,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: mutedTextColor,
  });
  page.drawText(`$${invoice.amount_paid.toFixed(2)}`, {
    x: summaryX + 90,
    y: cursorY,
    size: 9,
    font: fontRegular,
    color: darkTextColor,
  });

  cursorY -= 16;

  page.drawText("Balance Due:", {
    x: summaryX,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: invoice.amount_due > 0 ? rgb(0.85, 0.2, 0.2) : rgb(0.1, 0.65, 0.3),
  });
  page.drawText(`$${invoice.amount_due.toFixed(2)}`, {
    x: summaryX + 90,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: invoice.amount_due > 0 ? rgb(0.85, 0.2, 0.2) : rgb(0.1, 0.65, 0.3),
  });

  // Footer
  page.drawText("Thank you for your business. For billing inquiries, contact billing@brightloop.io", {
    x: 50,
    y: 40,
    size: 8,
    font: fontRegular,
    color: mutedTextColor,
  });

  return await pdfDoc.save();
}
