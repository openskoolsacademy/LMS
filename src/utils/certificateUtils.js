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
 * Print a certificate as PDF using the browser's native print engine.
 * Opens a popup window with the certificate at full size and triggers window.print().
 * This guarantees pixel-perfect output identical to the preview.
 * 
 * @param {HTMLElement} element - The rendered certificate DOM element
 * @param {string} fileName - Used for the page title
 */
export function printCertificateAsPDF(element, fileName = 'Certificate') {
  // Clone the element to avoid modifying the original
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

  // Remove box-shadow from the template (not needed in print)
  clone.style.boxShadow = 'none';

  // Convert relative image paths to absolute URLs
  const origin = window.location.origin;
  clone.querySelectorAll('img').forEach(img => {
    if (img.src && img.src.startsWith('/')) {
      img.src = origin + img.src;
    }
  });

  const certHTML = clone.outerHTML;

  // Open a popup window for printing
  const printWindow = window.open('', '_blank', `width=1200,height=850,scrollbars=no,resizable=no`);
  if (!printWindow) {
    alert('Please allow popups for this site to download certificates.');
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${fileName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 297mm;
      height: 210mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background: #fff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    /* Scale the 1122x794 template to fit A4 landscape (297mm x 210mm) */
    .cert-print-container {
      width: 297mm;
      height: 210mm;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .cert-print-container > div {
      transform-origin: top left;
      /* 297mm ≈ 1122px at 96dpi, 210mm ≈ 794px at 96dpi — exact match */
    }
    @media print {
      html, body {
        width: 297mm;
        height: 210mm;
        margin: 0 !important;
        padding: 0 !important;
      }
    }
    @media screen {
      body {
        background: #f0f0f0;
      }
    }
  </style>
</head>
<body>
  <div class="cert-print-container">
    ${certHTML}
  </div>
  <script>
    // Wait for all images to load, then auto-print
    function waitAndPrint() {
      var images = document.querySelectorAll('img');
      var loaded = 0;
      var total = images.length;
      
      if (total === 0) {
        setTimeout(function() { window.print(); }, 300);
        return;
      }
      
      images.forEach(function(img) {
        if (img.complete) {
          loaded++;
          if (loaded >= total) setTimeout(function() { window.print(); }, 300);
        } else {
          img.onload = img.onerror = function() {
            loaded++;
            if (loaded >= total) setTimeout(function() { window.print(); }, 300);
          };
        }
      });
    }
    
    // Start after DOM is ready
    if (document.readyState === 'complete') {
      waitAndPrint();
    } else {
      window.addEventListener('load', waitAndPrint);
    }
  </script>
</body>
</html>`);
  printWindow.document.close();
}

/**
 * Legacy: Generate PDF from element using html2canvas (kept for bulk download)
 */
export async function generatePDFFromElement(element, fileName = 'certificate') {
  await document.fonts.ready;

  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: 1122,
    height: 794,
    scrollX: -window.scrollX,
    scrollY: -window.scrollY,
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
