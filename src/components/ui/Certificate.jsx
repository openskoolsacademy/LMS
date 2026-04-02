import { useRef, useState } from 'react';
import { useAlert } from '../../context/AlertContext';
import { printCertificateAsPDF } from '../../utils/certificateUtils';
import CertificatePreview from '../admin/CertificatePreview';
import './Certificate.css'; // Modal layout styles

/**
 * Student Certificate Modal — Wraps the master CertificatePreview 
 * into a student-facing download/view modal.
 */
export default function Certificate({ certificateData, onClose }) {
  const { showAlert } = useAlert();
  const certRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  // Map to the format expected by the master template (CertificatePreview)
  const masterData = {
    certificate_id: certificateData.id,
    student_name: certificateData.studentName,
    course_name: certificateData.courseTitle,
    certificate_type: 'course', // Default to course, can be dynamic if needed
    date_of_completion: certificateData.issuedAt || new Date().toISOString()
  };

  const downloadCertificate = async () => {
    if (!certRef.current || downloading) return;
    
    setDownloading(true);
    try {
      await printCertificateAsPDF(
        certRef.current,
        `OpenSkools_Certificate_${certificateData.id.slice(0, 8).toUpperCase()}`
      );
    } catch (err) {
      console.error("Error generating PDF:", err);
      showAlert("Failed to generate PDF", "Export Error", "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="cert-modal-overlay">
      <div className="cert-modal-content">
        <div className="cert-actions">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button 
            className="btn btn-primary" 
            onClick={downloadCertificate}
            disabled={downloading}
          >
            {downloading ? 'Generating PDF...' : 'Download PDF'}
          </button>
        </div>
        
        {/* Render the Master Template as a READ-ONLY reference */}
        <div className="cert-viewer-zoom">
          <div className="cert-template-scaler">
            <CertificatePreview data={masterData} innerRef={certRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
