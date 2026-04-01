import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiMapPin, FiBriefcase, FiClock, FiBookmark } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import Skeleton from '../components/ui/Skeleton';
import './CareersHub.css'; // Reusing job grid styles

export default function SavedJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Saved Jobs — Open Skools';
    fetchSavedJobs();
  }, []);

  const fetchSavedJobs = async () => {
    setLoading(true);
    try {
      const savedJobIds = JSON.parse(localStorage.getItem('savedJobs') || '[]');
      
      if (savedJobIds.length === 0) {
        setJobs([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .in('id', savedJobIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching saved jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return expiryDate < today;
  };
  const isNew = (createdAt) => {
    const diff = (new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
    return diff <= 3;
  };

  return (
    <div className="section" style={{ minHeight: 'calc(100vh - 80px)', backgroundColor: 'var(--gray-50)', padding: '60px 0' }}>
      <div className="container">
        <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--gray-900)', marginBottom: 12 }}>Saved Jobs</h1>
            <p style={{ fontSize: '1.063rem', color: 'var(--gray-500)' }}>Manage your bookmarked career opportunities</p>
          </div>
          <Link to="/careers" className="btn btn-outline">Browse All Jobs</Link>
        </div>

        {loading ? (
          <div className="careers-grid">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} height={260} />
            ))}
          </div>
        ) : (
          <div className="careers-grid">
            {jobs.length > 0 ? (
              jobs.map(job => (
                <Link key={job.id} to={`/careers/${job.id}`} className="job-card" style={isExpired(job.expiry_date) ? { opacity: 0.6 } : {}}>
                  <div className="job-card__header">
                    <div className="job-card__company-icon">
                      {job.company_name?.charAt(0)?.toUpperCase() || 'J'}
                    </div>
                    <div className="job-card__badges">
                      {/* Job Mode Tag */}
                      {(job.job_mode === 'walkin' || (!job.job_mode && job.venue)) && (
                        <span className="job-badge job-badge--walkin">Walk-in</span>
                      )}
                      {(job.job_mode === 'apply_link' || (!job.job_mode && job.apply_link && !job.venue)) && (
                        <span className="job-badge job-badge--apply">Apply Now</span>
                      )}
                      {job.job_mode === 'both' && (
                        <span className="job-badge job-badge--both">Walk-in & Apply</span>
                      )}
                      {isNew(job.created_at) && !isExpired(job.expiry_date) && (
                        <span className="job-badge job-badge--new">New</span>
                      )}
                      {job.is_urgent && !isExpired(job.expiry_date) && (
                        <span className="job-badge job-badge--urgent">Urgent</span>
                      )}
                      {isExpired(job.expiry_date) && (
                        <span className="job-badge job-badge--expired">Expired</span>
                      )}
                    </div>
                  </div>

                  <div className="job-card__company">{job.company_name}</div>
                  <div className="job-card__role">{job.role}</div>

                  <div className="job-card__details">
                    {job.location && (
                      <div className="job-card__detail">
                        <FiMapPin /> {job.location}
                      </div>
                    )}
                    {job.category && (
                      <div className="job-card__detail">
                        <FiBriefcase /> {job.category}
                      </div>
                    )}
                    {job.date_time && (
                      <div className="job-card__detail">
                        <FiClock /> {job.date_time}
                      </div>
                    )}
                  </div>

                  <div className="job-card__footer">
                    <span className="job-card__salary">{job.salary || 'Not Disclosed'}</span>
                    <span className="job-card__type">{job.job_type || 'Full-time'}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="careers-empty" style={{ gridColumn: '1 / -1', background: 'white', borderRadius: 16 }}>
                <FiBookmark style={{ opacity: 0.5 }} size={48} color="var(--primary)" />
                <h3 style={{ marginTop: 24, marginBottom: 8 }}>No Saved Jobs</h3>
                <p>You haven't bookmarked any jobs yet. Browse careers and save the ones you like.</p>
                <Link to="/careers" className="btn btn-primary" style={{ marginTop: 24 }}>Browse Careers</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
