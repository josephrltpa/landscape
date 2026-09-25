import { PDFDocument, PDFFont, StandardFonts, rgb, degrees } from 'pdf-lib';
import type { BillData } from './pdfExtractor';

// A4 Landscape dimensions in points
const PAGE_W = 842;
const PAGE_H = 595;
const BORDER_MARGIN = 15;
const LEFT_MARGIN = 30;
const RIGHT_MARGIN = 30;
const TOP_MARGIN = 20;
const BOTTOM_MARGIN = 85;

const CONTENT_W = PAGE_W - LEFT_MARGIN - RIGHT_MARGIN;

async function getFonts(pdfDoc: PDFDocument) {
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  return { helvetica, helveticaBold };
}

function drawBorder(page: any) {
  page.drawRectangle({
    x: BORDER_MARGIN,
    y: BORDER_MARGIN,
    width: PAGE_W - 2 * BORDER_MARGIN,
    height: PAGE_H - 2 * BORDER_MARGIN,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
}

function drawCenteredText(
  page: any,
  text: string,
  font: PDFFont,
  fontSize: number,
  y: number,
  color = rgb(0, 0, 0)
) {
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const x = (PAGE_W - textWidth) / 2;
  page.drawText(text, { x, y, size: fontSize, font, color });
  return y - fontSize - 2;
}

function drawText(
  page: any,
  text: string,
  font: PDFFont,
  fontSize: number,
  x: number,
  y: number,
  color = rgb(0, 0, 0)
) {
  // Truncate if too long
  const maxWidth = CONTENT_W;
  let displayText = text;
  while (font.widthOfTextAtSize(displayText, fontSize) > maxWidth && displayText.length > 0) {
    displayText = displayText.slice(0, -1);
  }
  page.drawText(displayText, { x, y, size: fontSize, font, color });
}

function drawMetadataTable(
  page: any,
  data: BillData,
  fonts: { helvetica: PDFFont; helveticaBold: PDFFont },
  startY: number
): number {
  const rows = [
    ['Name of Office/Dept/Ministry', `: ${data.dept}`],
    ['Head of Account', `: ${data.head_of_account}`],
    ['Grant No.', `: ${data.grant_no}`],
    ['DDO Code & Name', `: ${data.ddo}`],
    ['Treasury Code & Name', `: ${data.treasury}`],
    ['Bill No', `: ${data.bill_no}`],
    ['Bill Date', `: ${data.bill_date}`],
    ['Remarks', `: ${data.remarks}`],
  ];

  const labelWidth = 200;
  const rowHeight = 14;
  let y = startY;

  for (const [label, value] of rows) {
    drawText(page, label, fonts.helveticaBold, 9, LEFT_MARGIN, y);
    drawText(page, value, label === 'Name of Office/Dept/Ministry' || label === 'Head of Account' ? fonts.helveticaBold : fonts.helvetica, 9, LEFT_MARGIN + labelWidth, y);
    y -= rowHeight;
  }

  return y;
}

function drawMainTable(
  page: any,
  tableData: string[][],
  fonts: { helvetica: PDFFont; helveticaBold: PDFFont },
  startY: number
): number {
  if (tableData.length === 0) return startY;

  const colWidths = [40, 222, 140, 130, 130, 120];
  const totalTableWidth = colWidths.reduce((a, b) => a + b, 0);
  const tableX = LEFT_MARGIN;
  const rowHeight = 16;
  const fontSize = 8;
  const cellPadding = 3;

  let y = startY;

  // Check available space - if not enough, we'd need pagination (simplified here)
  const maxRows = Math.floor((y - BORDER_MARGIN - BOTTOM_MARGIN) / rowHeight);
  const displayData = tableData.slice(0, maxRows);

  // Draw table
  for (let rowIdx = 0; rowIdx < displayData.length; rowIdx++) {
    const row = displayData[rowIdx];
    const rowStr = row.join(' ').toUpperCase();
    const isTotalRow = rowStr.includes('TOTAL');
    const isAmountRow = ['LAKH', 'THOUSAND', 'HUNDRED', 'CRORE'].some(w => rowStr.includes(w));
    const isHeader = rowIdx === 0;

    const currentFont = (isHeader || isTotalRow || isAmountRow) ? fonts.helveticaBold : fonts.helvetica;

    // Draw row background for header
    if (isHeader) {
      page.drawRectangle({
        x: tableX,
        y: y - rowHeight + 3,
        width: totalTableWidth,
        height: rowHeight,
        color: rgb(0.93, 0.93, 0.93),
      });
    }

    // Draw cells
    let cellX = tableX;
    for (let colIdx = 0; colIdx < row.length && colIdx < colWidths.length; colIdx++) {
      const cellWidth = colWidths[colIdx];
      let cellText = row[colIdx] || '';

      // Truncate text to fit cell
      while (currentFont.widthOfTextAtSize(cellText, fontSize) > cellWidth - cellPadding * 2 && cellText.length > 0) {
        cellText = cellText.slice(0, -1);
      }

      const textX = cellX + cellPadding;
      const textY = y - rowHeight + 5;

      drawText(page, cellText, currentFont, fontSize, textX, textY);

      // Draw cell border
      page.drawRectangle({
        x: cellX,
        y: y - rowHeight + 3,
        width: cellWidth,
        height: rowHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });

      cellX += cellWidth;
    }

    y -= rowHeight;
  }

  return y;
}

function drawSignatureBlock(
  page: any,
  signatureImage: any,
  fonts: { helvetica: PDFFont; helveticaBold: PDFFont },
  startY: number
) {
  const sigAreaX = LEFT_MARGIN + 500;
  const sigAreaWidth = 282;
  const maxSigW = 260;
  const maxSigH = 95;

  if (signatureImage) {
    // Draw signature image centered in the right area
    const imgDims = signatureImage.scale(1);
    const scale = Math.min(maxSigW / imgDims.width, maxSigH / imgDims.height, 1.0);
    const drawW = imgDims.width * scale;
    const drawH = imgDims.height * scale;

    const imgX = sigAreaX + (sigAreaWidth - drawW) / 2;
    const imgY = startY - drawH;

    page.drawImage(signatureImage, {
      x: imgX,
      y: imgY,
      width: drawW,
      height: drawH,
    });

    // Draw label below signature
    drawCenteredText(
      page,
      'Drawing and Disbursement Officer',
      fonts.helvetica,
      7,
      imgY - 12,
    );
  } else {
    // Draw placeholder
    page.drawRectangle({
      x: sigAreaX + 10,
      y: startY - maxSigH,
      width: maxSigW,
      height: maxSigH,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
      borderDashArray: [3, 3],
    });
    drawCenteredText(
      page,
      '[Signature]',
      fonts.helvetica,
      10,
      startY - maxSigH / 2,
      rgb(0.6, 0.6, 0.6)
    );
  }
}

function drawNotes(
  page: any,
  notes: string,
  fonts: { helvetica: PDFFont; helveticaBold: PDFFont },
) {
  if (!notes) return;

  const noteLines = notes.split('\n').filter(l => l.trim());
  const fontSize = 8;
  const lineHeight = 11;
  let y = BORDER_MARGIN + 60;

  for (const line of noteLines) {
    const isBold = line.toLowerCase().startsWith('note');
    const font = isBold ? fonts.helveticaBold : fonts.helvetica;
    drawText(page, line.trim(), font, fontSize, BORDER_MARGIN + 10, y);
    y -= lineHeight;
  }
}

export async function generateLandscapePDF(
  data: BillData,
  customSignatureDataUrl?: string | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const fonts = await getFonts(pdfDoc);

  // Draw border
  drawBorder(page);

  // Draw headers (centered)
  let y = PAGE_H - TOP_MARGIN - 5;
  
  if (data.header_1) y = drawCenteredText(page, data.header_1, fonts.helveticaBold, 12, y);
  if (data.header_2) y = drawCenteredText(page, data.header_2, fonts.helveticaBold, 11, y);
  if (data.header_3) y = drawCenteredText(page, data.header_3, fonts.helvetica, 10, y);
  if (data.header_4) y = drawCenteredText(page, data.header_4, fonts.helveticaBold, 10, y);
  
  y -= 5;

  // Draw metadata
  y = drawMetadataTable(page, data, fonts, y);
  y -= 5;

  // Draw "Details of Payee" label
  drawText(page, 'Details of Payee', fonts.helveticaBold, 9, LEFT_MARGIN, y);
  y -= 8;

  // Draw main table
  y = drawMainTable(page, data.table_data, fonts, y);
  y -= 10;

  // Load signature image
  let signatureImage = null;
  const sigSource = customSignatureDataUrl || data.signatureImage;
  
  if (sigSource) {
    try {
      if (sigSource.startsWith('data:image/png')) {
        const base64 = sigSource.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        signatureImage = await pdfDoc.embedPng(bytes);
      } else if (sigSource.startsWith('data:image/jpeg') || sigSource.startsWith('data:image/jpg')) {
        const base64 = sigSource.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        signatureImage = await pdfDoc.embedJpg(bytes);
      }
    } catch (err) {
      console.error('Failed to embed signature image:', err);
    }
  }

  // Draw signature block
  drawSignatureBlock(page, signatureImage, fonts, y);

  // Draw notes at bottom
  drawNotes(page, data.notes, fonts);

  return pdfDoc.save();
}
