import { useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { useAlert } from '../../context/AlertContext';
import CertificatePreview from '../admin/CertificatePreview';
import '../admin/CertificateGenerator.css'; // Master template styles
import './Certificate.css'; // Modal layout styles

/**
 * Student Certificate Modal — Wraps the master CertificatePreview 
 * into a student-facing download/view modal.
 */
export default function Certificate({ certificateData, onClose }) {
  const { showAlert } = useAlert();
  const certRef = useRef(null);

  // Map to the format expected by the master template (CertificatePreview)
  const masterData = {
    certificate_id: certificateData.id,
    student_name: certificateData.studentName,
    course_name: certificateData.courseTitle,
    certificate_type: 'course', // Default to course, can be dynamic if needed
    date_of_completion: certificateData.issuedAt || new Date().toISOString()
  };

  const downloadCertificate = async () => {
    if (!certRef.current) return;
    
    try {
      const scaler = certRef.current;
      const el = scaler.querySelector('.cert-template-v3');
      if (!el) throw new Error("Template element not found");

      // Temporarily override the scaler to render at full 1:1 size for accurate capture
      const viewerZoom = scaler.closest('.cert-viewer-zoom');
      const origScale = viewerZoom ? getComputedStyle(viewerZoom).getPropertyValue('--cert-scale') : '1';
      if (viewerZoom) viewerZoom.style.setProperty('--cert-scale', '1');
      
      // Force layout recalculation at 1:1
      await new Promise(r => setTimeout(r, 100));

      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1122,
        height: 794,
        windowWidth: 1122,
        windowHeight: 794,
        scrollX: 0,
        scrollY: 0,
        x: 0,
        y: 0,
        onclone: (clonedDoc, clonedEl) => {
          clonedEl.style.width = '1122px';
          clonedEl.style.height = '794px';
          clonedEl.style.position = 'fixed';
          clonedEl.style.top = '0';
          clonedEl.style.left = '0';
          clonedEl.style.transform = 'none';
          clonedEl.style.margin = '0';
          clonedEl.style.overflow = 'hidden';
        }
      });

      // Restore original scale
      if (viewerZoom) viewerZoom.style.setProperty('--cert-scale', origScale);
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      pdf.save(`OpenSkools_Certificate_${certificateData.id.slice(0, 8).toUpperCase()}.pdf`);
    } catch (err) {
      console.error("Error generating PDF:", err);
      showAlert("Failed to generate PDF", "Export Error", "error");
    }
  };

  return (
    <div className="cert-modal-overlay">
      <div className="cert-modal-content">
        <div className="cert-actions">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={downloadCertificate}>Download PDF</button>
        </div>
        
        {/* Render the Master Template as a READ-ONLY reference */}
        <div className="cert-viewer-zoom">
          <div className="cert-template-scaler" ref={certRef}>
            <CertificatePreview data={masterData} />
          </div>
        </div>
      </div>
    </div>
  );
}
