import { useState, useRef } from 'react';
import { FiSearch, FiDownload, FiTrash2, FiEye, FiFileText, FiSlash, FiCheckCircle, FiRefreshCw, FiAward, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { getCertTypeLabel, getCertTypeColor, CERTIFICATE_TYPES } from '../../utils/certificateUtils';
import { exportToExcel } from '../../utils/excelExport';
import CertificatePreview from './CertificatePreview';
import Modal from '../ui/Modal';

/**
 * CertificateTable — Displays all generated certificates with filters, search, actions.
 */
export default function CertificateTable({ 
  certificates, 
  totalCount, 
  filters, 
  setFilters, 
  currentPage, 
  setCurrentPage, 
  onDelete, 
  onRevoke, 
  onDownloadPDF, 
  onBulkDownload, 
  loading 
}) {
  const [previewCert, setPreviewCert] = useState(null);
  const [courses, setCourses] = useState([]);
  const printRef = useRef();

  // Fetch courses for filter once
  useState(() => {
    async function fetchCourses() {
      const { data } = await import('../../lib/supabase').then(m => m.supabase.from('courses').select('title'));
      if (data) setCourses(data);
    }
    fetchCourses();
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleExportExcel = () => {
    const data = certificates.map(c => ({
      'Certificate ID': c.certificate_id,
      'Student Name': c.student_name,
      'Course / Event': c.course_name,
      'Type': getCertTypeLabel(c.certificate_type),
      'Start Date': c.start_date || '',
      'End Date': c.end_date || c.issued_at,
      'Status': c.status.toUpperCase(),
      'Issued At': new Date(c.issued_at).toLocaleString(),
    }));
    exportToExcel(data, 'Certificates_Audit_Trail');
  };

  return (
    <div className="animate-fade">
      {/* Header */}
      <div className="cert-table-header">
        <div className="ap-search" style={{ maxWidth: 300 }}>
          <FiSearch />
          <input
            name="search"
            placeholder="Search name, email, or ID..."
            value={filters.search}
            onChange={handleFilterChange}
          />
        </div>
        <div className="cert-table-actions">
          <button className="btn btn-outline btn-sm" onClick={handleExportExcel} disabled={certificates.length === 0}>
            <FiFileText style={{ marginRight: 4 }} /> Export reports (Excel)
          </button>
          <button className="btn btn-primary btn-sm" onClick={onBulkDownload} disabled={certificates.length === 0}>
            <FiDownload style={{ marginRight: 4 }} /> ZIP Download
          </button>
        </div>
      </div>

      {/* Enhanced Filters - Bridged from Reports */}
      <div className="cert-table-filters card-glass" style={{ marginBottom: 16, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-end', borderRadius: 8 }}>
        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Course</label>
          <select name="course" value={filters.course} onChange={handleFilterChange} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <option value="all">All Courses</option>
            {courses.map(c => <option key={c.title} value={c.title}>{c.title}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Type</label>
          <select name="type" value={filters.type} onChange={handleFilterChange} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <option value="all">All Types</option>
            {CERTIFICATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Status</label>
          <select name="status" value={filters.status} onChange={handleFilterChange} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>
        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date From</label>
          <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }} />
        </div>
        <div className="filter-group">
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Date To</label>
          <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0' }} />
        </div>
        <button 
          className="btn-icon" 
          onClick={() => { setFilters({ search: '', course: 'all', type: 'all', status: 'all', dateFrom: '', dateTo: '' }); setCurrentPage(1); }}
          style={{ height: 32, width: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6 }}
        >
          <FiRefreshCw />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--gray-500)' }}>Syncing Audit Trail...</p>
        </div>
      ) : certificates.length === 0 ? (
        <div className="cert-empty">
          <FiAward size={48} />
          <h3>Audit Trail Empty</h3>
          <p>Generate a certificate to begin tracking issuances.</p>
        </div>
      ) : (
        <div className="id-table-wrap">
          <table className="id-table">
            <thead>
              <tr>
                <th>Certificate ID</th>
                <th>Student</th>
                <th>Course / Event</th>
                <th>Type</th>
                <th>Issued At</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {certificates.map(c => (
                <tr key={c.id}>
                  <td>
                    <span className="ap-user-code">{c.certificate_id}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong>{c.student_name}</strong>
                      {c.student_email && c.student_email !== 'N/A' && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.student_email}</span>
                      )}
                    </div>
                  </td>
                  <td>{c.course_name}</td>
                  <td>
                    <span
                      className="cert-type-badge"
                      style={{ background: `${getCertTypeColor(c.certificate_type)}15`, color: getCertTypeColor(c.certificate_type) }}
                    >
                      {getCertTypeLabel(c.certificate_type)}
                    </span>
                  </td>
                  <td>{new Date(c.issued_at).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${c.status === 'active' ? 'cert-status-valid' : 'cert-status-revoked'}`}>
                      {c.status === 'active' ? '✓ Active' : '✗ Revoked'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setPreviewCert(c)} title="Preview">
                        <FiEye />
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => onDownloadPDF(c)} title="Download PDF">
                        <FiDownload />
                      </button>
                      {c.status === 'active' ? (
                        <button className="btn btn-outline btn-sm" onClick={() => onRevoke(c.id, c.certificate_id, 'revoked')} title="Revoke" style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }}>
                          <FiSlash />
                        </button>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => onRevoke(c.id, c.certificate_id, 'active')} title="Reactivate" style={{ color: 'var(--success)', borderColor: 'var(--success)' }}>
                          <FiRefreshCw />
                        </button>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => onDelete(c.id)} title="Delete" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer - Bridged from Reports */}
      {certificates.length > 0 && (
        <div className="reports-footer" style={{ marginTop: 20 }}>
          <div className="footer-stats">
            Showing <strong>{certificates.length}</strong> of <strong>{totalCount}</strong> certificates
          </div>
          <div className="reports-pagination">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
            >
              <FiChevronLeft /> Previous
            </button>
            <div className="page-num">Page {currentPage} of {Math.ceil(totalCount / 10) || 1}</div>
            <button 
              disabled={currentPage >= Math.ceil(totalCount / 10)}
              onClick={() => setCurrentPage(prev => prev + 1)}
            >
              Next <FiChevronRight />
            </button>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <Modal isOpen={!!previewCert} onClose={() => setPreviewCert(null)} title="Certificate Preview" size="lg">
        {previewCert && (
          <div className="cert-preview-modal">
            <div className="cert-preview-wrapper">
              <div style={{ transform: 'scale(0.6)', transformOrigin: 'top center' }}>
                <CertificatePreview data={previewCert} innerRef={printRef} />
              </div>
            </div>
            <div className="cert-preview-modal-actions">
              <button className="btn btn-outline" onClick={() => setPreviewCert(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => { onDownloadPDF(previewCert); }}>
                <FiDownload style={{ marginRight: 6 }} /> Download PDF
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
