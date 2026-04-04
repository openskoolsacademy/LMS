import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FiSearch, FiMapPin, FiBriefcase, FiDollarSign, FiClock,
  FiTrendingUp, FiUsers, FiStar, FiArrowRight, FiCheckCircle
} from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import GlobalBanner from '../components/ui/GlobalBanner';
import Skeleton from '../components/ui/Skeleton';
import WhatsAppCTA from '../components/ui/WhatsAppCTA';
import RecommendedCourses from '../components/ui/RecommendedCourses';
import './CareersHub.css';

const JOB_CATEGORIES = ['All', 'Walkin', 'Online', 'Work From Home', 'Freshers'];

export default function CareersHub() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    document.title = 'Careers Hub — Open Skools';
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const isNew = (createdAt) => {
    const diff = (new Date() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
    return diff <= 3;
  };

  const isExpired = (expiryDate) => {
    if (!expiryDate) return false;
    return expiryDate < today;
  };

  // Smart Category Matcher
  const jobMatchesCategory = (job, cat) => {
    if (cat === 'All') return true;
    
    // 1. Explicit database category match
    if (job.category === cat) return true;
    
    // 2. Inferred matching based on job properties
    if (cat === 'Walkin') {
      return job.job_mode === 'walkin' || job.job_mode === 'both' || !!job.venue;
    }
    if (cat === 'Online' || cat === 'Work From Home') {
      const loc = (job.location || '').toLowerCase();
      return loc.includes('remote') || loc.includes('home') || loc.includes('online');
    }
    if (cat === 'Freshers') {
      const expr = (job.qualification || '').toLowerCase();
      return expr.includes('fresher') || expr.includes('0 year');
    }
    
    return false;
  };

  // Filter jobs
  const filteredJobs = jobs.filter(job => {
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      (job.company_name || '').toLowerCase().includes(q) ||
      (job.role || '').toLowerCase().includes(q) ||
      (job.description || '').toLowerCase().includes(q) ||
      (job.location || '').toLowerCase().includes(q);
    
    const matchesCategory = jobMatchesCategory(job, activeCategory);
    return matchesSearch && matchesCategory;
  });

  // Sort: active first, then expired
  const sortedJobs = [...filteredJobs].sort((a, b) => {
    const aExpired = isExpired(a.expiry_date) ? 1 : 0;
    const bExpired = isExpired(b.expiry_date) ? 1 : 0;
    if (aExpired !== bExpired) return aExpired - bExpired;
    // Urgent first among active
    if (a.is_urgent && !b.is_urgent) return -1;
    if (!a.is_urgent && b.is_urgent) return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const activeJobsCount = jobs.filter(j => !isExpired(j.expiry_date)).length;
  const categoryCounts = JOB_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = jobs.filter(j => jobMatchesCategory(j, cat)).length;
    return acc;
  }, {});

  return (
    <div className="careers-page">
      {/* ═══════════════════════════════════════════
          HERO SECTION — Mobile-First, Premium Design
      ═══════════════════════════════════════════ */}
      <section className="ch-hero">
        {/* Decorative blobs */}
        <div className="ch-blob ch-blob-1" aria-hidden />
        <div className="ch-blob ch-blob-2" aria-hidden />
        <div className="ch-dot-grid" aria-hidden />

        <div className="container ch-hero-inner">
          {/* LEFT — text + search + stats */}
          <div className="ch-hero-left">
            {/* Trust badge */}
            <div className="ch-trust-badge">
              <FiCheckCircle size={14} />
              <span>Trusted Job Opportunities</span>
            </div>

            <h1 className="ch-headline">
              Find Your <span className="ch-headline-accent">Dream Job</span><br />
              <span className="ch-headline-sub">with Open Skools Careers</span>
            </h1>

            <p className="ch-desc">
              Explore curated job listings from top companies walk-ins, remote roles,
              fresher-friendly openings, and more. Your next opportunity is one click away.
            </p>

            {/* Search Bar */}
            <div className="ch-search-wrap">
              <div className="ch-search-bar">
                <FiSearch className="ch-search-icon" />
                <input
                  type="text"
                  placeholder="Search by company, role, or location..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search jobs"
                />
                <button className="ch-search-btn">
                  Search
                </button>
              </div>
              <div className="ch-search-pills">
                {['Software Engineer', 'Marketing', 'Remote', 'Fresher'].map(tag => (
                  <button
                    key={tag}
                    className="ch-search-pill"
                    onClick={() => setSearch(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Stats */}
            <div className="ch-stats">
              <div className="ch-stat">
                <span className="ch-stat-val">{activeJobsCount}</span>
                <span className="ch-stat-label">Active Jobs</span>
              </div>
              <div className="ch-stat-divider" />
              <div className="ch-stat">
                <span className="ch-stat-val">{new Set(jobs.map(j => j.company_name)).size}</span>
                <span className="ch-stat-label">Companies</span>
              </div>
              <div className="ch-stat-divider" />
              <div className="ch-stat">
                <span className="ch-stat-val">{jobs.filter(j => jobMatchesCategory(j, 'Work From Home')).length}</span>
                <span className="ch-stat-label">Remote Jobs</span>
              </div>
            </div>
          </div>

          {/* RIGHT — banner + floating cards */}
          <div className="ch-hero-right">
            {/* Floating highlight cards removed */}

            {/* Main visual card removed */}

            {/* Banner slot */}
            <div className="ch-banner-slot">
              <GlobalBanner location="Careers" />
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="careers-filters">
        <div className="container">
          <div className="careers-filter-row">
            {JOB_CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`careers-filter-pill ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>({categoryCounts[cat] || 0})</span>
              </button>
            ))}
            <span className="careers-filter-count">
              <FiBriefcase /> {filteredJobs.length} jobs found
            </span>
          </div>
        </div>
      </section>

      {/* Job Cards */}
      <section className="container">
        {loading ? (
          <div className="careers-grid" style={{ paddingTop: 32 }}>
            {[1,2,3,4,5,6].map(i => (
              <Skeleton key={i} height={260} />
            ))}
          </div>
        ) : (
          <div className="careers-grid">
            {sortedJobs.length > 0 ? (
              sortedJobs.map(job => (
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
              <div className="careers-empty">
                <FiBriefcase />
                <h3>No Jobs Found</h3>
                <p>Try adjusting your search or filter criteria.</p>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp CTA */}
        <WhatsAppCTA />

        {/* Recommended Courses */}
        <RecommendedCourses limit={4} />
      </section>
    </div>
  );
}
