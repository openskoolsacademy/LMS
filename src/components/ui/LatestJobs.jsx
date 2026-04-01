import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiBriefcase } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';

export default function LatestJobs({ limit = 4 }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchJobs() {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, company_name, role, salary, location, category')
          .gte('expiry_date', new Date().toISOString().split('T')[0])
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw error;
        setJobs(data || []);
      } catch (err) {
        console.error('Error fetching latest jobs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [limit]);

  if (loading) {
    return (
      <div className="latest-jobs-widget">
        <div className="latest-jobs-widget__header"><h4><FiBriefcase /> Latest Jobs</h4></div>
        <div style={{ padding: 20 }}>
          <div className="skeleton" style={{ height: 50, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 50, marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 50 }} />
        </div>
      </div>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <div className="latest-jobs-widget">
      <div className="latest-jobs-widget__header">
        <h4><FiBriefcase /> Latest Jobs</h4>
        <Link to="/careers">View All →</Link>
      </div>
      <div className="latest-jobs-widget__list">
        {jobs.map(job => (
          <Link key={job.id} to={`/careers/${job.id}`} className="latest-job-item">
            <div className="latest-job-icon">
              {job.company_name?.charAt(0)?.toUpperCase() || 'J'}
            </div>
            <div className="latest-job-info">
              <strong>{job.role}</strong>
              <span>{job.company_name} • {job.location || job.category}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
