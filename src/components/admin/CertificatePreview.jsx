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

  // All styles defined inline for pixel-perfect html2canvas rendering
  const S = {
    template: {
      width: '1122px',
      height: '794px',
      background: '#ffffff',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: "'Open Sans', 'Inter', sans-serif",
      boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
      color: '#000',
    },
    bgMap: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundImage: "url('/world-map.svg')",
      backgroundSize: 'cover',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center',
      opacity: 0.04,
      pointerEvents: 'none',
    },
    stripe: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      right: '120px',
      width: '50px',
      backgroundColor: '#008ad1',
      zIndex: 2,
      overflow: 'hidden',
    },
    stripeText: {
      position: 'absolute',
      right: '-55px',
      top: '50%',
      transform: 'translateY(-50%) rotate(-90deg)',
      transformOrigin: 'center',
      fontSize: '14px',
      letterSpacing: '2px',
      color: '#000',
      zIndex: 2,
      whiteSpace: 'nowrap',
    },
    logo: {
      position: 'absolute',
      top: '60px',
      left: '80px',
      height: '55px',
      maxWidth: 'none',
      zIndex: 3,
    },
    iso: {
      position: 'absolute',
      top: '130px',
      right: '80px',
      width: '130px',
      height: '130px',
      maxWidth: 'none',
      zIndex: 4,
    },
    content: {
      position: 'absolute',
      top: '180px',
      left: '80px',
      right: '200px',
      zIndex: 3,
      textAlign: 'left',
    },
    title: {
      fontFamily: "'Times New Roman', serif",
      fontSize: '48px',
      fontWeight: 'normal',
      color: '#000',
      margin: '0 0 16px 0',
      letterSpacing: '1px',
      lineHeight: '1.1',
      padding: 0,
    },
    subtitle: {
      fontSize: '18px',
      color: '#333',
      margin: 0,
      lineHeight: '1.4',
      letterSpacing: 'normal',
      fontWeight: 'normal',
    },
    nameWrapper: {
      marginTop: '24px',
      marginBottom: '24px',
    },
    studentName: {
      fontFamily: "'Arial', sans-serif",
      fontSize: '56px',
      fontWeight: 'normal',
      color: '#000',
      margin: '0 0 10px 0',
      lineHeight: '1.2',
      letterSpacing: 'normal',
      padding: 0,
    },
    line: {
      height: '2px',
      width: '600px',
      backgroundColor: '#008ad1',
    },
    courseInfo: {
      fontSize: '20px',
      color: '#000',
      lineHeight: '1.6',
    },
    footer: {
      position: 'absolute',
      bottom: '60px',
      left: '80px',
      right: '200px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      zIndex: 3,
    },
    founderBlock: {
      display: 'flex',
      flexDirection: 'column',
      width: '250px',
    },
    founderSig: {
      height: '120px',
      maxWidth: 'none',
      objectFit: 'contain',
      alignSelf: 'flex-start',
      marginTop: '50px',
      marginBottom: '-35px',
    },
    sigLine: {
      height: '1px',
      width: '100%',
      backgroundColor: '#000',
      marginBottom: '8px',
    },
    founderName: {
      fontSize: '18px',
      fontWeight: 'bold',
      color: '#000',
      lineHeight: '1.4',
    },
    founderTitle: {
      fontSize: '15px',
      fontWeight: 'bold',
      color: '#000',
      lineHeight: '1.4',
    },
    qrSection: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '8px',
      marginRight: '-25px',
    },
    qrWrap: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
    qrLabel: {
      fontSize: '13px',
      color: '#000',
      marginBottom: '4px',
      lineHeight: '1.3',
    },
    certDetails: {
      textAlign: 'right',
      fontSize: '14px',
      color: '#000',
      lineHeight: '1.4',
      marginBottom: '5px',
    },
    // Circuit decorations
    circuitLine: (left, top, bottom, width = '1px', opacity = 0.4) => ({
      position: 'absolute',
      left,
      top,
      bottom,
      width,
      background: 'rgba(255, 255, 255, 0.4)',
      opacity,
    }),
    circuitNode: (left, top) => ({
      position: 'absolute',
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      background: '#fff',
      boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)',
      left,
      top,
    }),
  };

  return (
    <div className="cert-template-v3" style={S.template} ref={innerRef}>
      {/* Background Map */}
      <div style={S.bgMap} />

      {/* Right side blue vertical stripe */}
      <div style={S.stripe}>
        <div style={S.circuitLine('10px', '0', '0', '2px', 0.6)} />
        <div style={S.circuitLine('20px', '0', '40%', '1px', 0.4)} />
        <div style={S.circuitLine('30px', '20%', '0', '1px', 0.3)} />
        <div style={S.circuitLine('40px', '10%', '60%', '2px', 0.5)} />
        <div style={S.circuitLine('15px', '50%', '10%', '1px', 0.4)} />
        <div style={S.circuitLine('35px', '30%', '0', '1.5px', 0.2)} />
        <div style={S.circuitNode('8px', '120px')} />
        <div style={S.circuitNode('18px', '60%')} />
        <div style={S.circuitNode('38px', '35%')} />
        <div style={S.circuitNode('28px', '480px')} />
        <div style={S.circuitNode('18px', '15%')} />
        <div style={S.circuitNode('33px', '85%')} />
        <div style={S.circuitNode('13px', '280px')} />
        <div style={S.circuitNode('38px', '200px')} />
        <div style={S.circuitNode('23px', '72%')} />
        <div style={S.circuitNode('10px', '92%')} />
      </div>

      {/* Vertical rotated text */}
      <div style={S.stripeText}>www.openskools.com</div>

      {/* Header elements */}
      <img src="/logo.svg" alt="Open Skools" style={S.logo} crossOrigin="anonymous" />
      <img src="/Gold-ISO-Seal.png" alt="ISO Certified" style={S.iso} crossOrigin="anonymous" />

      {/* Main Content Area */}
      <div style={S.content}>
        <div style={S.title}>CERTIFICATE OF COMPLETION</div>
        <p style={S.subtitle}>This certificate is proudly presented to</p>
        
        <div style={S.nameWrapper}>
          <div style={S.studentName}>{student_name}</div>
          <div style={S.line} />
        </div>

        <div style={S.courseInfo}>
          for successfully completing <strong>{course_name}</strong><br />
          {dateText}
        </div>
      </div>

      {/* Footer Area */}
      <div style={S.footer}>
        {/* Left: Founder Signature */}
        <div style={S.founderBlock}>
          <img src="/Founder-sign.png" alt="Founder Signature" style={S.founderSig} crossOrigin="anonymous" />
          <div style={S.sigLine} />
          <div style={S.founderName}>Karthik Selva Siva</div>
          <div style={S.founderTitle}>Founder & Managing Director</div>
        </div>

        {/* Right: QR Code and Cert Details */}
        <div style={S.qrSection}>
          <div style={S.qrWrap}>
            <div style={S.qrLabel}>Scan To Verify</div>
            <QRCodeCanvas
              value={verifyUrl}
              size={85}
              bgColor="#ffffff"
              fgColor="#000000"
              level="M"
              includeMargin={false}
            />
          </div>
          <div style={S.certDetails}>
            CERTIFICATE CODE: {certificate_id}<br />
            {getCertTypeLabel(certificate_type)}
          </div>
        </div>
      </div>
    </div>
  );
}
