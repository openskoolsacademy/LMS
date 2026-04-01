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
 * Generate a PDF from a DOM element
 * @param {HTMLElement} element - The DOM element to capture
 * @param {string} fileName - Output file name
 * @returns {Promise<Blob>} PDF blob
 */
export async function generatePDFFromElement(element, fileName = 'certificate') {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: 1122,
    height: 794,
    windowWidth: 1122,
    windowHeight: 794,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

  return pdf;
}

/**
 * Download a single certificate as PDF
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
  { value: 'live', label: 'Live Session', color: '#8b5cf6' },
  { value: 'internship', label: 'Internship', color: '#10b981' },
  { value: 'offline', label: 'Offline Training', color: '#f59e0b' },
];

export function getCertTypeLabel(value) {
  return CERTIFICATE_TYPES.find(t => t.value === value)?.label || value;
}

export function getCertTypeColor(value) {
  return CERTIFICATE_TYPES.find(t => t.value === value)?.color || '#64748b';
}
