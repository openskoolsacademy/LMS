import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import JSZip from 'jszip';

/**
 * Generate a unique certificate ID in the format OPSK-YYYY-NNNN
 * @param {string[]} existingIds - Array of existing certificate IDs to avoid duplicates
 * @returns {string} Unique certificate ID
 */
export function generateCertificateId(existingIds = []) {
  const year = new Date().getFullYear();
  const prefix = `OPSK-${year}-`;
  
  // Find the highest existing number for this year
  let maxNum = 0;
  existingIds.forEach(id => {
    if (id && id.startsWith(prefix)) {
      const num = parseInt(id.replace(prefix, ''), 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });

  return `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
}

/**
 * Generate multiple sequential certificate IDs
 * @param {number} count - Number of IDs to generate
 * @param {string[]} existingIds - Array of existing certificate IDs
 * @returns {string[]} Array of unique certificate IDs
 */
export function generateBulkCertificateIds(count, existingIds = []) {
  const ids = [];
  const allIds = [...existingIds];
  for (let i = 0; i < count; i++) {
    const newId = generateCertificateId(allIds);
    ids.push(newId);
    allIds.push(newId);
  }
  return ids;
}

/**
 * A4 Landscape dimensions in mm
 */
const A4_WIDTH_MM = 297;
const A4_HEIGHT_MM = 210;

/**
 * Template dimensions in px (the fixed certificate layout size)
 */
const TEMPLATE_WIDTH_PX = 1122;
const TEMPLATE_HEIGHT_PX = 794;

/**
 * Helper: Prepare an offscreen clone of the certificate element for capture.
 * - Clones the element
 * - Converts <canvas> (QR codes) to <img>
 * - Strips box-shadow
 * - Places it offscreen at the fixed template size
 * Returns { container, clone } — caller must remove container when done.
 */
function prepareOffscreenClone(element) {
  const clone = element.cloneNode(true);

  // Convert any <canvas> elements (QR codes) to <img> with data URLs
  const originalCanvases = element.querySelectorAll('canvas');
  const clonedCanvases = clone.querySelectorAll('canvas');
  originalCanvases.forEach((canvas, i) => {
    try {
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.width = canvas.width;
      img.height = canvas.height;
      img.style.width = canvas.style.width || canvas.width + 'px';
      img.style.height = canvas.style.height || canvas.height + 'px';
      if (clonedCanvases[i] && clonedCanvases[i].parentNode) {
        clonedCanvases[i].parentNode.replaceChild(img, clonedCanvases[i]);
      }
    } catch (e) {
      console.warn('Could not convert canvas to image:', e);
    }
  });

  // Remove visual artefacts that shouldn't appear in the PDF
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.borderRadius = '0';

  // Force the clone to the exact template dimensions (no responsive overrides)
  clone.style.width = TEMPLATE_WIDTH_PX + 'px';
  clone.style.height = TEMPLATE_HEIGHT_PX + 'px';
  clone.style.minWidth = TEMPLATE_WIDTH_PX + 'px';
  clone.style.minHeight = TEMPLATE_HEIGHT_PX + 'px';
  clone.style.maxWidth = TEMPLATE_WIDTH_PX + 'px';
  clone.style.maxHeight = TEMPLATE_HEIGHT_PX + 'px';
  clone.style.overflow = 'hidden';
  clone.style.transform = 'none'; // Remove any CSS scale()

  // Place the clone in a fixed-size offscreen container
  // Match body-level CSS so html2canvas renders text identically
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: ${TEMPLATE_WIDTH_PX}px;
    height: ${TEMPLATE_HEIGHT_PX}px;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    z-index: -9999;
    font-size: 16px;
    font-family: 'Open Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    color: #0f172a;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    box-sizing: border-box;
  `;
  container.appendChild(clone);
  document.body.appendChild(container);

  return { container, clone };
}

/**
 * Core: Capture an element as a high-quality A4 landscape PDF.
 * Uses html2canvas at 3× scale for sharp text/images, then jsPDF
 * to produce a proper A4 document (not a screenshot).
 *
 * @param {HTMLElement} element - The rendered certificate DOM element (original)
 * @returns {Promise<jsPDF>} The generated PDF document
 */
async function captureElementToPDF(element) {
  // Wait for all fonts to be fully loaded
  await document.fonts.ready;

  const { container, clone } = prepareOffscreenClone(element);

  // Brief pause for the DOM to settle and images to render
  await new Promise(r => setTimeout(r, 200));

  // Wait for all images in the clone to finish loading
  const images = clone.querySelectorAll('img');
  if (images.length > 0) {
    await Promise.all(
      Array.from(images).map(img =>
        img.complete
          ? Promise.resolve()
          : new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            })
      )
    );
  }

  try {
    const canvas = await html2canvas(clone, {
      scale: 3,                       // 3× for crisp output
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: TEMPLATE_WIDTH_PX,
      height: TEMPLATE_HEIGHT_PX,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      windowWidth: TEMPLATE_WIDTH_PX,
      windowHeight: TEMPLATE_HEIGHT_PX,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    // Place image at exact A4 dimensions — no extra margins or offsets
    pdf.addImage(imgData, 'PNG', 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);

    return pdf;
  } finally {
    // Always clean up the offscreen clone
    document.body.removeChild(container);
  }
}

/**
 * Download a certificate as a clean A4 PDF.
 * This is the primary function used by student-facing and admin single-download buttons.
 *
 * @param {HTMLElement} element - The rendered certificate DOM element
 * @param {string} fileName - Desired file name (without .pdf extension)
 */
export async function printCertificateAsPDF(element, fileName = 'Certificate') {
  const pdf = await captureElementToPDF(element);
  pdf.save(`${fileName}.pdf`);
}

/**
 * Generate PDF from element (used by bulk download and other callers).
 */
export async function generatePDFFromElement(element, fileName = 'certificate') {
  return captureElementToPDF(element);
}

/**
 * Legacy: Download a single certificate as PDF using html2canvas (kept for backward compat)
 */
export async function downloadCertificatePDF(element, fileName = 'certificate') {
  const pdf = await generatePDFFromElement(element, fileName);
  pdf.save(`${fileName}.pdf`);
}

/**
 * Generate a ZIP file containing multiple certificate PDFs
 * @param {Array<{element: HTMLElement, fileName: string}>} certificates
 * @returns {Promise<void>}
 */
export async function downloadCertificatesAsZip(certificates) {
  const zip = new JSZip();
  
  for (let i = 0; i < certificates.length; i++) {
    const { element, fileName } = certificates[i];
    const pdf = await generatePDFFromElement(element, fileName);
    const pdfBlob = pdf.output('blob');
    zip.file(`${fileName}.pdf`, pdfBlob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `certificates_${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV/Excel file and return array of objects
 * @param {File} file
 * @returns {Promise<Array<Object>>}
 */
export async function parseSpreadsheet(file) {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
        resolve(jsonData);
      } catch (err) {
        reject(new Error('Failed to parse file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Build the public verification URL
 */
export function getVerificationUrl(certificateId) {
  const base = window.location.origin;
  return `${base}/verify-certificate/${encodeURIComponent(certificateId)}`;
}

/**
 * Certificate type labels and colors
 */
export const CERTIFICATE_TYPES = [
  { value: 'course', label: 'Recorded Course', color: '#008ad1' },
  { value: 'live', label: 'Live Session', color: '#008ad1' },
  { value: 'live_bootcamp', label: 'Live Bootcamp', color: '#7c3aed' },
  { value: 'internship', label: 'Internship', color: '#10b981' },
  { value: 'offline', label: 'Offline Training', color: '#f59e0b' },
];

export function getCertTypeLabel(value) {
  return CERTIFICATE_TYPES.find(t => t.value === value)?.label || value;
}

export function getCertTypeColor(value) {
  return CERTIFICATE_TYPES.find(t => t.value === value)?.color || '#64748b';
}
