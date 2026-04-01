import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiMapPin, FiBriefcase, FiClock, FiUsers, FiExternalLink, FiBookmark, FiShare2, FiCalendar, FiPhone, FiAward, FiInfo, FiChevronRight } from 'react-icons/fi';
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
      document.title = `${data.role} at ${data.company_name} — Open Skools Careers`;
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

  const handleWhatsAppShare = () => {
    const text = `🔥 Job Alert!\n\n*${job.role}* at *${job.company_name}*\n📍 ${job.location || 'Remote'}\n💰 ${job.salary || 'Not Disclosed'}\n\nApply here: ${window.location.href}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
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
              
              <h1 className="jd-title">{job.role}</h1>
              
              <div className="jd-meta-grid">
                <div className="jd-meta-item">
                  <FiBriefcase />
                  <span>{job.company_name}</span>
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
                    <FaWhatsapp /> Share on WhatsApp
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
                   <div className="meta-info">
                      <FiShare2 />
                      <span>Join 5,000+ others following ZO</span>
                   </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Recommended Courses - Professional Section */}
      <section className="jd-related-courses section-bg">
        <div className="container">
          <div className="section-header">
            <div>
              <span className="section-badge">Skill Up</span>
              <h2>Boost Your Chances</h2>
              <p>Relevant courses for professional growth in this field.</p>
            </div>
          </div>
          <div className="jd-courses-grid-wrapper">
             <RecommendedCourses limit={4} />
          </div>
        </div>
      </section>
    </div>

  );
}
