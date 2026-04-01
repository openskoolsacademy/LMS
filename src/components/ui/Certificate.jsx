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
      const el = certRef.current.querySelector('.cert-template-v3');
      if (!el) throw new Error("Template element not found");

      const canvas = await html2canvas(el, {
        scale: 2, // Standard high resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: 1122, // Fixed A4 Landscape width
        height: 794 // Fixed A4 Landscape height
      });
      
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
