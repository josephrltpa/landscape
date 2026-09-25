import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface BillData {
  header_1: string;
  header_2: string;
  header_3: string;
  header_4: string;
  dept: string;
  head_of_account: string;
  grant_no: string;
  ddo: string;
  treasury: string;
  bill_no: string;
  bill_date: string;
  remarks: string;
  table_data: string[][];
  notes: string;
  signatureImage: string | null; // base64 PNG of the signature region
  sourceFileName: string;
}

function findValue(text: string, label: string): string {
  const pattern = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[:：]\\s*(.+)', 'i');
  const match = text.match(pattern);
  if (match) {
    return match[1].trim().split('\n')[0].trim();
  }
  return '';
}

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

async function extractTextItems(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<TextItem[]> {
  const items: TextItem[] = [];
  
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    
    for (const item of content.items) {
      if ('str' in item) {
        const tx = item as any;
        items.push({
          str: tx.str,
          x: tx.transform[4],
          y: tx.transform[5],
          width: tx.width,
          height: tx.height,
          page: pageNum,
        });
      }
    }
  }
  
  return items;
}

function groupIntoRows(items: TextItem[], tolerance = 3): TextItem[][] {
  if (items.length === 0) return [];
  
  // Sort by Y descending (PDF coords have Y=0 at bottom)
  const sorted = [...items].sort((a, b) => b.y - a.y);
  
  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - currentRow[0].y) <= tolerance) {
      currentRow.push(sorted[i]);
    } else {
      // Sort current row by X
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = [sorted[i]];
    }
  }
  currentRow.sort((a, b) => a.x - b.x);
  rows.push(currentRow);
  
  return rows;
}

function detectTableColumns(rows: TextItem[][]): number[] {
  // Collect all X positions and find clusters
  const xPositions: number[] = [];
  for (const row of rows) {
    for (const item of row) {
      xPositions.push(Math.round(item.x));
    }
  }
  
  // Simple approach: find gaps in X positions
  xPositions.sort((a, b) => a - b);
  
  // Find column boundaries by looking for gaps
  const columns: number[] = [0];
  let prevX = xPositions[0];
  
  for (let i = 1; i < xPositions.length; i++) {
    if (xPositions[i] - prevX > 30) {
      columns.push(Math.round((prevX + xPositions[i]) / 2));
    }
    prevX = xPositions[i];
  }
  columns.push(9999);
  
  return columns;
}

function buildTableFromRows(rows: TextItem[][], numCols: number): string[][] {
  const table: string[][] = [];
  
  // Find column boundaries
  const allX: number[] = [];
  for (const row of rows) {
    for (const item of row) {
      allX.push(item.x);
    }
  }
  allX.sort((a, b) => a - b);
  
  // Determine column boundaries using quantiles
  const boundaries: number[] = [0];
  for (let c = 1; c < numCols; c++) {
    const idx = Math.floor((c / numCols) * allX.length);
    boundaries.push(allX[Math.min(idx, allX.length - 1)] - 10);
  }
  boundaries.push(99999);
  
  for (const row of rows) {
    const cells: string[] = new Array(numCols).fill('');
    
    for (const item of row) {
      // Find which column this item belongs to
      for (let c = 0; c < numCols; c++) {
        if (item.x >= boundaries[c] && item.x < boundaries[c + 1]) {
          cells[c] = (cells[c] + ' ' + item.str).trim();
          break;
        }
      }
    }
    
    if (cells.some(c => c.trim() !== '')) {
      table.push(cells);
    }
  }
  
  return table;
}

async function extractSignatureRegion(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  zoom = 3
): Promise<string | null> {
  try {
    // Search for signature markers
    let targetPageNum = 1;
    let clipRect = { x: 0, y: 0, width: 0, height: 0 };
    let found = false;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      
      let topY: number | null = null;
      let bottomY: number | null = null;
      let leftX: number | null = null;

      for (const item of content.items) {
        if ('str' in item) {
          const text = (item as any).str;
          if (text.includes('Digitally signed by')) {
            topY = (item as any).transform[5];
            leftX = (item as any).transform[4];
          }
          if (text.includes('Drawing and Disbursement Officer')) {
            bottomY = (item as any).transform[5];
          }
        }
      }

      if (topY !== null && bottomY !== null && leftX !== null) {
        targetPageNum = pageNum;
        // Convert from PDF coords to page coords
        const y0 = viewport.height - Math.max(topY, bottomY) - 5;
        const y1 = viewport.height - Math.min(topY, bottomY) + 5;
        clipRect = {
          x: Math.max(0, leftX - 10),
          y: y0,
          width: 230,
          height: y1 - y0,
        };
        found = true;
        break;
      }
    }

    if (!found) {
      // Fallback: use bottom-right region of last page
      const lastPage = await pdfDoc.getPage(pdfDoc.numPages);
      const viewport = lastPage.getViewport({ scale: 1 });
      clipRect = {
        x: viewport.width * 0.55,
        y: viewport.height * 0.05,
        width: viewport.width * 0.43,
        height: viewport.height * 0.23,
      };
      targetPageNum = pdfDoc.numPages;
    }

    // Render the signature region
    const page = await pdfDoc.getPage(targetPageNum);
    const viewport = page.getViewport({ scale: zoom });
    
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(clipRect.width * zoom);
    canvas.height = Math.ceil(clipRect.height * zoom);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      transform: [
        zoom, 0, 0, zoom,
        -clipRect.x * zoom,
        -(viewport.height / zoom - clipRect.y - clipRect.height) * zoom
      ],
    } as any).promise;

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Signature extraction failed:', err);
    return null;
  }
}

