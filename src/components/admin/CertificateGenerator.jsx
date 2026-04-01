import { useState, useEffect, useRef, useCallback } from 'react';
import { FiAward, FiFileText, FiList, FiZap, FiTrendingUp } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, AreaChart, Area 
} from 'recharts';
import {
  generateCertificateId,
  generateBulkCertificateIds,
  downloadCertificatePDF,
  downloadCertificatesAsZip,
  getCertTypeLabel,
  getCertTypeColor,
  CERTIFICATE_TYPES,
} from '../../utils/certificateUtils';
import { logCertificateAction, getCertificateLogs, updateCertificateStatus } from '../../utils/certificateLogUtils';
import CertificateForm from './CertificateForm';
import CertificateTable from './CertificateTable';
import CertificatePreview from './CertificatePreview';
import './CertificateGenerator.css';

/**
 * CertificateGenerator — Main orchestrating component for the Certificate Generator tab.
 */
export default function CertificateGenerator() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const [subTab, setSubTab] = useState('generate');
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ current: 0, total: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const [analytics, setAnalytics] = useState({ trends: [], distribution: [] });
  
  // Advanced Filters for Reports
  const [filters, setFilters] = useState({
    search: '',
    course: 'all',
    type: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const printRef = useRef();

  // Fetch all certificates (Audit Trail)
  const fetchCertificates = useCallback(async () => {
    setLoading(true);
    try {
      const { data, count } = await getCertificateLogs({
        page: currentPage,
        limit: 10,
        ...filters
      });
      setCertificates(data || []);
      setTotalCount(count || 0);

      // Process basic analytics from fetched data (or a separate small query for all)
      if (data && data.length > 0) {
        // Distribution
        const dist = CERTIFICATE_TYPES.map(type => ({
          name: type.label,
          value: data.filter(l => l.certificate_type === type.value).length,
          fill: type.color
        })).filter(d => d.value > 0);

        // Simple trends (Daily for visible)
        const trendMap = data.reduce((acc, log) => {
          const date = new Date(log.issued_at).toLocaleDateString([], { month: 'short', day: 'numeric' });
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});
        const trends = Object.entries(trendMap)
          .map(([date, count]) => ({ date, count }))
          .sort((a,b) => new Date(a.date) - new Date(b.date))
          .slice(-7);

        setAnalytics({ distribution: dist, trends });
      }
    } catch (err) {
      console.error('Error fetching certificates:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  // Stats
  const stats = {
    total: certificates.length,
    valid: certificates.filter(c => c.status === 'valid').length,
    revoked: certificates.filter(c => c.status === 'revoked').length,
  };
  const typeCounts = CERTIFICATE_TYPES.map(t => ({
    ...t,
    count: certificates.filter(c => c.certificate_type === t.value).length,
  }));

  // Generate certificates
  const handleGenerate = async (entries) => {
    if (!entries || entries.length === 0) return;

    setGenerating(true);
    setGenProgress({ current: 0, total: entries.length });

    try {
      // Get existing IDs for uniqueness
      const existingIds = certificates.map(c => c.certificate_id);
      const newIds = generateBulkCertificateIds(entries.length, existingIds);

      const records = entries.map((entry, i) => ({
        certificate_id: entry.certificate_id || newIds[i],
        student_name: entry.student_name,
        course_name: entry.course_name,
        certificate_type: entry.certificate_type || 'course',
        date_of_completion: entry.end_date || entry.date_of_completion || new Date().toISOString().split('T')[0],
        start_date: entry.start_date || null,
        end_date: entry.end_date || null,
        instructor_name: entry.instructor_name || '',
        description: entry.description || '',
        status: 'valid',
        created_by: user?.id || null,
      }));

      // Insert in batches of 50
      const batchSize = 50;
      const insertedRecords = [];
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('bulk_certificates')
          .insert(batch)
          .select();
        if (error) throw error;
        
        // Log to certificate_logs for reporting
        if (data) {
          for (const rec of data) {
            await logCertificateAction({
              certificate_id: rec.certificate_id,
              student_name: rec.student_name,
              student_email: rec.student_email || 'N/A',
              course_name: rec.course_name,
              certificate_type: rec.certificate_type,
              issued_by: 'Admin',
              user_id: rec.user_id || null,
              course_id: rec.course_id || null,
              start_date: rec.start_date || null,
              end_date: rec.end_date || null
            });
          }
        }

        insertedRecords.push(...(data || []));
        setGenProgress({ current: Math.min(i + batchSize, records.length), total: records.length });
      }

      await fetchCertificates();

      await showAlert(
        `Successfully generated ${insertedRecords.length} certificate${insertedRecords.length !== 1 ? 's' : ''}!`,
        'Certificates Generated',
        'success'
      );
      setSubTab('all');
    } catch (err) {
      console.error('Error generating certificates:', err);
      await showAlert('Error generating certificates: ' + err.message, 'Generation Failed', 'error');
    } finally {
      setGenerating(false);
      setGenProgress({ current: 0, total: 0 });
    }
  };

  // Delete certificate
  const handleDelete = async (id) => {
    const confirmed = await showConfirm(
      'Are you sure you want to delete this certificate? This cannot be undone.',
      undefined, 'Delete Certificate', 'Delete', 'Cancel'
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('bulk_certificates').delete().eq('id', id);
      if (error) throw error;
      setCertificates(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      await showAlert('Error deleting certificate: ' + err.message, 'Delete Failed', 'error');
    }
  };

  // Revoke / Reactivate
  const handleRevoke = async (id, certId, newStatus) => {
    try {
      // 1. Update the actual certificate
      const { error: bulkErr } = await supabase
        .from('bulk_certificates')
        .update({ status: newStatus === 'active' ? 'valid' : 'revoked' })
        .eq('certificate_id', certId);
      if (bulkErr) throw bulkErr;

      // 2. Update the log so the table UI updates
      await updateCertificateStatus(id, newStatus);
      
      setCertificates(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    } catch (err) {
      await showAlert('Error updating certificate: ' + err.message, 'Update Failed', 'error');
    }
  };

  // Download single PDF
  const handleDownloadPDF = async (cert) => {
    // Create a temporary container at exact certificate dimensions
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '1122px';
    container.style.height = '794px';
    container.style.overflow = 'hidden';
    container.style.zIndex = '-1';
    document.body.appendChild(container);

    // Render using React
    const { createRoot } = await import('react-dom/client');
    const root = createRoot(container);

    await new Promise((resolve) => {
      const ref = { current: null };
      root.render(
        <CertificatePreview
          data={cert}
          innerRef={(el) => {
            ref.current = el;
            if (el) setTimeout(resolve, 500);
          }}
        />
      );
    });

    const el = container.querySelector('.cert-template') || container.querySelector('.cert-template-v3');
    if (el) {
      await downloadCertificatePDF(el, `Certificate_${cert.certificate_id}`);
    }
    root.unmount();
    document.body.removeChild(container);
  };

  // Bulk download as ZIP
  const handleBulkDownload = async () => {
    const confirmed = await showConfirm(
      `Download all ${certificates.length} certificates as a ZIP file? This may take a moment.`,
      undefined, 'Bulk Download', 'Download', 'Cancel'
    );
    if (!confirmed) return;

    setGenerating(true);
    setGenProgress({ current: 0, total: certificates.length });

    try {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.zIndex = '-1';
      document.body.appendChild(container);

      const { createRoot } = await import('react-dom/client');
      const JSZip = (await import('jszip')).default;
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      const zip = new JSZip();

      for (let i = 0; i < certificates.length; i++) {
        const cert = certificates[i];
        setGenProgress({ current: i + 1, total: certificates.length });

        // Render certificate
        const wrapper = document.createElement('div');
        container.appendChild(wrapper);
        const root = createRoot(wrapper);

        await new Promise((resolve) => {
          root.render(
            <CertificatePreview
              data={cert}
              innerRef={(el) => { if (el) setTimeout(resolve, 300); }}
            />
          );
        });

        const el = wrapper.querySelector('.cert-template') || wrapper.querySelector('.cert-template-v3');
        if (el) {
          const canvas = await html2canvas(el, {
            scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff',
            width: 1122, height: 794,
          });
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
          const pdfW = pdf.internal.pageSize.getWidth();
          const pdfH = pdf.internal.pageSize.getHeight();
          pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
          const pdfBlob = pdf.output('blob');
          zip.file(`${cert.certificate_id}.pdf`, pdfBlob);
        }

        root.unmount();
        container.removeChild(wrapper);
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
      document.body.removeChild(container);

      await showAlert('ZIP file downloaded successfully!', 'Download Complete', 'success');
    } catch (err) {
      console.error('Error creating ZIP:', err);
      await showAlert('Error creating ZIP: ' + err.message, 'Download Failed', 'error');
    } finally {
      setGenerating(false);
      setGenProgress({ current: 0, total: 0 });
    }
  };

  return (
    <div className="cert-gen animate-fade">
      {/* Stats Row */}
      <div className="cert-stats-row">
        <div className="cert-stat-card">
          <div className="cert-stat-icon" style={{ background: 'rgba(0, 138, 209, 0.08)', color: '#008ad1' }}>
            <FiAward />
          </div>
          <div className="cert-stat-info">
            <span>Total Certificates</span>
            <strong>{stats.total}</strong>
          </div>
        </div>
        {typeCounts.map(t => (
          <div className="cert-stat-card" key={t.value}>
            <div className="cert-stat-icon" style={{ background: `${t.color}12`, color: t.color }}>
              <FiFileText />
            </div>
            <div className="cert-stat-info">
              <span>{t.label}</span>
              <strong>{t.count}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* Sub Tabs */}
      <div className="cert-sub-tabs">
        <button className={`cert-sub-tab ${subTab === 'generate' ? 'active' : ''}`} onClick={() => setSubTab('generate')}>
          <FiZap style={{ marginRight: 6 }} /> Generate Certificates
        </button>
        <button className={`cert-sub-tab ${subTab === 'all' ? 'active' : ''}`} onClick={() => setSubTab('all')}>
          <FiList style={{ marginRight: 6 }} /> All Certificates ({certificates.length})
        </button>
      </div>

      {/* Content */}
      {subTab === 'generate' && (
        <CertificateForm onGenerate={handleGenerate} generating={generating} />
      )}

      {subTab === 'all' && (
        <>
          {/* Analytics Overview - Integrated from Reports */}
          <div className="cert-analytics-summary animate-fade" style={{ marginBottom: 24 }}>
             <div className="reports-charts-grid" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                <div className="chart-box card-glass">
                  <div className="chart-header">
                    <h4><FiTrendingUp style={{ marginRight: 8 }} /> Generation Trends</h4>
                    <span>Recent Activity</span>
                  </div>
                  <div className="chart-container-v2" style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.trends}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="chart-box card-glass">
                  <div className="chart-header">
                    <h4><FiAward style={{ marginRight: 8 }} /> Type Distribution</h4>
                    <span>Current View</span>
                  </div>
                  <div className="chart-container-v2" style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.distribution}
                          innerRadius={50}
                          outerRadius={70}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {analytics.distribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
             </div>
          </div>

          <CertificateTable
            certificates={certificates}
            totalCount={totalCount}
            filters={filters}
            setFilters={setFilters}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            loading={loading}
            onDelete={handleDelete}
            onRevoke={handleRevoke}
            onDownloadPDF={handleDownloadPDF}
            onBulkDownload={handleBulkDownload}
          />
        </>
      )}

      {/* Generating Overlay */}
      {generating && genProgress.total > 0 && (
        <div className="cert-generating-overlay">
          <div className="cert-generating-card">
            <div className="spinner" />
            <h3>Generating Certificates...</h3>
            <p>{genProgress.current} of {genProgress.total} completed</p>
            <div className="cert-progress-bar">
              <div
                className="cert-progress-fill"
                style={{ width: `${(genProgress.current / genProgress.total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
