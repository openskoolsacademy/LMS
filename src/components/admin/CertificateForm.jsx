import { useState, useRef } from 'react';
import { FiUploadCloud, FiFileText, FiX, FiEye, FiZap, FiUser, FiBook, FiCalendar, FiType, FiAlignLeft } from 'react-icons/fi';
import { parseSpreadsheet, CERTIFICATE_TYPES } from '../../utils/certificateUtils';
import CertificatePreview from './CertificatePreview';

/**
 * CertificateForm — Single + Bulk certificate creation form.
 * Supports manual single entry and CSV/Excel bulk upload.
 */
export default function CertificateForm({ onGenerate, generating }) {
  const [mode, setMode] = useState('single'); // 'single' | 'bulk'
  const [singleForm, setSingleForm] = useState({
    student_name: '',
    course_name: '',
    certificate_type: 'course',
    start_date: '',
    end_date: new Date().toISOString().split('T')[0],
  });
  const [csvData, setCsvData] = useState([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvError, setCsvError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [bulkType, setBulkType] = useState('course');
  const [bulkInstructor, setBulkInstructor] = useState('');
  const fileInputRef = useRef();
  const [dragOver, setDragOver] = useState(false);

  const handleSingleChange = (field, value) => {
    setSingleForm(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    setCsvError('');
    try {
      const data = await parseSpreadsheet(file);
      if (!data || data.length === 0) {
        setCsvError('No data found in the file.');
        return;
      }
      // Normalize column names (case-insensitive match)
      const normalized = data.map(row => {
        const norm = {};

        // Helper to convert explicit Excel serial number or valid text date to YYYY-MM-DD
        const parseDateVal = (val) => {
          if (!val) return '';
          // If it's a native Date (from cellDates: true or similar)
          if (val instanceof Date && !isNaN(val)) return val.toISOString().split('T')[0];
          // If it's an Excel serial date number
          if (typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val.length === 5)) {
            const num = Number(val);
            // Excel dates are days since 1900-01-01
            const date = new Date((num - (25567 + 2)) * 86400 * 1000); 
            return date.toISOString().split('T')[0];
          }
          // If it is a string like DD/MM/YYYY or DD-MM-YYYY we need to parse it (European format parsing)
          const str = String(val).trim();
          const separator = str.includes('/') ? '/' : (str.includes('-') ? '-' : null);
          if (separator) {
            const parts = str.split(separator);
            // If it looks like d/m/yy or dd/mm/yyyy
            if (parts.length === 3) {
              const p1 = parseInt(parts[0], 10);
              const p2 = parseInt(parts[1], 10);
              const p3 = parseInt(parts[2], 10);
              // Assume DD/MM/YYYY if the first part is > 12, or just stick to DD/MM/YYYY preference
              const day = p1 > 12 || p2 <= 12 ? p1 : p2;
              const month = p1 > 12 || p2 <= 12 ? p2 : p1;
              const year = p3 < 100 ? 2000 + p3 : p3;
              if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              }
            }
          }
          // Fallback to JS new Date
          try {
            const d = new Date(val);
            if (!isNaN(d)) return d.toISOString().split('T')[0];
          } catch(e) {}
          return str;
        };

        Object.keys(row).forEach(key => {
          const lower = key.toLowerCase().trim();
          if (lower.includes('name') && !lower.includes('course') && !lower.includes('event') && !lower.includes('instructor')) {
            norm.student_name = String(row[key]).trim();
          } else if (lower.includes('course') || lower.includes('event')) {
            norm.course_name = String(row[key]).trim();
          } else if (lower.includes('start') && lower.includes('date')) {
            norm.start_date = parseDateVal(row[key]);
          } else if ((lower.includes('end') && lower.includes('date')) || lower === 'date') {
            norm.end_date = parseDateVal(row[key]);
          } else if (lower.includes('certificate') && lower.includes('id')) {
            norm.certificate_id = String(row[key]).trim();
          }
        });
        // Fallback: use first two columns as name + course if mapping failed
        if (!norm.student_name && Object.values(row)[0]) {
          norm.student_name = String(Object.values(row)[0]).trim();
        }
        if (!norm.course_name && Object.values(row)[1]) {
          norm.course_name = String(Object.values(row)[1]).trim();
        }
        if (!norm.end_date) {
          norm.end_date = new Date().toISOString().split('T')[0];
        }
        return norm;
      }).filter(r => r.student_name);

      if (normalized.length === 0) {
        setCsvError('Could not find valid student data. Ensure your file has a "Name" column.');
        return;
      }

      setCsvData(normalized);
      setCsvFileName(file.name);
    } catch (err) {
      setCsvError(err.message);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleSingleSubmit = () => {
    if (!singleForm.student_name || !singleForm.course_name || !singleForm.certificate_type || !singleForm.start_date) return;
    onGenerate([singleForm]);
  };

  const handleBulkSubmit = () => {
    if (csvData.length === 0) return;
    const entries = csvData.map(row => ({
      ...row,
      certificate_type: bulkType,
    }));
    onGenerate(entries);
  };

  return (
    <div className="cert-form-card animate-fade">
      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          className={`ap-filter-pill ${mode === 'single' ? 'active' : ''}`}
          onClick={() => setMode('single')}
        >
          <FiUser style={{ marginRight: 4 }} /> Single Certificate
        </button>
        <button
          className={`ap-filter-pill ${mode === 'bulk' ? 'active' : ''}`}
          onClick={() => setMode('bulk')}
        >
          <FiUploadCloud style={{ marginRight: 4 }} /> Bulk Upload (CSV/Excel)
        </button>
      </div>

      {/* Single Mode */}
      {mode === 'single' && (
        <>
          <div className="cert-form-grid">
            <div className="cert-field">
              <label><FiUser style={{ marginRight: 4 }} /> Student Name <span className="required">*</span></label>
              <input
                type="text"
                placeholder="Enter student full name"
                value={singleForm.student_name}
                onChange={e => handleSingleChange('student_name', e.target.value)}
              />
            </div>
            <div className="cert-field">
              <label><FiBook style={{ marginRight: 4 }} /> Course / Event Name <span className="required">*</span></label>
              <input
                type="text"
                placeholder="Enter course or event name"
                value={singleForm.course_name}
                onChange={e => handleSingleChange('course_name', e.target.value)}
              />
            </div>
            <div className="cert-field">
              <label><FiType style={{ marginRight: 4 }} /> Certificate Type <span className="required">*</span></label>
              <select
                value={singleForm.certificate_type}
                onChange={e => handleSingleChange('certificate_type', e.target.value)}
              >
                {CERTIFICATE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="cert-field">
              <label><FiCalendar style={{ marginRight: 4 }} /> Start Date <span className="required">*</span></label>
              <input
                type="date"
                value={singleForm.start_date}
                onChange={e => handleSingleChange('start_date', e.target.value)}
              />
            </div>
            <div className="cert-field">
              <label><FiCalendar style={{ marginRight: 4 }} /> End Date <span className="required">*</span></label>
              <input
                type="date"
                value={singleForm.end_date}
                onChange={e => handleSingleChange('end_date', e.target.value)}
              />
            </div>
          </div>

          {/* Preview */}
          {singleForm.student_name && (
            <div style={{ marginTop: 20 }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setShowPreview(!showPreview)}
                style={{ marginBottom: 12 }}
              >
                <FiEye style={{ marginRight: 6 }} /> {showPreview ? 'Hide' : 'Show'} Preview
              </button>
              {showPreview && (
                <div className="cert-preview-wrapper">
                  <div className="cert-preview-scroll" style={{ transform: 'scale(0.55)', transformOrigin: 'top center' }}>
                    <CertificatePreview data={{ ...singleForm, certificate_id: 'OPSK-XXXX-XXXX' }} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="cert-form-actions">
            <button
              className="btn btn-primary"
              onClick={handleSingleSubmit}
              disabled={!singleForm.student_name || !singleForm.course_name || !singleForm.certificate_type || !singleForm.start_date || generating}
            >
              <FiZap style={{ marginRight: 6 }} /> {generating ? 'Generating...' : 'Generate Certificate'}
            </button>
          </div>
        </>
      )}

      {/* Bulk Mode */}
      {mode === 'bulk' && (
        <>
          {/* Common settings for bulk */}
          <div className="cert-form-grid" style={{ marginBottom: 20 }}>
            <div className="cert-field">
              <label><FiType style={{ marginRight: 4 }} /> Certificate Type (All)</label>
              <select value={bulkType} onChange={e => setBulkType(e.target.value)}>
                {CERTIFICATE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Format Instruction */}
          {csvData.length === 0 && (
            <div style={{ marginBottom: 20, padding: 16, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
              <h4 style={{ fontSize: '0.9rem', color: '#0369a1', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                <FiFileText /> Excel / CSV Format Requirements
              </h4>
              <p style={{ fontSize: '0.813rem', color: '#0c4a6e', marginBottom: 12, marginTop: 8 }}>
                Your uploaded file should contain columns with the following headings:
              </p>
              <ul style={{ fontSize: '0.813rem', color: '#0c4a6e', margin: 0, paddingLeft: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <li><strong>Name</strong> (Required)</li>
                <li><strong>Course</strong> (Optional - defaults to column 2)</li>
                <li><strong>Start Date</strong> (Optional)</li>
                <li><strong>End Date</strong> (Optional)</li>
                <li><strong>Certificate ID</strong> (Optional - auto-generated if missing)</li>
              </ul>
            </div>
          )}

          {/* Upload Zone */}
          {csvData.length === 0 ? (
            <div
              className={`cert-upload-zone ${dragOver ? 'dragover' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
            >
              <div className="cert-upload-icon"><FiUploadCloud /></div>
              <p><strong>Click to upload</strong> or drag & drop</p>
              <p className="upload-hint">Accepts .csv, .xlsx, .xls — Must have a "Name" column</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={e => handleFileUpload(e.target.files[0])}
              />
            </div>
          ) : (
            <div className="cert-csv-preview">
              <div className="cert-csv-header">
                <h4>
                  <FiFileText /> {csvFileName}
                  <span className="badge badge-success">{csvData.length} entries</span>
                </h4>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => { setCsvData([]); setCsvFileName(''); }}
                >
                  <FiX style={{ marginRight: 4 }} /> Clear
                </button>
              </div>
              <div className="cert-csv-table-wrap">
                <table className="cert-csv-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Student Name</th>
                      <th>Course / Event</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Cert ID (Optional)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 50).map((row, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td><strong>{row.student_name || '—'}</strong></td>
                        <td>{row.course_name || '—'}</td>
                        <td>{row.start_date || '—'}</td>
                        <td>{row.end_date || '—'}</td>
                        <td>{row.certificate_id || 'Auto'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.length > 50 && (
                <div style={{ padding: '10px 14px', fontSize: '0.75rem', color: 'var(--gray-500)', textAlign: 'center', borderTop: '1px solid var(--gray-100)' }}>
                  Showing first 50 of {csvData.length} entries
                </div>
              )}
            </div>
          )}

          {csvError && (
            <div style={{ marginTop: 12, padding: '10px 16px', background: '#fef2f2', borderRadius: 8, color: '#b91c1c', fontSize: '0.813rem' }}>
              {csvError}
            </div>
          )}

          <div className="cert-form-actions">
            <button
              className="btn btn-primary"
              onClick={handleBulkSubmit}
              disabled={csvData.length === 0 || generating}
            >
              <FiZap style={{ marginRight: 6 }} /> {generating ? 'Generating...' : `Generate ${csvData.length} Certificate${csvData.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
