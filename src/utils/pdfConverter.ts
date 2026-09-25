import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface ConversionResult {
  pdfBytes: Uint8Array;
  signatureReplaced: boolean;
  pageCount: number;
}

/**
 * Renders a single PDF page to a canvas at high resolution.
 */
async function renderPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  scale: number = 3
): Promise<HTMLCanvasElement> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  // Fill white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport: viewport,
  }).promise;

  return canvas;
}

/**
 * Finds the signature region on a page by searching for text markers.
 * Returns coordinates in the rendered canvas space.
 */
async function findSignatureRegion(
  page: pdfjsLib.PDFPageProxy,
  scale: number
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale });
  
  let topY: number | null = null;
  let bottomY: number | null = null;
  let leftX: number | null = null;

  for (const item of content.items) {
    if ('str' in item) {
      const text = (item as any).str;
      const tx = (item as any).transform;
      
      if (text.includes('Digitally signed by')) {
        if (topY === null || tx[5] > topY) {
          topY = tx[5];
        }
        if (leftX === null || tx[4] < leftX) {
          leftX = tx[4];
        }
      }
      if (text.includes('Drawing and Disbursement Officer')) {
        if (bottomY === null || tx[5] < bottomY) {
          bottomY = tx[5];
        }
      }
    }
  }

  if (topY !== null && bottomY !== null && leftX !== null) {
    // Convert from PDF coordinates (bottom-left origin) to canvas coordinates (top-left origin)
    const canvasTopY = viewport.height - (topY + 5) * scale;
    const canvasBottomY = viewport.height - (bottomY - 5) * scale;
    const canvasLeftX = (leftX - 10) * scale;
    const canvasRightX = canvasLeftX + 230 * scale;

    return {
      x: Math.max(0, canvasLeftX),
      y: Math.max(0, canvasTopY),
      width: Math.min(canvasRightX - canvasLeftX, viewport.width - canvasLeftX),
      height: Math.min(canvasBottomY - canvasTopY, viewport.height - canvasTopY),
    };
  }

  // Fallback: bottom-right region of the page
  return {
    x: viewport.width * 0.55,
    y: viewport.height * 0.72,
    width: viewport.width * 0.43,
    height: viewport.height * 0.23,
  };
}

/**
 * White out the signature region on a canvas
 */
function whiteOutSignatureRegion(
  canvas: HTMLCanvasElement,
  region: { x: number; y: number; width: number; height: number }
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(region.x, region.y, region.width, region.height);
}

/**
 * Draws a custom signature image onto a canvas at the specified region
 */
function drawCustomSignature(
  canvas: HTMLCanvasElement,
  signatureDataUrl: string,
  region: { x: number; y: number; width: number; height: number }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No canvas context'));
        return;
      }

      // Scale signature to fit the region while maintaining aspect ratio
      const maxW = region.width;
      const maxH = region.height;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1.0);
      const drawW = img.width * scale;
      const drawH = img.height * scale;

      // Center in the region
      const drawX = region.x + (region.width - drawW) / 2;
      const drawY = region.y + (region.height - drawH) / 2;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      resolve();
    };
    img.onerror = reject;
    img.src = signatureDataUrl;
  });
}

/**
 * Main conversion function.
 * Takes a portrait PDF and converts it to landscape by rendering each page
 * as a high-resolution image and rotating it 90° to fit landscape orientation.
 * This preserves 100% of the original formatting (tables, alignments, borders, etc.)
 */
export async function convertPdfToLandscape(
  file: File,
  customSignatureDataUrl?: string | null,
  onProgress?: (progress: number) => void
): Promise<ConversionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdfDoc.numPages;
  
  const { PDFDocument, rgb } = await import('pdf-lib');
  const outputPdf = await PDFDocument.create();
  
  // A4 Landscape dimensions in points (842 x 595)
  const LANDSCAPE_W = 842;
  const LANDSCAPE_H = 595;
  
  let signatureReplaced = false;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      onProgress(((pageNum - 1) / numPages) * 90);
    }

    const page = await pdfDoc.getPage(pageNum);
    const scale = 3; // High resolution for quality
    
    // Render page to canvas (preserves ALL formatting)
    const canvas = await renderPageToCanvas(page, scale);
    
    // If custom signature provided, find and replace the signature region
    if (customSignatureDataUrl) {
      const sigRegion = await findSignatureRegion(page, scale);
      if (sigRegion) {
        whiteOutSignatureRegion(canvas, sigRegion);
        await drawCustomSignature(canvas, customSignatureDataUrl, sigRegion);
        signatureReplaced = true;
      }
    }

    // Create a rotated canvas (90° clockwise to convert portrait → landscape)
    const rotatedCanvas = document.createElement('canvas');
    rotatedCanvas.width = canvas.height;  // original height becomes width
    rotatedCanvas.height = canvas.width;  // original width becomes height
    
    const rotCtx = rotatedCanvas.getContext('2d');
    if (!rotCtx) throw new Error('Failed to get rotated canvas context');
    
    // Fill white
    rotCtx.fillStyle = '#ffffff';
    rotCtx.fillRect(0, 0, rotatedCanvas.width, rotatedCanvas.height);
    
    // Rotate 90° clockwise
    rotCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
    rotCtx.rotate(Math.PI / 2);
    rotCtx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    
    // Convert to PNG
    const dataUrl = rotatedCanvas.toDataURL('image/png');
    const imgBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
    const pdfImage = await outputPdf.embedPng(imgBytes);
    
    // Create landscape page
    const outputPage = outputPdf.addPage([LANDSCAPE_W, LANDSCAPE_H]);
    
    // Calculate scaling to fit image in page with margins
    const margin = 12;
    const availW = LANDSCAPE_W - 2 * margin;
    const availH = LANDSCAPE_H - 2 * margin;
    
    const imgAspect = pdfImage.width / pdfImage.height;
    const pageAspect = availW / availH;
    
    let drawW: number, drawH: number;
    if (imgAspect > pageAspect) {
      drawW = availW;
      drawH = availW / imgAspect;
    } else {
      drawH = availH;
      drawW = availH * imgAspect;
    }
    
    // Center the image
    const drawX = (LANDSCAPE_W - drawW) / 2;
    const drawY = (LANDSCAPE_H - drawH) / 2;
    
    outputPage.drawImage(pdfImage, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    });
    
    // Draw border (matching original Python code's draw_page_border)
    outputPage.drawRectangle({
      x: 15,
      y: 15,
      width: LANDSCAPE_W - 30,
      height: LANDSCAPE_H - 30,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
      color: undefined,
      opacity: 1,
      borderOpacity: 1,
    });
  }

  if (onProgress) onProgress(100);

  const pdfBytes = await outputPdf.save();
  
  return {
    pdfBytes,
    signatureReplaced,
    pageCount: numPages,
  };
}
