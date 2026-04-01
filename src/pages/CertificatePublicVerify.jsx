import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiAward, FiCheckCircle, FiXCircle, FiUser, FiBook, FiCalendar, FiHash, FiSearch, FiShield } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { getCertTypeLabel } from '../utils/certificateUtils';
import '../components/admin/CertificateGenerator.css';

/**
 * CertificatePublicVerify — Public-facing certificate verification page.
 * Supports both URL-based lookup (/verify-certificate/:certId) and manual search.
 */
export default function CertificatePublicVerify() {
  const { certId } = useParams();
  const [searchInput, setSearchInput] = useState(certId || '');
  const [loading, setLoading] = useState(!!certId);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);

  const verifyCertificate = async (id) => {
    if (!id || !id.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);

    const trimmedId = id.trim();

    try {
      // 1. Try bulk_certificates first (OPSK format + admin-generated)
      const { data: bulkData } = await supabase
        .from('bulk_certificates')
        .select('*')
        .ilike('certificate_id', trimmedId)
        .single();

      if (bulkData) {
        setResult(bulkData);
        return;
      }

      // 2. Fallback: check certificate_logs (covers legacy UUID certificates)
      const { data: logData } = await supabase
        .from('certificate_logs')
        .select('*')
        .ilike('certificate_id', trimmedId)
        .single();

      if (logData) {
        // Map log data to the same shape the UI expects
        setResult({
          certificate_id: logData.certificate_id,
          student_name: logData.student_name,
          course_name: logData.course_name,
          certificate_type: logData.certificate_type || 'course',
          date_of_completion: logData.issued_at,
          status: logData.status === 'active' ? 'valid' : logData.status,
          instructor_name: logData.issued_by
        });
        return;
      }

      setError('Certificate not found. Please check the ID and try again.');
    } catch (err) {
      setError('An error occurred during verification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (certId) {
      verifyCertificate(certId);
    }
  }, [certId]);

  const handleSearch = (e) => {
    e.preventDefault();
    verifyCertificate(searchInput);
  };

  return (
    <div className="cert-verify-page section">
      <div className="cert-verify-card animate-fade">
        {/* Header */}
        <div className="cert-verify-header">
          <FiShield />
          <h1>Certificate Verification</h1>
          <p>Open Skools Official Credential Check</p>
        </div>

        {/* Body */}
        <div className="cert-verify-body">
          {/* Search Form */}
          <form onSubmit={handleSearch}>
            <div className="cert-verify-search">
              <input
                type="text"
                placeholder="Enter Certificate ID (e.g. OPSK-2026-0001)"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={loading || !searchInput.trim()}>
                {loading ? '...' : <FiSearch />}
              </button>
            </div>
          </form>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--gray-400)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p>Verifying certificate...</p>
            </div>
          )}

          {/* Result - Valid */}
          {!loading && result && (
            <div className={`cert-verify-result ${result.status === 'valid' ? 'valid' : 'invalid'}`}>
              <div className={`cert-verify-result-header ${result.status === 'valid' ? 'valid' : 'invalid'}`}>
                {result.status === 'valid' ? <FiCheckCircle /> : <FiXCircle />}
                <div>
                  <h3>{result.status === 'valid' ? 'Verified Authentic' : 'Certificate Revoked'}</h3>
                  <p style={{ fontSize: '0.813rem', color: 'var(--gray-500)', margin: 0 }}>
                    {result.status === 'valid'
                      ? 'This certificate is an official credential issued by Open Skools.'
                      : 'This certificate has been revoked and is no longer valid.'}
                  </p>
                </div>
              </div>

              <div className="cert-verify-details">
                <div className="cert-verify-row">
                  <FiUser />
                  <div>
                    <label>Issued To</label>
                    <strong>{result.student_name}</strong>
                  </div>
                </div>
                <div className="cert-verify-row">
                  <FiBook />
                  <div>
                    <label>Course / Event</label>
                    <strong>{result.course_name}</strong>
                  </div>
                </div>
                <div className="cert-verify-row">
                  <FiAward />
                  <div>
                    <label>Certificate Type</label>
                    <strong>{getCertTypeLabel(result.certificate_type)}</strong>
                  </div>
                </div>
                <div className="cert-verify-row">
                  <FiCalendar />
                  <div>
                    <label>Date of Completion</label>
                    <strong>
                      {new Date(result.date_of_completion).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric'
                      })}
                    </strong>
                  </div>
                </div>
                <div className="cert-verify-row">
                  <FiHash />
                  <div>
                    <label>Certificate ID</label>
                    <strong>
                      <code style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: 4, fontSize: '0.813rem', fontWeight: 700, color: 'var(--primary)' }}>
                        {result.certificate_id}
                      </code>
                    </strong>
                  </div>
                </div>
                {result.instructor_name && (
                  <div className="cert-verify-row">
                    <FiUser />
                    <div>
                      <label>Instructor</label>
                      <strong>{result.instructor_name}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Result - Not Found */}
          {!loading && error && searched && (
            <div className="cert-verify-result invalid">
              <div className="cert-verify-result-header invalid">
                <FiXCircle />
                <div>
                  <h3>Certificate Not Found</h3>
                  <p style={{ fontSize: '0.813rem', color: 'var(--gray-500)', margin: 0 }}>{error}</p>
                </div>
              </div>
            </div>
          )}

          {!searched && !loading && (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
              Enter a Certificate ID above to verify its authenticity.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="cert-verify-footer">
          Verified by <strong>Open Skools</strong> • <Link to="/" style={{ color: 'var(--primary)', fontWeight: 600 }}>Visit Platform</Link>
        </div>
      </div>
    </div>
  );
}
