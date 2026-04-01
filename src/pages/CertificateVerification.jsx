import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiCheckCircle, FiXCircle, FiAward, FiCalendar, FiUser, FiBook } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import '../components/ui/Certificate.css';

export default function CertificateVerification() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [certData, setCertData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function verifyCertificate() {
      try {
        setLoading(true);
        // Ensure valid UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
           throw new Error("Invalid Certificate ID format");
        }

        const { data, error: fetchErr } = await supabase
          .from('certificates')
          .select(`
            id,
            issued_at,
            user:users(name, email),
            course:courses(title, instructor:users(name))
          `)
          .eq('id', id)
          .single();

        if (fetchErr || !data) throw new Error("Certificate not found in records");

        setCertData({
          id: data.id,
          issuedAt: data.issued_at,
          studentName: data.user?.name || data.user?.email,
          courseTitle: data.course?.title,
          instructorName: data.course?.instructor?.name || 'Open Skools Instructor'
        });
      } catch (err) {
        console.error("Verification failed:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    verifyCertificate();
  }, [id]);

  if (loading) {
    return (
      <div className="verify-container section">
        <div className="verify-card animate-fade">
          <h2>Verifying Certificate...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="verify-container section">
      <div className="verify-card animate-fade">
        <div className="verify-header">
          <FiAward className="verify-icon-logo" />
          <h1>Credential Verification</h1>
          <p>Open Skools Official Authenticity Check</p>
        </div>

        {error || !certData ? (
          <div className="verify-result error">
            <FiXCircle className="result-icon invalid" />
            <h2>Invalid Certificate</h2>
            <p>We could not find a valid credential matching this ID.</p>
            <code>ID: {id}</code>
            <Link to="/" className="btn btn-outline" style={{marginTop: '20px'}}>Return Home</Link>
          </div>
        ) : (
          <div className="verify-result success">
            <FiCheckCircle className="result-icon valid" />
            <h2>Verified Authentic</h2>
            <p className="verify-subtitle">This certificate is an official and verifiable credential issued by Open Skools.</p>
            
            <div className="verify-details">
              <div className="verify-row">
                <FiUser className="v-icon" />
                <div>
                  <label>Issued To</label>
                  <strong>{certData.studentName}</strong>
                </div>
              </div>
              <div className="verify-row">
                <FiBook className="v-icon" />
                <div>
                  <label>Course Completed</label>
                  <strong>{certData.courseTitle}</strong>
                </div>
              </div>
              <div className="verify-row">
                <FiCalendar className="v-icon" />
                <div>
                  <label>Issue Date</label>
                  <strong>{new Date(certData.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                </div>
              </div>
              <div className="verify-row">
                <FiAward className="v-icon" />
                <div>
                  <label>Credential ID</label>
                  <code style={{background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px'}}>{certData.id}</code>
                </div>
              </div>
            </div>
            
            <Link to="/courses" className="btn btn-primary" style={{marginTop: '30px', width: '100%'}}>Explore Open Skools Courses</Link>
          </div>
        )}
      </div>
    </div>
  );
}
