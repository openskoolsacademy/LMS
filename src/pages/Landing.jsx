import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiChevronLeft, FiChevronRight, FiUsers, FiStar, FiAward, FiActivity, FiPlay, FiCheckCircle } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { categories, mapCategory } from '../data/categories';
import { resolveImageUrl } from '../utils/imageUtils';
import CourseCard from '../components/ui/CourseCard';
import LogoCarousel from '../components/ui/LogoCarousel';
import GlobalBanner from '../components/ui/GlobalBanner';
import './Landing.css';
import Loader from '../components/ui/Loader';


export default function Landing() {
  const [featured, setFeatured] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef();

  useEffect(() => {
    const fetchFeatured = async (retryCount = 0) => {
      const MAX_RETRIES = 3;
      setLoading(true);
      try {
        const [coursesResponse, statsResponse] = await Promise.all([
          supabase.from('courses')
            .select(`*, instructor:users(name, avatar_url)`)
            .eq('status', 'approved')
            .eq('is_featured', true)
            .limit(6),
          supabase.rpc('get_all_course_stats')
        ]);

        if (coursesResponse.error) {
          console.error('Landing: Featured courses fetch error:', coursesResponse.error);
          throw coursesResponse.error;
        }

        console.log(`Landing: Fetched ${coursesResponse.data?.length || 0} featured courses`);

        // Retry if 0 courses returned (RLS/session timing issue)
        if ((!coursesResponse.data || coursesResponse.data.length === 0) && retryCount < MAX_RETRIES) {
          console.log(`Landing: 0 featured courses, retrying in 1.5s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => fetchFeatured(retryCount + 1), 1500);
          return;
        }
        
        const statsMap = (statsResponse.data || []).reduce((acc, stat) => {
          acc[stat.rpc_course_id] = stat;
          return acc;
        }, {});

        const formatted = coursesResponse.data.map(c => {
          const stats = statsMap[c.id] || {};
          return {
            id: c.id,
            title: c.title,
            description: c.description,
            category: mapCategory(c.category),
            price: Number(c.price || 0),
            regular_price: Number(c.regular_price || 0),
            offer_price: Number(c.offer_price || 0),
            level: c.level,
            thumbnail: resolveImageUrl(c.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800',
            instructor: c.instructor?.name || 'Unknown Instructor',
            rating: stats.average_rating || 0,
            reviewsCount: stats.review_count || 0,
            studentsEnrolled: stats.student_count || 0,
            originalPrice: c.regular_price || c.price || 0,
            bestseller: true
          };
        });
        setFeatured(formatted);
      } catch (err) {
        console.error('Landing: Error fetching featured courses:', err);
        if (retryCount < MAX_RETRIES) {
          console.log(`Landing: Retrying after error in 1.5s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => fetchFeatured(retryCount + 1), 1500);
          return;
        }
      } finally {
        setLoading(false);
      }
    };
    const fetchCategoryCounts = async (retryCount = 0) => {
      try {
        const { data, error } = await supabase.from('courses').select('category');
        if (error) throw error;
        
        // Retry if 0 results (same timing issue)
        if ((!data || data.length === 0) && retryCount < 3) {
          setTimeout(() => fetchCategoryCounts(retryCount + 1), 1500);
          return;
        }
        
        const counts = (data || []).reduce((acc, curr) => {
          if (curr.category) {
            const mapped = mapCategory(curr.category);
            acc[mapped] = (acc[mapped] || 0) + 1;
          }
          return acc;
        }, {});
        setCategoryCounts(counts);
      } catch (err) {
        console.error('Error fetching category counts:', err);
        if (retryCount < 3) {
          setTimeout(() => fetchCategoryCounts(retryCount + 1), 1500);
        }
      }
    };

    fetchFeatured();
    fetchCategoryCounts();
  }, []);

  const scroll = (dir) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <div className="landing">
      {/* Pro Level Hero */}
      <section className="hero hero-pro">
        <div className="container hero-container-pro">
          
          <div className="hero-text-pro animate-fade-in-up">
            <span className="hero-label">Level up your skills</span>
            <h1 style={{ color: '#008ad1' }}>Unlock Your Future with Elite Education</h1>
            <p>Master high demand skills in AI, Development, Design, and Business. Learn from industry leading mentors through award winning interactive courses.</p>
            
            <div className="hero-actions-pro">
              <Link to="/courses" className="btn btn-primary btn-lg">
                Enroll Now <FiArrowRight className="ml-2" />
              </Link>
              <Link to="/about" className="btn btn-outline btn-lg white-outline">
                Learn More
              </Link>
            </div>
          </div>
          
          <div className="hero-visual-pro animate-fade-in">
             <div className="abstract-container-pro">
               <div className="persona-wrapper-pro">
                 <div className="portrait-halo-glow"></div>
                 <div className="portrait-dashed-circle"></div>
                 <div className="portrait-solid-circle"></div>
                 <img 
                   src="/Model.png" 
                   alt="Elite Learning" 
                   className="hero-persona-img" 
                   onError={(e) => {
                     e.target.onerror = null;
                     e.target.src = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=600";
                   }}
                 />
               </div>

               {/* Optional: Keep one very clean widget for trust */}
               <div className="ui-badge-simple float-anim-medium">
                  <FiAward className="text-primary" />
                  <span>ISO Certified</span>
               </div>
             </div>
          </div>
          
        </div>
      </section>

      {/* Global Marketing Banner Injection */}
      <div className="container" style={{ marginTop: '20px' }}>
        <GlobalBanner location="Home" />
      </div>

      {/* Recognization Slider */}
      <section className="recognization">
        <div className="container">
          <div className="section-header text-center" style={{ display: 'block' }}>
            <h2>Our Recognition</h2>
            <p>Accreditations that highlight quality and trust.</p>
          </div>
          
          <LogoCarousel />
        </div>
      </section>

      {/* Featured Courses */}
      <section className="featured section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Featured Courses</h2>
              <p>Handpicked courses by our expert instructors</p>
            </div>
            <div className="scroll-btns">
              <button onClick={() => scroll(-1)} aria-label="Scroll left"><FiChevronLeft /></button>
              <button onClick={() => scroll(1)} aria-label="Scroll right"><FiChevronRight /></button>
            </div>
          </div>
          <div className="featured__carousel" ref={scrollRef}>
            {loading ? (
              <Loader text="Loading featured courses..." />
            ) : featured.length > 0 ? (
              featured.map(course => (
                <div key={course.id} className="featured__item">
                  <CourseCard course={course} />
                </div>
              ))
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', width: '100%', color: 'var(--gray-500)' }}>
                No featured courses available at this time.
              </div>
            )}
          </div>
          <div className="text-center" style={{ marginTop: 32 }}>
            <Link to="/courses" className="btn btn-outline btn-md">Browse All Courses <FiArrowRight /></Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="categories section" style={{ background: 'var(--white)' }}>
        <div className="container">
          <div className="section-header text-center" style={{ flexDirection: 'column', alignItems: 'center' }}>
            <span className="section-badge" style={{ marginBottom: 16 }}>Categories</span>
            <h2 style={{ marginBottom: 12 }}>Explore Categories</h2>
            <p>Choose from 4 categories and start learning today</p>
          </div>
          <div className="categories__grid">
            {categories.map(cat => (
              <Link to={`/courses?category=${encodeURIComponent(cat.name)}`} key={cat.id} className="category-card" style={{ '--cat-color': cat.color }}>
                <span className="category-card__icon">{cat.icon}</span>
                <div className="category-card__info">
                  <h4>{cat.name}</h4>
                  <p>{categoryCounts[cat.name] || 0} courses</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>


      {/* CTA Banner */}
      <section className="cta-banner section">
        <div className="container">
          <div className="cta-card">
            <h2>Ready to Start Your Learning Journey?</h2>
            <p>Learn AI, Development, Design, and Business from industry experts anytime, anywhere.</p>
            <div className="cta-actions">
              <Link to="/signup" className="btn btn-primary btn-lg">Get Started Free</Link>
              <Link to="/courses" className="btn btn-cta-outline btn-lg">Explore Courses</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
