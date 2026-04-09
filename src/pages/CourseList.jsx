import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { categories, mapCategory } from '../data/categories';
import { resolveImageUrl } from '../utils/imageUtils';
import CourseCard from '../components/ui/CourseCard';
import SearchBar from '../components/ui/SearchBar';
import Skeleton from '../components/ui/Skeleton';
import GlobalBanner from '../components/ui/GlobalBanner';
import './CourseList.css';

const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'latest', label: 'Latest' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
];

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

export default function CourseList() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchParams] = useSearchParams();
  const [selectedCats, setSelectedCats] = useState(() => {
    const cat = searchParams.get('category');
    return cat ? [cat] : [];
  });
  const [selectedLevels, setSelectedLevels] = useState([]);
  const [priceRange, setPriceRange] = useState([0, 10000]);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState('popular');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    setLoading(true);
    try {
      // For MVP, we fetch courses and their instructor profiles alongside real statistics
      const [coursesResponse, statsResponse] = await Promise.all([
        supabase.from('courses')
          .select(`*, instructor:users(name, avatar_url)`)
          .eq('status', 'approved'),
        supabase.rpc('get_all_course_stats')
      ]);

      if (coursesResponse.error) {
        console.error('CourseList: Courses fetch error:', coursesResponse.error);
        throw coursesResponse.error;
      }

      if (statsResponse.error) {
        console.warn('CourseList: Stats fetch error (non-fatal):', statsResponse.error);
      }

      console.log(`CourseList: Fetched ${coursesResponse.data?.length || 0} approved courses`);

      // If we got 0 courses and haven't exhausted retries, try again
      // (handles race condition where auth session isn't fully ready)
      if ((!coursesResponse.data || coursesResponse.data.length === 0) && retryCount < MAX_RETRIES) {
        console.log(`CourseList: 0 courses returned, retrying in 1.5s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => fetchCourses(retryCount + 1), 1500);
        return;
      }
      
      const statsMap = (statsResponse.data || []).reduce((acc, stat) => {
        acc[stat.rpc_course_id] = stat;
        return acc;
      }, {});

      // 2. Fetch real-time reviews to override cached stats
      const { data: reviewsData } = await supabase.from('course_reviews').select('course_id, rating');
      const realStatsMap = (reviewsData || []).reduce((acc, r) => {
        if (!acc[r.course_id]) acc[r.course_id] = { count: 0, total: 0 };
        acc[r.course_id].count++;
        acc[r.course_id].total += r.rating;
        return acc;
      }, {});

      // Map data to match existing UI
      const formatted = coursesResponse.data.map(c => {
        const stats = statsMap[c.id] || { student_count: 0, review_count: 0, average_rating: 0 };
        // Normalize instructor name
        const instructorName = c.instructor?.name 
          ? c.instructor.name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
          : 'Unknown Instructor';

          return {
            id: c.id,
            title: c.title,
            description: c.description,
            category: mapCategory(c.category),
            price: Number(c.price || 0),
            regular_price: Number(c.regular_price || 0),
            offer_price: Number(c.offer_price || 0),
            level: c.level,
            thumbnail: resolveImageUrl(c.thumbnail_url) || 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&q=80&w=800',
            instructor: instructorName,
            instructorId: c.instructor_id,
            rating: realStatsMap[c.id] ? (realStatsMap[c.id].total / realStatsMap[c.id].count) : Number(stats.average_rating || 0),
            reviewsCount: realStatsMap[c.id] ? realStatsMap[c.id].count : Number(stats.review_count || 0),
            studentsEnrolled: Number(stats.student_count || 0),
            lessons: c.lessons_count || 0,
            duration: c.total_duration || '',
            originalPrice: c.regular_price ? Number(c.regular_price) : (c.original_price ? Number(c.original_price) : 0),
            bestseller: !!c.is_bestseller,
            lastUpdated: new Date(c.updated_at).toLocaleDateString()
          };
        });

      setCourses(formatted);
    } catch (error) {
      console.error('CourseList: Error fetching courses:', error);
      // Retry on error
      if (retryCount < MAX_RETRIES) {
        console.log(`CourseList: Retrying after error in 1.5s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => fetchCourses(retryCount + 1), 1500);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleCat = (name) => setSelectedCats(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);
  const toggleLevel = (lvl) => setSelectedLevels(prev => prev.includes(lvl) ? prev.filter(l => l !== lvl) : [...prev, lvl]);

  const filtered = useMemo(() => {
    let result = [...courses];
    if (search) result = result.filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.instructor.toLowerCase().includes(search.toLowerCase()));
    if (selectedCats.length) result = result.filter(c => selectedCats.includes(c.category));
    if (selectedLevels.length) result = result.filter(c => selectedLevels.includes(c.level));
    result = result.filter(c => c.price >= priceRange[0] && c.price <= priceRange[1]);
    if (minRating > 0) result = result.filter(c => c.rating >= minRating);
    switch (sort) {
      case 'popular': result.sort((a, b) => b.studentsEnrolled - a.studentsEnrolled); break;
      case 'rating': result.sort((a, b) => b.rating - a.rating); break;
      case 'latest': result.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()); break;
      case 'price-low': result.sort((a, b) => a.price - b.price); break;
      case 'price-high': result.sort((a, b) => b.price - a.price); break;
    }
    return result;
  }, [courses, search, selectedCats, selectedLevels, priceRange, minRating, sort]);

  const clearFilters = () => { setSelectedCats([]); setSelectedLevels([]); setPriceRange([0, 10000]); setMinRating(0); setSearch(''); };
  const activeFilters = selectedCats.length + selectedLevels.length + (minRating > 0 ? 1 : 0) + (priceRange[1] < 10000 ? 1 : 0);

  return (
    <div className="course-list-page section">
      <GlobalBanner location="Courses" />
      <div className="container">
        <div className="cl-header animate-fade">
          <div>
            <h1>All Courses</h1>
            <p>{loading ? 'Loading...' : `${filtered.length} courses available`}</p>
          </div>
          <div className="cl-header__actions">
            <SearchBar value={search} onChange={setSearch} placeholder="Search courses or instructors..." />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="cl-sort">
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button className="btn btn-outline btn-sm cl-filter-toggle" onClick={() => setShowFilters(!showFilters)}>
              Filters {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
            </button>
          </div>
        </div>

        {/* Active filter tags */}
        {activeFilters > 0 && (
          <div className="active-filters">
            {selectedCats.map(c => <span key={c} className="filter-tag" onClick={() => toggleCat(c)}>{c} ×</span>)}
            {selectedLevels.map(l => <span key={l} className="filter-tag" onClick={() => toggleLevel(l)}>{l} ×</span>)}
            {minRating > 0 && <span className="filter-tag" onClick={() => setMinRating(0)}>★ {minRating}+ ×</span>}
            <button className="clear-filters" onClick={clearFilters}>Clear all</button>
          </div>
        )}

        <div className="cl-body">
          {/* Filters Overlay (Mobile) */}
          {showFilters && (
            <div className="cl-filters-overlay desk-hide" onClick={() => setShowFilters(false)} />
          )}
          
          {/* Sidebar Filters */}
          <aside className={`cl-filters ${showFilters ? 'open' : ''}`}>
            <div className="filter-group">
              <h4>Category</h4>
              {categories.map(cat => (
                <label key={cat.id} className="filter-check">
                  <input type="checkbox" checked={selectedCats.includes(cat.name)} onChange={() => toggleCat(cat.name)} />
                  <span>{cat.name}</span>
                </label>
              ))}
            </div>
            <div className="filter-group">
              <h4>Level</h4>
              {LEVELS.map(lvl => (
                <label key={lvl} className="filter-check">
                  <input type="checkbox" checked={selectedLevels.includes(lvl)} onChange={() => toggleLevel(lvl)} />
                  <span>{lvl}</span>
                </label>
              ))}
            </div>
            <div className="filter-group">
              <h4>Price Range</h4>
              <input type="range" min="0" max="10000" step="500" value={priceRange[1]}
                onChange={(e) => setPriceRange([0, +e.target.value])} />
              <div className="price-range-labels">
                <span>₹0</span>
                <span className="price-separator">—</span>
                <span>₹{priceRange[1].toLocaleString()}</span>
              </div>
            </div>
            <div className="filter-group">
              <h4>Minimum Rating</h4>
              <div className="rating-btns">
                {[4.5, 4.0, 3.5, 3.0].map(r => (
                  <button key={r} className={`rating-filter-btn ${minRating === r ? 'active' : ''}`}
                    onClick={() => setMinRating(minRating === r ? 0 : r)}>
                    ★ {r}+
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Course Grid */}
          <div className="cl-grid">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <div key={i}><Skeleton height={200} /><Skeleton height={20} style={{marginTop: 10}} /><Skeleton height={20} width="60%" style={{marginTop: 10}} /></div>)
            ) : filtered.length > 0 ? (
              filtered.map(course => <CourseCard key={course.id} course={course} />)
            ) : (
              <div className="empty-state animate-fade">
                <span className="empty-icon">🔍</span>
                <h3>No courses found</h3>
                <p>Try adjusting your filters or search terms</p>
                <button className="btn btn-primary btn-sm" onClick={clearFilters}>Clear Filters</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
