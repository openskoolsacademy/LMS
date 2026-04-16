import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiMapPin, FiBriefcase, FiClock, FiUsers, FiExternalLink, FiBookmark, FiShare2, FiCalendar, FiPhone, FiAward, FiInfo, FiChevronRight, FiTrendingUp } from 'react-icons/fi';
import { FaWhatsapp, FaRupeeSign } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import Skeleton from '../components/ui/Skeleton';
import WhatsAppCTA from '../components/ui/WhatsAppCTA';
import RecommendedCourses from '../components/ui/RecommendedCourses';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import './JobDetail.css';

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchJob();
    // Check saved state
    const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '[]');
    setSaved(savedJobs.includes(id));
  }, [id]);

  const fetchJob = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setJob(data);
      document.title = `${data.role} at ${data.company_name} | Open Skools Careers`;
    } catch (err) {
      console.error('Error fetching job:', err);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const isExpired = job?.expiry_date && job.expiry_date < today;
  const isNew = job && (new Date() - new Date(job.created_at)) / (1000 * 60 * 60 * 24) <= 3;

  const handleSave = () => {
    if (!user) {
      showAlert('You need to login first to save this job.', 'Login Required', 'warning');
      return;
    }

    const savedJobs = JSON.parse(localStorage.getItem('savedJobs') || '[]');
    if (saved) {
      const updated = savedJobs.filter(jid => jid !== id);
      localStorage.setItem('savedJobs', JSON.stringify(updated));
      setSaved(false);
    } else {
      savedJobs.push(id);
      localStorage.setItem('savedJobs', JSON.stringify(savedJobs));
      setSaved(true);
    }
  };

  // Helper: wrap text on canvas and return array of lines
  const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const generateJobImage = async () => {
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ── Background ──
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#008ad1');
    grad.addColorStop(1, '#0db1e0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 8);

    // ── Header section ──
    const px = 72; // padding-x
    let y = 70;

    // "JOB OPPORTUNITY" tag
    ctx.fillStyle = '#008ad1';
    const tagText = 'JOB OPPORTUNITY';
    ctx.font = 'bold 22px Arial, sans-serif';
    const tagW = ctx.measureText(tagText).width + 40;
    const tagH = 42;
    const tagR = 21;
    const tagX = W - px - tagW;
    ctx.beginPath();
    ctx.moveTo(tagX + tagR, y);
    ctx.lineTo(tagX + tagW - tagR, y);
    ctx.arcTo(tagX + tagW, y, tagX + tagW, y + tagR, tagR);
    ctx.arcTo(tagX + tagW, y + tagH, tagX + tagW - tagR, y + tagH, tagR);
    ctx.lineTo(tagX + tagR, y + tagH);
    ctx.arcTo(tagX, y + tagH, tagX, y + tagH - tagR, tagR);
    ctx.arcTo(tagX, y, tagX + tagR, y, tagR);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tagText, tagX + 20, y + 29);
    y += 80;

    // Job Role Title
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 54px Arial, sans-serif';
    const roleLines = wrapText(ctx, job.role || '', W - px * 2);
    for (const line of roleLines) {
      ctx.fillText(line, px, y);
      y += 68;
    }
    y += 20;

    // Company Name + Logo
    if (job.company_logo) {
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'Anonymous';
        logoImg.src = job.company_logo;
        await new Promise((resolve) => {
          logoImg.onload = resolve;
          logoImg.onerror = resolve;
        });
        if (logoImg.complete && logoImg.naturalWidth > 0) {
          // Calculate aspect ratio to fit inside 60x60
          const maxDim = 60;
          let dw = logoImg.naturalWidth, dh = logoImg.naturalHeight;
          if (dw > dh) {
            dh = (dh / dw) * maxDim;
            dw = maxDim;
          } else {
            dw = (dw / dh) * maxDim;
            dh = maxDim;
          }
          // Center vertically relative to text
          const dy = y - 45 + (maxDim - dh) / 2;
          ctx.drawImage(logoImg, px, dy, dw, dh);
          
          ctx.fillStyle = '#008ad1';
          ctx.font = 'bold 34px Arial, sans-serif';
          ctx.fillText(job.company_name || '', px + 75, y);
          y += 60;
        } else {
          ctx.fillStyle = '#008ad1';
          ctx.font = 'bold 34px Arial, sans-serif';
          ctx.fillText(job.company_name || '', px, y);
          y += 60;
        }
      } catch (err) {
        ctx.fillStyle = '#008ad1';
        ctx.font = 'bold 34px Arial, sans-serif';
        ctx.fillText(job.company_name || '', px, y);
        y += 60;
      }
    } else {
      ctx.fillStyle = '#008ad1';
      ctx.font = 'bold 34px Arial, sans-serif';
      ctx.fillText(job.company_name || '', px, y);
      y += 60;
    }

    // Divider line
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(W - px, y);
    ctx.stroke();
    y += 40;

    // ── Info rows ──
    const drawInfoRow = (label, value) => {
      ctx.fillStyle = '#6b7280';
      ctx.font = '600 24px Arial, sans-serif';
      ctx.fillText(label, px, y);
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 28px Arial, sans-serif';
      const valLines = wrapText(ctx, value, W - px * 2 - 220);
      ctx.fillText(valLines[0] || '', px + 220, y);
      if (valLines[1]) {
        y += 36;
        ctx.fillText(valLines[1], px + 220, y);
      }
      y += 48;
    };

    drawInfoRow('Location', job.location || 'Remote');
    if (job.experience_level) drawInfoRow('Experience', job.experience_level);
    drawInfoRow('Job Type', job.job_type || 'Full-time');
    if (job.salary) drawInfoRow('Salary', job.salary);
    if (job.qualification) drawInfoRow('Qualification', job.qualification);
    if (job.vacancies) drawInfoRow('Vacancies', `${job.vacancies} Openings`);

    // Walk-in details
    if (job.venue) drawInfoRow('Venue', job.venue);
    if (job.date_time) drawInfoRow('Date & Time', job.date_time);

    // ── Job Description ──
    if (job.description) {
      y += 8;
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(W - px, y);
      ctx.stroke();
      y += 36;

      ctx.fillStyle = '#111827';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText('Job Description', px, y);
      y += 36;

      ctx.fillStyle = '#374151';
      ctx.font = '24px Arial, sans-serif';
      const descSnippet = job.description.substring(0, 250).trim() + (job.description.length > 250 ? '...' : '');
      const descLines = wrapText(ctx, descSnippet, W - px * 2);
      for (let i = 0; i < Math.min(descLines.length, 5); i++) {
        ctx.fillText(descLines[i], px, y);
        y += 34;
      }
    }

    // ── Apply link text ──
    y = Math.max(y + 30, H - 270);
    ctx.fillStyle = '#008ad1';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText('Apply Here: www.openskools.com', px, y);
    y += 20;

    // ── Footer ──
    const footerH = 160;
    const footerY = H - footerH;

    // Footer bg
    const footGrad = ctx.createLinearGradient(0, footerY, W, footerY);
    footGrad.addColorStop(0, '#008ad1');
    footGrad.addColorStop(1, '#0068a3');
    ctx.fillStyle = footGrad;
    ctx.fillRect(0, footerY, W, footerH);

    // Footer text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText('Open Skools Academy', px, footerY + 52);

    ctx.font = '22px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('ISO 9001:2015 Certified  |  NCS Registered', px, footerY + 90);

    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('www.openskools.com  |  8189989150', px, footerY + 128);

    return canvas;
  };

  const handleWhatsAppShare = async () => {
    try {
      const canvas = await generateJobImage();
      
      // Convert canvas to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `${(job.role || 'job').replace(/\s+/g, '-')}-Open-Skools.png`, { type: 'image/png' });

      // Try Web Share API (works on mobile — direct share to WhatsApp)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${job.role} at ${job.company_name}`,
          text: `*Job Opportunity:*\n\n*Role:* ${job.role}\n*Company:* ${job.company_name}\n*More Details:* ${window.location.href}`,
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(job.role || 'job').replace(/\s+/g, '-')}-Open-Skools.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert('Job poster downloaded! You can share it on WhatsApp.', 'Image Saved', 'success');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        showAlert('Could not share. Try again.', 'Error', 'error');
      }
    }
  };

  if (loading) {
    return (
      <div>
        <div className="jd-header"><div className="container"><Skeleton height={120} /></div></div>
        <div className="container" style={{ padding: '40px 24px' }}>
          <Skeleton height={400} />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="container section text-center">
        <h2>Job Not Found</h2>
        <p style={{ color: 'var(--gray-500)', marginBottom: 24 }}>This job listing may have been removed.</p>
        <Link to="/careers" className="btn btn-primary btn-md">Browse All Jobs</Link>
      </div>
    );
  }

  const daysLeft = job.expiry_date
    ? Math.ceil((new Date(job.expiry_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="job-detail-page">
      {/* Header / Hero */}
      <section className="jd-hero">
        <div className="jd-mesh-bg"></div>
        <div className="container">
          <nav className="jd-breadcrumb">
            <Link to="/">Home</Link>
            <FiChevronRight />
            <Link to="/careers">Careers</Link>
            <FiChevronRight />
            <span className="current">{job.role}</span>
          </nav>

          <div className="jd-hero-content">
            <div className="jd-hero-main">
              <div className="jd-badges-row">
                {/* Job Mode Tag */}
                {(job.job_mode === 'walkin' || (!job.job_mode && job.venue)) && (
                  <span className="job-badge job-badge--walkin">Walk-in Interview</span>
                )}
                {(job.job_mode === 'apply_link' || (!job.job_mode && job.apply_link && !job.venue)) && (
                  <span className="job-badge job-badge--apply">Apply Online</span>
                )}
                {job.job_mode === 'both' && (
                  <span className="job-badge job-badge--both">Walk-in & Online</span>
                )}
                {isNew && !isExpired && <span className="job-badge job-badge--new">New Arrival</span>}
                {job.is_urgent && !isExpired && <span className="job-badge job-badge--urgent">Urgent Hiring</span>}
                {isExpired && <span className="job-badge job-badge--expired">Position Filled</span>}
                <span className="job-badge badge-category">{job.category}</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                {job.company_logo && (
                  <img 
                    src={job.company_logo} 
                    alt={job.company_name} 
                    style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '8px', background: '#fff', padding: '6px', border: '1px solid var(--border-color)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} 
                  />
                )}
                <h1 className="jd-title" style={{ marginBottom: 0 }}>{job.role}</h1>
              </div>
              
              <div className="jd-meta-grid">
                <div className="jd-meta-item">
                  {!job.company_logo && <FiBriefcase />}
                  <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{job.company_name}</span>
                </div>
                <div className="jd-meta-item">
                  <FiMapPin />
                  <span>{job.location || 'Remote'}</span>
                </div>
                <div className="jd-meta-item">
                  <FaRupeeSign />
                  <span>{job.salary || 'Competitive Pay'}</span>
                </div>
                {job.job_type && (
                  <div className="jd-meta-item">
                    <FiClock />
                    <span>{job.job_type}</span>
                  </div>
                )}
                {job.experience_level && (
                  <div className="jd-meta-item">
                    <FiTrendingUp />
                    <span>{job.experience_level}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Action (Hidden on mobile via CSS) */}
            <div className="jd-hero-side-action">
              <div className="jd-trust-badge">
                <FiAward />
                <span>Verified Career Opportunity</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Body Section */}
      <main className="jd-content-wrapper section">
        <div className="container">
          <div className="jd-layout-grid">
            {/* Left: Job Description & Details */}
            <div className="jd-main-section">
              {/* Quick Summary Cards (Mobile Friendly) */}
              <div className="jd-quick-stats">
                  {job.qualification && (
                    <div className="stat-card">
                       <FiAward />
                       <div>
                         <label>Qualification</label>
                         <strong>{job.qualification}</strong>
                       </div>
                    </div>
                  )}
                  {job.experience_level && (
                    <div className="stat-card">
                       <FiTrendingUp />
                       <div>
                         <label>Experience Level</label>
                         <strong>{job.experience_level}</strong>
                       </div>
                    </div>
                  )}
                  {job.vacancies && (
                    <div className="stat-card">
                       <FiUsers />
                       <div>
                         <label>Vacancies</label>
                         <strong>{job.vacancies} openings</strong>
                       </div>
                    </div>
                  )}
                  {daysLeft !== null && (
                    <div className={`stat-card ${isExpired ? 'expired' : daysLeft <= 3 ? 'urgent' : ''}`}>
                       <FiClock />
                       <div>
                         <label>Status</label>
                         <strong>
                           {isExpired ? 'Expired' : `Expires in ${daysLeft} days`}
                         </strong>
                       </div>
                    </div>
                  )}
              </div>

              {/* Description Content */}
              <div className="jd-article animate-fade-in-up">
                <div className="jd-article-section">
                   <h3><FiInfo /> About the Role</h3>
                   <div className="jd-text-content">
                     {job.description || "No description provided."}
                   </div>
                </div>

                {job.venue && (
                  <div className="jd-article-section">
                    <h3><FiMapPin /> Interview Venue</h3>
                    <div className="jd-text-content">{job.venue}</div>
                  </div>
                )}

                {job.contact_details && (
                  <div className="jd-article-section">
                    <h3><FiPhone /> Contact Information</h3>
                    <div className="jd-text-content">{job.contact_details}</div>
                  </div>
                )}
              </div>

              <div className="jd-whatsapp-section">
                 <WhatsAppCTA />
              </div>
            </div>

            {/* Right: Sidebar Actions */}
            <aside className="jd-sidebar-nav">
              <div className="jd-sidebar-card sticky-sidebar">
                <h4 className="sidebar-title">Interested in this role?</h4>
                <p className="sidebar-text">Make sure to review the requirements before applying.</p>
                
                {/* Walk-in Details Card (when applicable) */}
                {(job.venue || job.date_time) && (
                  <div className="walkin-info-card">
                    <h5>Walk-in Details</h5>
                    {job.date_time && (
                      <div className="walkin-detail">
                        <FiCalendar />
                        <span>{job.date_time}</span>
                      </div>
                    )}
                    {job.venue && (
                      <div className="walkin-detail">
                        <FiMapPin />
                        <span>{job.venue}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="jd-action-buttons">
                  {/* Apply button (only show if apply_link exists) */}
                  {job.apply_link && !isExpired ? (
                    <a
                      href={job.apply_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary btn-lg full-btn"
                    >
                      <FiExternalLink /> Apply Online
                    </a>
                  ) : isExpired ? (
                    <button className="btn btn-gray btn-lg full-btn" disabled>
                      Registration Closed
                    </button>
                  ) : !job.apply_link && (job.venue || job.date_time) ? (
                    <div className="walkin-only-notice">
                      <FiInfo /> This is a walk-in only opportunity. Visit the venue directly.
                    </div>
                  ) : (
                    <button className="btn btn-gray btn-lg full-btn" disabled>
                      Contact employer directly
                    </button>
                  )}

                  <button className="btn btn-whatsapp-outline btn-lg full-btn" onClick={handleWhatsAppShare}>
                    <FaWhatsapp /> Share Job Poster
                  </button>

                  <button 
                    className={`btn btn-save-outline btn-lg full-btn ${saved ? 'saved' : ''}`} 
                    onClick={handleSave}
                  >
                    <FiBookmark /> {saved ? 'Saved for Later' : 'Save for Later'}
                  </button>
                </div>

                <div className="jd-footer-meta">
                   {job.expiry_date && (
                     <div className="meta-info">
                        <FiCalendar />
                        <span>Deadline: {new Date(job.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                     </div>
                   )}

                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Recommended Courses - Professional Section */}
      <section className="jd-related-courses">
        <div className="container">
          <div className="jd-course-header">
            <div className="jd-course-title-area">
              <div className="section-badge">Skill Up</div>
              <h2>Boost Your Chances</h2>
              <p>Relevant courses for professional growth in this field.</p>
            </div>
            <Link to="/courses" className="btn btn-outline btn-sm hidden md:flex">
              View All Courses
            </Link>
          </div>
          <div className="jd-courses-grid-wrapper">
             <RecommendedCourses limit={4} hideHeader={true} />
          </div>
        </div>
      </section>
    </div>

  );
}