export async function extractBillData(file: File): Promise<BillData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  // Extract all text
  let fullText = '';
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item): item is any => 'str' in item)
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  const lines = fullText.split('\n')
    .flatMap(l => l.split(/\s{2,}/))
    .map(l => l.trim())
    .filter(l => l.length > 0);

  // Extract header lines (before "Name of Office" or "Head of Account")
  const headerLines: string[] = [];
  for (const line of lines) {
    if (/^(Name of Office|Head of Account)/i.test(line)) break;
    headerLines.push(line);
  }
  while (headerLines.length < 4) headerLines.push('');

  // Extract table data
  const textItems = await extractTextItems(pdfDoc);
  const rows = groupIntoRows(textItems);
  
  // Find the table region (look for rows with "S.No" or numeric patterns)
  let tableStartIdx = -1;
  let tableEndIdx = rows.length;
  
  for (let i = 0; i < rows.length; i++) {
    const rowText = rows[i].map(item => item.str).join(' ').toUpperCase();
    if ((rowText.includes('S.NO') || rowText.includes('S.NO.')) && rowText.includes('PAYEE')) {
      tableStartIdx = i;
      break;
    }
  }
  
  // Find notes section
  let notesStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().startsWith('note')) {
      notesStartIdx = i;
      break;
    }
  }

  let tableData: string[][] = [];
  
  if (tableStartIdx >= 0) {
    // Build table from detected rows
    const tableRows = rows.slice(tableStartIdx);
    
    // Detect number of columns (typically 6 for this bill format)
    const numCols = 6;
    tableData = buildTableFromRows(tableRows, numCols);
    
    // Clean up table data
    tableData = tableData.map(row => {
      const cleaned = row.map(cell => cell.replace(/\n/g, ' ').trim());
      while (cleaned.length < 6) cleaned.push('');
      return cleaned.slice(0, 6);
    }).filter(row => row.some(cell => cell !== ''));
  }

  // If table extraction failed, try a simpler approach
  if (tableData.length === 0) {
    // Try to find table-like content between known markers
    const allLines = fullText.split('\n').map(l => l.trim()).filter(l => l);
    let inTable = false;
    const tempTable: string[][] = [];
    
    for (const line of allLines) {
      const upper = line.toUpperCase();
      if ((upper.includes('S.NO') || upper.includes('SL.NO')) && (upper.includes('PAYEE') || upper.includes('NAME'))) {
        inTable = true;
        // Parse header
        const headerCells = line.split(/\s{2,}|\t/).filter(c => c.trim());
        while (headerCells.length < 6) headerCells.push('');
        tempTable.push(headerCells.slice(0, 6));
        continue;
      }
      if (inTable) {
        if (upper.startsWith('NOTE') || upper.startsWith('TOTAL')) {
          // Add total row and stop
          if (upper.startsWith('TOTAL')) {
            tempTable.push([line, '', '', '', '', '']);
          }
          break;
        }
        const cells = line.split(/\s{2,}|\t/).filter(c => c.trim());
        while (cells.length < 6) cells.push('');
        if (cells.some(c => c.trim())) {
          tempTable.push(cells.slice(0, 6));
        }
      }
    }
    tableData = tempTable;
  }

  // Extract signature image
  const signatureImage = await extractSignatureRegion(pdfDoc);

  const data: BillData = {
    header_1: headerLines[0] || '',
    header_2: headerLines[1] || '',
    header_3: headerLines[2] || '',
    header_4: headerLines[3] || '',
    dept: findValue(fullText, 'Name of Office/Dept/Ministry') || findValue(fullText, 'Name of Office'),
    head_of_account: findValue(fullText, 'Head of Account'),
    grant_no: findValue(fullText, 'Grant No'),
    ddo: findValue(fullText, 'DDO Code') || findValue(fullText, 'DDO Code & Name'),
    treasury: findValue(fullText, 'Treasury Code') || findValue(fullText, 'Treasury Code & Name'),
    bill_no: findValue(fullText, 'Bill No'),
    bill_date: findValue(fullText, 'Bill Date'),
    remarks: findValue(fullText, 'Remarks'),
    table_data: tableData,
    notes: notesStartIdx >= 0 ? lines.slice(notesStartIdx).join('\n') : '',
    signatureImage,
    sourceFileName: file.name,
  };

  return data;
}
