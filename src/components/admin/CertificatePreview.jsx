import { QRCodeCanvas } from 'qrcode.react';
import { getCertTypeLabel, getVerificationUrl } from '../../utils/certificateUtils';

export default function CertificatePreview({ data, innerRef }) {
  const {
    certificate_id = 'OPSK-2026-0001',
    student_name = 'Student Name',
    course_name = 'Course Name',
    certificate_type = 'course',
    start_date,
    end_date,
    date_of_completion,
  } = data || {};

  const verifyUrl = getVerificationUrl(certificate_id);
  
  let dateText = null;
  const effectiveEnd = end_date || date_of_completion || new Date().toISOString().split('T')[0];

  if (start_date && effectiveEnd) {
    const start = new Date(start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const end = new Date(effectiveEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    dateText = (
      <>Duration: <strong>{start} to {end}</strong></>
    );
  } else {
    const end = new Date(effectiveEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    dateText = (
      <>Completed on <strong>{end}</strong></>
    );
  }

  return (
    <div className="cert-template-v3" ref={innerRef}>
      {/* Background Map */}
      <div className="cert-bg-map" />

      {/* Right side blue vertical stripe */}
      <div className="cert-v3-stripe">
        <div className="cert-circuit-line line-1" />
        <div className="cert-circuit-line line-2" />
        <div className="cert-circuit-line line-3" />
        <div className="cert-circuit-line line-4" />
        <div className="cert-circuit-line line-5" />
        <div className="cert-circuit-line line-6" />
        <div className="cert-circuit-node node-1" />
        <div className="cert-circuit-node node-2" />
        <div className="cert-circuit-node node-3" />
        <div className="cert-circuit-node node-4" />
        <div className="cert-circuit-node node-5" />
        <div className="cert-circuit-node node-6" />
        <div className="cert-circuit-node node-7" />
        <div className="cert-circuit-node node-8" />
        <div className="cert-circuit-node node-9" />
        <div className="cert-circuit-node node-10" />
      </div>

      {/* Vertical rotated text */}
      <div className="cert-v3-stripe-text">www.openskools.com</div>

      {/* Header elements */}
      <img src="/logo.svg" alt="Open Skools" className="cert-v3-logo" />
      <img src="/Gold-ISO-Seal.png" alt="ISO Certified" className="cert-v3-iso" />

      {/* Main Content Area */}
      <div className="cert-v3-content">
        <h1 className="cert-v3-title">CERTIFICATE OF COMPLETION</h1>
        <p className="cert-v3-subtitle">This certificate is proudly presented to</p>
        
        <div className="cert-v3-name-wrapper">
          <h2 className="cert-v3-student-name">{student_name}</h2>
          <div className="cert-v3-line" />
        </div>

        <div className="cert-v3-course-info">
          for successfully completing <strong>{course_name}</strong><br />
          {dateText}
        </div>
      </div>

      {/* Footer Area */}
      <div className="cert-v3-footer">
        {/* Left: Founder Signature */}
        <div className="cert-v3-founder-block">
          <img src="/Founder-sign.png" alt="Founder Signature" className="cert-v3-founder-sig" />
          <div className="cert-v3-sig-line" />
          <div className="cert-v3-founder-name">Karthik Selva Siva</div>
          <div className="cert-v3-founder-title">Founder & Managing Director</div>
        </div>

        {/* Right: QR Code and Cert Details */}
        <div className="cert-v3-qr-section">
          <div className="cert-v3-qr-wrap">
            <div className="cert-v3-qr-label">Scan To Verify</div>
            <QRCodeCanvas
              value={verifyUrl}
              size={85}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
              includeMargin={false}
            />
          </div>
          <div className="cert-v3-cert-details">
            CERTIFICATE CODE: {certificate_id}<br />
            {getCertTypeLabel(certificate_type)}
          </div>
        </div>
      </div>
    </div>
  );
}
