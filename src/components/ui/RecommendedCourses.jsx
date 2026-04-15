import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { resolveImageUrl } from '../../utils/imageUtils';
import CourseCard from './CourseCard';

export default function RecommendedCourses({ limit = 4, hideHeader = false }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCourses(retryCount = 0) {
      const MAX_RETRIES = 3;
      try {
        const [coursesRes, statsRes] = await Promise.all([
          supabase
            .from('courses')
            .select('*, instructor:users(name)')
            .eq('status', 'approved')
            .order('created_at', { ascending: false })
            .limit(limit),
          supabase.rpc('get_all_course_stats')
        ]);

        if (coursesRes.error) throw coursesRes.error;

        // Retry if 0 courses returned (RLS/session timing issue)
        if ((!coursesRes.data || coursesRes.data.length === 0) && retryCount < MAX_RETRIES) {
          console.log(`RecommendedCourses: 0 courses, retrying in 1.5s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => fetchCourses(retryCount + 1), 1500);
          return;
        }

        const statsMap = {};
        (statsRes.data || []).forEach(s => {
          statsMap[s.rpc_course_id] = s;
        });

        const mapped = (coursesRes.data || []).map(c => {
          const stats = statsMap[c.id] || { student_count: 0, review_count: 0, average_rating: 0 };
          return {
            id: c.id,
            title: c.title,
            category: c.category,
            instructor: c.instructor?.name || 'Unknown',
            instructorId: c.instructor_id,
            thumbnail: resolveImageUrl(c.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=400',
            price: c.price || 0,
            originalPrice: (c.price || 0) * 1.5,
            rating: stats.average_rating || 0,
            reviewsCount: stats.review_count || 0,
            duration: '8h',
            lessons: 12,
            bestseller: stats.student_count > 10,
          };
        });

        setCourses(mapped);
      } catch (err) {
        console.error('Error fetching recommended courses:', err);
        if (retryCount < MAX_RETRIES) {
          setTimeout(() => fetchCourses(retryCount + 1), 1500);
          return;
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCourses();
  }, [limit]);

  if (loading) {
    return (
      <div className="section-sm">
        <div className="container">
          <div className="skeleton" style={{ height: 200, borderRadius: 12 }} />
        </div>
      </div>
    );
  }

  if (courses.length === 0) return null;

  return (
    <div style={{ padding: hideHeader ? '0' : '40px 0' }}>
      {!hideHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h3 className="careers-section-title">Recommended Courses</h3>
            <p className="careers-section-sub">Upskill yourself to land your dream job</p>
          </div>
          <Link to="/courses" className="btn btn-outline btn-sm" style={{ whiteSpace: 'nowrap' }}>
            View All Courses →
          </Link>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 24 }}>
        {courses.map(c => (
          <CourseCard key={c.id} course={c} />
        ))}
      </div>
    </div>
  );
}
