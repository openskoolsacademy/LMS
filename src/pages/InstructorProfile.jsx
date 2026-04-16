import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiMapPin, FiMail, FiLinkedin, FiAward, FiBriefcase, FiBookOpen, FiUsers, FiStar, FiArrowLeft } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import CourseCard from '../components/ui/CourseCard';
import Skeleton from '../components/ui/Skeleton';
import { generateUserCode } from '../utils/userCode';
import { resolveImageUrl } from '../utils/imageUtils';
import './InstructorProfile.css';

export default function InstructorProfile() {
  const { id } = useParams();
  const [instructor, setInstructor] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    fetchInstructor();
  }, [id]);

  const fetchInstructor = async () => {
    setLoading(true);
    try {
      // Fetch instructor profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, bio, avatar_url, qualification, experience, location, linkedin_url, created_at')
        .eq('id', id)
        .single();

      if (userError) throw userError;
      setInstructor(userData);

      // Fetch their courses + stats
      const [coursesRes, statsRes] = await Promise.all([
        supabase.from('courses')
          .select('*')
          .eq('instructor_id', id)
          .eq('status', 'approved'),
        supabase.rpc('get_all_course_stats')
      ]);

      const statsMap = (statsRes.data || []).reduce((acc, stat) => {
        acc[stat.rpc_course_id] = stat;
        return acc;
      }, {});

      const formatted = (coursesRes.data || []).map(c => {
        const stats = statsMap[c.id] || { student_count: 0, review_count: 0, average_rating: 0 };
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
          price: c.offer_price || c.regular_price || c.price || 0,
          offer_price: c.offer_price || null,
          regular_price: c.regular_price || c.price || 0,
          level: c.level,
          thumbnail: resolveImageUrl(c.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800',
          instructor: userData.name || 'Instructor',
          rating: stats.average_rating || 0,
          reviewsCount: stats.review_count || 0,
          studentsEnrolled: stats.student_count || 0,
          originalPrice: c.offer_price ? (c.regular_price || c.price || 0) : null,
          bestseller: false,
          lastUpdated: new Date(c.updated_at).toLocaleDateString()
        };
      });

      setCourses(formatted);

      const students = formatted.reduce((acc, c) => acc + c.studentsEnrolled, 0);
      setTotalStudents(students);

      const ratings = formatted.filter(c => c.rating > 0);
      const avg = ratings.length ? (ratings.reduce((acc, c) => acc + c.rating, 0) / ratings.length).toFixed(1) : '0.0';
      setAvgRating(avg);

    } catch (error) {
      console.error('Error fetching instructor:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinedDate = instructor?.created_at
    ? new Date(instructor.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : '';

  if (loading) {
    return (
      <div className="instructor-profile-page section">
        <div className="container">
          <Skeleton height={200} />
          <Skeleton height={40} style={{ marginTop: 20, width: '40%' }} />
          <Skeleton height={20} style={{ marginTop: 10, width: '60%' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 40 }}>
            {[1,2,3].map(i => <Skeleton key={i} height={250} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="container section" style={{ textAlign: 'center', padding: '80px 0' }}>
        <h2>Instructor not found</h2>
        <Link to="/courses" className="btn btn-primary btn-md" style={{ marginTop: 16 }}>Browse Courses</Link>
      </div>
    );
  }

  return (
    <div className="instructor-profile-page">
      {/* Hero Section */}
      <div className="ipg-hero">
        <div className="ipg-hero-gradient" />
        <div className="container">
          <div className="ipg-hero-content">
            <Link to="/courses" className="ipg-back"><FiArrowLeft /> Back to Courses</Link>
            <div className="ipg-hero-main">
              <div className="ipg-avatar">
                {instructor.avatar_url ? (
                  <img src={resolveImageUrl(instructor.avatar_url)} alt={instructor.name} />
                ) : (
                  <span>{instructor.name?.charAt(0)?.toUpperCase() || 'I'}</span>
                )}
              </div>
              <div className="ipg-hero-info">
                <div className="ipg-name-row" style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <h1 style={{ margin: 0, color: '#fff' }}>{instructor.name}</h1>
                  <span style={{ 
                    fontFamily: "'Courier New', monospace", 
                    fontSize: '.875rem', 
                    fontWeight: 700, 
                    color: '#fff', 
                    background: 'rgba(255,255,255,0.15)', 
                    backdropFilter: 'blur(10px)', 
                    padding: '4px 12px', 
                    borderRadius: 'var(--radius-sm)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    letterSpacing: '.05em'
                  }}>
                    ID: {generateUserCode(instructor.id)}
                  </span>
                </div>
                <div className="ipg-badge-row" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                  <p className="ipg-hero-badge"><FiAward /> Verified Instructor</p>
                </div>
                <div className="ipg-hero-meta">
                  {instructor.qualification && <span><FiBriefcase /> {instructor.qualification}</span>}
                  {instructor.location && <span><FiMapPin /> {instructor.location}</span>}
                  {instructor.email && <span><FiMail /> {instructor.email}</span>}
                </div>
              </div>
            </div>

            {/* Stats Row */}
            <div className="ipg-stats-row">
              <div className="ipg-stat">
                <div className="ipg-stat-icon"><FiBookOpen /></div>
                <div><strong>{courses.length}</strong><span>Courses</span></div>
              </div>
              <div className="ipg-stat">
                <div className="ipg-stat-icon"><FiUsers /></div>
                <div><strong>{totalStudents.toLocaleString()}</strong><span>Students</span></div>
              </div>
              <div className="ipg-stat">
                <div className="ipg-stat-icon"><FiStar /></div>
                <div><strong>{avgRating}</strong><span>Avg Rating</span></div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <div className="container ipg-body">
        {/* About Section */}
        <div className="ipg-section ipg-about">
          <h2>About</h2>
          <div className="ipg-about-content">
            {instructor.bio ? (
              <p>{instructor.bio}</p>
            ) : (
              <p className="ipg-empty-text">This instructor hasn't added a bio yet.</p>
            )}
          </div>

          <div className="ipg-details-grid">
            {instructor.experience && (
              <div className="ipg-detail-card">
                <FiBriefcase className="ipg-detail-icon" />
                <div>
                  <span>Experience</span>
                  <strong>{instructor.experience}</strong>
                </div>
              </div>
            )}
            {instructor.qualification && (
              <div className="ipg-detail-card">
                <FiAward className="ipg-detail-icon" />
                <div>
                  <span>Qualification</span>
                  <strong>{instructor.qualification}</strong>
                </div>
              </div>
            )}
            {instructor.location && (
              <div className="ipg-detail-card">
                <FiMapPin className="ipg-detail-icon" />
                <div>
                  <span>Location</span>
                  <strong>{instructor.location}</strong>
                </div>
              </div>
            )}
            {instructor.linkedin_url && (
              <div className="ipg-detail-card">
                <FiLinkedin className="ipg-detail-icon" />
                <div>
                  <span>LinkedIn</span>
                  <a href={instructor.linkedin_url} target="_blank" rel="noopener noreferrer">View Profile</a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Courses Section */}
        <div className="ipg-section ipg-courses">
          <h2>Courses by {instructor.name} <span className="ipg-count">({courses.length})</span></h2>
          {courses.length > 0 ? (
            <div className="ipg-courses-grid">
              {courses.map(course => <CourseCard key={course.id} course={course} />)}
            </div>
          ) : (
            <div className="ipg-empty">
              <FiBookOpen size={40} />
              <h3>No Published Courses Yet</h3>
              <p>This instructor hasn't published any courses yet. Check back soon!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
