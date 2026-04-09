import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiPlay, FiClock, FiBookOpen, FiUsers, FiGlobe, FiAward, FiChevronDown, FiChevronUp, FiCheck, FiStar, FiTag, FiFileText, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import Rating from '../components/ui/Rating';
import Button from '../components/ui/Button';
import LatestJobs from '../components/ui/LatestJobs';
import WhatsAppCTA from '../components/ui/WhatsAppCTA';
import { mapCategory } from '../data/categories';
import { resolveImageUrl, resolveVideoUrl } from '../utils/imageUtils';
import './CourseDetail.css';
import Loader from '../components/ui/Loader';


export default function CourseDetail() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState([0]);
  const [activeTab, setActiveTab] = useState('overview');
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(null); // Now stores the coupon object
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [userReview, setUserReview] = useState(null);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState('');

  useEffect(() => {
    fetchCourseDetails();
    if (user) {
      checkEnrollment();
    }
  }, [id, user]);

  const fetchCourseDetails = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    setLoading(true);
    try {
      // 1. Fetch course + instructor + stats
      const [courseRes, statsRes] = await Promise.all([
        supabase
          .from('courses')
          .select(`*, instructor:users(name, avatar_url)`)
          .eq('id', id)
          .single(),
        supabase.rpc('get_all_course_stats')
      ]);

      if (courseRes.error) {
        console.error('CourseDetail: Course fetch error:', courseRes.error);
        // Retry on transient errors (not on "row not found")
        if (courseRes.error.code !== 'PGRST116' && retryCount < MAX_RETRIES) {
          console.log(`CourseDetail: Retrying in 1.5s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => fetchCourseDetails(retryCount + 1), 1500);
          return;
        }
        throw courseRes.error;
      }
      const courseData = courseRes.data;

      const stats = (statsRes.data || []).find(s => s.rpc_course_id === id) || 
        { student_count: 0, review_count: 0, average_rating: 0 };

      // 2. Fetch specific lessons
      const { data: lessonsData, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', id)
        .order('order_index', { ascending: true });

      if (!lessonsError && lessonsData) {
        setLessons(lessonsData);
      }

      setCourse({
        ...courseData,
        instructorId: courseData.instructor_id,
        instructorName: courseData.instructor?.name || 'Unknown',
        instructorAvatar: resolveImageUrl(courseData.instructor?.avatar_url) || 'https://i.pravatar.cc/150?img=11',
        rating: stats.average_rating || 0,
        reviewsCount: stats.review_count || 0,
        studentsEnrolled: stats.student_count || 0,
        originalPrice: courseData.regular_price || courseData.price || 0,
        displayPrice: courseData.offer_price || courseData.regular_price || courseData.price || 0,
        whatYouLearn: (courseData.learning_outcomes && courseData.learning_outcomes.length > 0) 
          ? courseData.learning_outcomes 
          : ['Learn the fundamentals', 'Build a portfolio project'],
        requirements: (courseData.requirements && courseData.requirements.length > 0) 
          ? courseData.requirements 
          : ['No prior experience needed', 'A computer with internet'],
        language: 'Tamil',
        thumbnail: resolveImageUrl(courseData.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800',
      });

      // 3. Fetch reviews
      const { data: reviewsData } = await supabase
        .from('course_reviews')
        .select(`*, user:users(name, avatar_url)`)
        .eq('course_id', id)
        .order('created_at', { ascending: false });

      const finalReviews = reviewsData || [];
      let finalAvg = stats.average_rating || 0;
      let finalCount = stats.review_count || 0;

      if (finalReviews.length > 0) {
        finalCount = finalReviews.length;
        const total = finalReviews.reduce((acc, r) => acc + r.rating, 0);
        finalAvg = total / finalCount;
      }

      setReviews(finalReviews);
      setCourse(prev => ({
        ...prev,
        rating: finalAvg,
        reviewsCount: finalCount
      }));

      if (user && finalReviews.length > 0) {
        const ur = finalReviews.find(r => r.user_id === user.id);
        if (ur) setUserReview(ur);
      }

    } catch (error) {
      console.error('CourseDetail: Error loading course:', error);
      if (retryCount < MAX_RETRIES) {
        console.log(`CourseDetail: Retrying after error in 1.5s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => fetchCourseDetails(retryCount + 1), 1500);
        return;
      }
    } finally {
      setLoading(false);
    }
  };

  const checkEnrollment = async () => {
    const { data } = await supabase
      .from('enrollments')
      .select('id')
      .eq('course_id', id)
      .eq('user_id', user.id)
      .single();
    
    if (data) setIsEnrolled(true);
  };

  const sendNotification = async (userId, title, message, type = 'system') => {
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type
      });
    } catch (err) {
      console.error('Error sending notification:', err);
    }
  };

  const handlePayment = async () => {
    if (!user) {
      await showAlert("Please log in to enroll.", "Login Required", "info");
      return;
    }
    try {
      setLoading(true);

      // 0. Refresh the session to ensure the JWT is fresh and valid
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError) {
        console.warn('Session refresh warning:', sessionError.message);
        // If refresh fails, the user may need to re-login
        await showAlert("Your session has expired. Please log in again.", "Session Expired", "info");
        return;
      }
      console.log('Session refreshed. Token valid until:', sessionData?.session?.expires_at);

      // 1. Create order on the backend securely
      const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
        body: { course_id: id, coupon_code: couponApplied ? couponApplied.code.toUpperCase() : null }
      });

      // Supabase functions.invoke may return the error in `data` instead of `error`
      if (orderError) {
        console.error('Order invoke error:', orderError);
        throw orderError;
      }

      // Check if the response body itself contains an error (e.g., edge function returned 400)
      if (orderData?.error) {
        console.error('Order response error:', orderData.error);
        throw new Error(orderData.error);
      }

      // Validate that we got a valid Razorpay order
      if (!orderData?.id || !orderData?.amount) {
        console.error('Invalid order response:', orderData);
        throw new Error('Invalid order response from server. Please try again.');
      }

      // 2. Ensure Razorpay SDK is loaded
      if (typeof window.Razorpay === 'undefined') {
        throw new Error('Razorpay SDK not loaded. Please check your internet connection or disable ad-blockers.');
      }

      // 3. Options for Razorpay
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_SXsCOJNHFUtIJA',
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Open Skools',
        description: `Enroll in ${course.title}`,
        image: 'https://i.pravatar.cc/150?img=11',
        order_id: orderData.id,
        handler: async function (response) {
          try {
            // 4. Verify payment on backend securely
            const verifyPayload = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              course_id: id,
              amount: orderData.amount
            };
            
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: verifyPayload
            });

            if (verifyError) throw verifyError;
            if (verifyData?.error) throw new Error(verifyData.error);
            
            setIsEnrolled(true);
            
            // Send Notifications
            await Promise.all([
              sendNotification(user.id, 'Enrollment Successful', `Welcome to <strong>"${course.title}"</strong>! You can now start learning.`, 'course'),
              sendNotification(course.instructorId, 'New Student Enrolled', `<strong>${user.user_metadata?.name || 'A student'}</strong> has enrolled in your course <strong>"${course.title}"</strong>.`, 'course')
            ]);

            await showAlert('Payment successful & Enrolled!', 'Success', 'success', true);
          } catch (err) {
            console.error('Payment verification failed:', err);
            const msg = err.message || (typeof err === 'string' ? err : 'Payment verification failed. Please contact support.');
            await showAlert(msg, 'Verification Failed', 'error');
          }
        },
        prefill: {
          name: user.user_metadata?.name || 'Student',
          email: user.email,
        },
        theme: {
          color: '#008ad1'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', async function (response) {
        await showAlert(`Payment Failed: ${response.error.description}`, 'Error', 'error');
      });
      rzp.open();

    } catch (err) {
      console.error('Error initiating checkout:', err);
      
      let errorMessage = 'Failed to initiate checkout.';
      
      // Handle Supabase FunctionsHttpError (has context with response body)
      if (err.context && typeof err.context.json === 'function') {
        try {
          const body = await err.context.json();
          errorMessage = body.error || body.message || body.msg || errorMessage;
        } catch (parseErr) {
          errorMessage = err.message || errorMessage;
        }
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.error && typeof err.error === 'string') {
        errorMessage = err.error;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      await showAlert(errorMessage, 'Checkout Error', 'error');
    } finally {
      setLoading(false);
    }
  };
  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;

  if (!course) return <div className="container section"><h2>Course not found</h2><Link to="/courses" className="btn btn-primary btn-md">Browse Courses</Link></div>;

  const toggleSection = (i) => setOpenSections(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  
  // Group lessons by their defined section_title
  const grouped = lessons.reduce((acc, lesson) => {
    const sec = lesson.section_title || 'General';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(lesson);
    return acc;
  }, {});

  const curriculum = Object.entries(grouped).map(([title, sectionLessons]) => ({
    title,
    lessons: sectionLessons
  }));

  const applyCoupon = async () => { 
    if (!coupon.trim()) return;
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', coupon.toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        await showAlert("Invalid or inactive coupon code.", "Invalid Coupon", "error");
        return;
      }

      if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
        await showAlert("This coupon has expired.", "Expired", "error");
        return;
      }

      if (data.usage_limit && data.used_count >= data.usage_limit) {
        await showAlert("This coupon has reached its usage limit.", "Limit Reached", "error");
        return;
      }

      if (data.course_id && data.course_id !== id) {
        await showAlert("This coupon is not applicable to this course.", "Not Applicable", "error");
        return;
      }

      // If coupon is event-specific, it can't be used for courses
      if (data.event_id) {
        await showAlert("This coupon is not applicable to courses.", "Not Applicable", "error");
        return;
      }

      if (course.is_coupon_applicable === false) {
          await showAlert("Coupons are not allowed for this specific course.", "Not Allowed", "error");
          return;
      }

      setCouponApplied(data);
      await showAlert(`Coupon ${data.code} applied!`, "Success", "success", true);
    } catch (err) {
      await showAlert("Could not apply coupon.", "Error", "error");
    }
  };

  const calculateFinalPrice = () => {
    const basePrice = course.displayPrice;
    if (!couponApplied) return basePrice;
    if (couponApplied.discount_type === 'percentage') {
      return Math.round(basePrice * (1 - couponApplied.discount_value / 100));
    } else {
      return Math.max(0, basePrice - couponApplied.discount_value);
    }
  };

  const finalPrice = calculateFinalPrice();
  const totalDuration = lessons.reduce((acc, l) => acc + (l.duration || 10), 0);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('course_reviews')
        .insert([{
          course_id: id,
          user_id: user.id,
          rating: newRating,
          comment: newComment
        }])
        .select(`*, user:users(name, avatar_url)`)
        .single();
      
      if (error) throw error;
      setReviews([data, ...reviews]);
      setUserReview(data);

      // Instantly update the top course header stats
      const updatedCount = course.reviewsCount + 1;
      const updatedRating = (course.rating * course.reviewsCount + newRating) / updatedCount;
      setCourse(prev => ({
        ...prev,
        rating: updatedRating,
        reviewsCount: updatedCount
      }));

      await showAlert("Thank you for your feedback!", "Review Submitted", "success");
    } catch (err) {
      console.error('Error submitting review:', err);
      await showAlert("Failed to submit review: " + err.message, "Error", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditReview = (review) => {
    setEditingReview(review);
    setEditRating(review.rating);
    setEditComment(review.comment);
  };

  const handleUpdateReview = async (e) => {
    e.preventDefault();
    if (!editComment.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('course_reviews')
        .update({ rating: editRating, comment: editComment })
        .eq('id', editingReview.id)
        .select(`*, user:users(name, avatar_url)`)
        .single();
      
      if (error) throw error;
      setReviews(reviews.map(r => r.id === editingReview.id ? data : r));
      if (editingReview.user_id === user?.id) setUserReview(data);
      setEditingReview(null);

      // Recalculate rating
      const updatedReviews = reviews.map(r => r.id === editingReview.id ? data : r);
      const total = updatedReviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = updatedReviews.length > 0 ? total / updatedReviews.length : 0;
      setCourse(prev => ({ ...prev, rating: avg }));

      await showAlert("Review updated successfully!", "Updated", "success");
    } catch (err) {
      console.error('Error updating review:', err);
      await showAlert("Failed to update review: " + err.message, "Error", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    const confirmed = await showConfirm("Are you sure you want to delete this review? This action cannot be undone.", undefined, 'Delete Review', 'Delete', 'Cancel');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('course_reviews').delete().eq('id', reviewId);
      if (error) throw error;
      const updatedReviews = reviews.filter(r => r.id !== reviewId);
      setReviews(updatedReviews);
      
      // If it was the user's own review, reset
      if (userReview?.id === reviewId) setUserReview(null);

      // Recalculate stats
      const total = updatedReviews.reduce((acc, r) => acc + r.rating, 0);
      const avg = updatedReviews.length > 0 ? total / updatedReviews.length : 0;
      setCourse(prev => ({
        ...prev,
        rating: avg,
        reviewsCount: updatedReviews.length
      }));

      await showAlert("Review deleted successfully.", "Deleted", "success");
    } catch (err) {
      console.error('Error deleting review:', err);
      await showAlert("Failed to delete review: " + err.message, "Error", "error");
    }
  };

  const calculateRatingBars = () => {
    const bars = [5, 4, 3, 2, 1].map(stars => {
      const count = reviews.filter(r => r.rating === stars).length;
      const pct = reviews.length > 0 ? Math.round((count / reviews.length) * 100) : 0;
      return { stars, pct };
    });
    return bars;
  };
  const ratingBars = calculateRatingBars();

  const promoVideo = lessons.find(l => l.title === 'Course Introduction' || l.order_index === 0)?.video_url;

  return (
    <div className="course-detail">
      {/* Header */}
      <div className="cd-header">
        <div className="container cd-header-container">
          <div className="cd-header__content">
            <nav className="cd-breadcrumb animate-fade">
              <Link to="/">Home</Link> / <Link to="/courses">Courses</Link> / <span>{mapCategory(course.category)}</span>
            </nav>
            <div className="cd-header__info animate-slide">
              <h1 className="cd-title">{course.title}</h1>
              <div className="cd-description-wrapper">
                <p className="cd-description">{course.description}</p>
              </div>
              
              <div className="cd-meta-row">
                <div className="cd-rating-badge">
                  <span className="rating-value">{course.rating.toFixed(1)}</span>
                  <Rating value={course.rating} showCount={false} size="sm" />
                  <span className="rating-count">({course.reviewsCount.toLocaleString()} ratings)</span>
                </div>
                <div className="cd-students-count">
                  <FiUsers /> {course.studentsEnrolled.toLocaleString()} students
                </div>
              </div>

              <div className="cd-header-footer">
                <Link to={`/instructor/profile/${course.instructorId}`} className="cd-instructor-link">
                  <span>Created by </span>
                  <strong>{course.instructorName}</strong>
                </Link>
                <div className="cd-last-updated">
                  <FiClock /> Last updated {new Date(course.updated_at || course.created_at).toLocaleDateString()}
                </div>
                <div className="cd-language-badge">
                  <FiGlobe /> {course.language}
                </div>
                <div className="cd-level-badge">
                  <FiAward /> {course.level || 'All Levels'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container cd-body">
        {/* Main Content */}
        <div className="cd-main">
          {/* Mobile Video Preview (Only shows on mobile) */}
          <div className="cd-video-preview animate-fade md-hide">
            {promoVideo ? (
              <iframe 
                src={resolveVideoUrl(promoVideo)}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
                allow="autoplay"
              />
            ) : (
              <img src={course.thumbnail} alt={course.title} />
            )}
          </div>

          {/* Tabs */}
          <div className="cd-tabs">
            {['overview', 'curriculum', 'reviews'].map(tab => (
              <button key={tab} className={`cd-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="cd-overview animate-fade">
              <div className="cd-learn-box">
                <h3>What you'll learn</h3>
                <div className="cd-learn-grid">
                  {course.whatYouLearn?.flatMap(o => o.split('\n')).map(o => o.trim()).filter(Boolean).map((item, i) => (
                    <div key={i} className="cd-learn-item"><FiCheck className="check-icon" /><span>{item}</span></div>
                  ))}
                </div>
              </div>
              
              {course.requirements && course.requirements.length > 0 && (
                <div className="cd-learn-box" style={{ marginTop: '0' }}>
                  <h3>Requirements</h3>
                  <div className="cd-learn-grid">
                    {course.requirements.map((req, i) => (
                      <div key={i} className="cd-learn-item">
                        <span style={{ color: 'var(--dark-600)', marginTop: '2px' }}>•</span>
                        <span>{req}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Curriculum Tab */}
          {activeTab === 'curriculum' && (
            <div className="cd-curriculum animate-fade" style={{ paddingBottom: '24px' }}>
              <div className="cd-curriculum-header" style={{ marginBottom: '24px', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ lineHeight: '1.4', flex: 1, paddingRight: '12px', paddingLeft: '16px' }}>
                  {curriculum.length} sections &bull; {lessons.length} lessons &bull; {Math.floor(totalDuration/60) > 0 ? `${Math.floor(totalDuration/60)}h ` : ''}{totalDuration%60}m
                </span>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: '-4px' }} onClick={() => setOpenSections(openSections.length === curriculum.length ? [] : curriculum.map((_, i) => i))}>
                  {openSections.length === curriculum.length ? 'Collapse all' : 'Expand all'}
                </button>
              </div>
              
              {curriculum.length === 0 ? (
                <div className="empty-state animate-fade" style={{ background: 'var(--gray-50)', padding: '48px 24px', borderRadius: '12px', border: '2px dashed var(--gray-200)', textAlign: 'center' }}>
                  <span style={{ fontSize: '2.5rem', opacity: 0.4, marginBottom: '16px', display: 'block' }}>📚</span>
                  <h4 style={{ color: 'var(--dark)', marginBottom: '8px', fontSize: '1.125rem' }}>Curriculum Empty</h4>
                  <p style={{ color: 'var(--gray-500)', fontSize: '0.938rem' }}>No lessons have been uploaded for this course yet.</p>
                </div>
              ) : (
                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--gray-200)' }}>
                  {curriculum.map((section, i) => (
                    <div key={i} className="cd-section" style={{ border: 'none', borderBottom: i === curriculum.length - 1 ? 'none' : '1px solid var(--gray-200)' }}>
                      <button className="cd-section-header" onClick={() => toggleSection(i)} style={{ background: i % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                        {openSections.includes(i) ? <FiChevronUp /> : <FiChevronDown />}
                        <strong>{section.title}</strong>
                        <span>{section.lessons.length} lessons</span>
                      </button>
                      {openSections.includes(i) && (
                        <div className="cd-section-lessons" style={{ borderTop: '1px solid var(--gray-100)' }}>
                          {section.lessons.map(lesson => (
                            <div key={lesson.id} className="cd-lesson">
                              <span className="lesson-icon"><FiPlay /></span>
                              <span className="lesson-title">{lesson.title}</span>
                              <span className="lesson-duration">{lesson.duration || 10}m</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reviews Tab */}
          {activeTab === 'reviews' && (
            <div className="cd-reviews animate-fade">
              {course.reviewsCount > 0 ? (
                <div className="reviews-summary">
                  <div className="reviews-big-rating">
                    <h2>{course.rating.toFixed(1)}</h2>
                    <Rating value={course.rating} showCount={false} size="lg" />
                    <span>{course.reviewsCount.toLocaleString()} ratings</span>
                  </div>
                  <div className="reviews-bars">
                    {ratingBars.map(bar => (
                      <div key={bar.stars} className="rating-bar-row">
                        <span><FiStar /> {bar.stars}</span>
                        <div className="rating-bar"><div className="rating-bar-fill" style={{ width: `${bar.pct}%` }} /></div>
                        <span>{bar.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state animate-fade" style={{ background: 'var(--gray-50)', padding: '48px 24px', borderRadius: '12px', border: '1px dashed var(--gray-300)', textAlign: 'center', marginBottom: '32px' }}>
                  <span style={{ fontSize: '2.5rem', color: 'var(--warning)', opacity: 0.8, marginBottom: '16px', display: 'block' }}>★</span>
                  <h4 style={{ color: 'var(--dark)', marginBottom: '8px', fontSize: '1.25rem' }}>No Reviews Yet</h4>
                  <p style={{ color: 'var(--gray-500)', fontSize: '0.938rem', maxWidth: '400px', margin: '0 auto' }}>This course hasn't received any ratings. Be the first to share your thoughts!</p>
                </div>
              )}
              <div className="reviews-list">
                {isEnrolled && !userReview && (
                  <form className="review-form card" onSubmit={handleSubmitReview} style={{ marginBottom: '32px', padding: '24px' }}>
                    <h3>Write a Review</h3>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Your Rating</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                           <button 
                            key={star} 
                            type="button" 
                            onClick={() => setNewRating(star)}
                            style={{ 
                              background: 'none', 
                              border: 'none', 
                              fontSize: '1.5rem', 
                              color: star <= newRating ? '#f59e0b' : '#d1d5db',
                              cursor: 'pointer'
                            }}
                           >
                             <FiStar style={{ fill: star <= newRating ? '#f59e0b' : 'none' }} />
                           </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Your Feedback</label>
                      <textarea 
                        rows={3} 
                        placeholder="Tell us what you liked about this course..." 
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        required
                      />
                    </div>
                    <Button variant="primary" type="submit" disabled={submitting}>
                      {submitting ? 'Submitting...' : 'Submit Review'}
                    </Button>
                  </form>
                )}

                {reviews.length === 0 ? (
                  <div className="empty-state"><span className="empty-icon">💬</span><h3>No reviews yet</h3><p>Be the first to review this course</p></div>
                ) : (
                  <div className="reviews-items">
                    {reviews.map(r => (
                      <div key={r.id} className="review-item card" style={{ marginBottom: '16px', padding: '20px' }}>
                        {editingReview?.id === r.id ? (
                          /* Inline Edit Form */
                          <form onSubmit={handleUpdateReview} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                              <img 
                                src={r.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.user?.name || 'User')}`} 
                                alt={r.user?.name} 
                                style={{ width: 40, height: 40, borderRadius: '50%' }}
                              />
                              <strong>{r.user?.name}</strong>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginLeft: 'auto' }}>Editing...</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {[1, 2, 3, 4, 5].map(star => (
                                <button 
                                  key={star} type="button" onClick={() => setEditRating(star)}
                                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: star <= editRating ? '#f59e0b' : '#d1d5db', cursor: 'pointer' }}
                                >
                                  <FiStar style={{ fill: star <= editRating ? '#f59e0b' : 'none' }} />
                                </button>
                              ))}
                            </div>
                            <textarea 
                              rows={3} value={editComment} onChange={e => setEditComment(e.target.value)} required
                              style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--gray-200)', fontSize: '0.938rem', resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <Button variant="primary" type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
                              <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditingReview(null)}>Cancel</button>
                            </div>
                          </form>
                        ) : (
                          /* Normal Review Display */
                          <>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img 
                                  src={r.user?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(r.user?.name || 'User')}`} 
                                  alt={r.user?.name} 
                                  style={{ width: 40, height: 40, borderRadius: '50%' }}
                                />
                                <div>
                                  <strong style={{ display: 'block' }}>{r.user?.name}</strong>
                                  <Rating value={r.rating} showCount={false} size="xs" />
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                  {new Date(r.created_at).toLocaleDateString()}
                                </span>
                                {/* Edit/Delete for own review */}
                                {user && r.user_id === user.id && (
                                  <>
                                    <button 
                                      onClick={() => handleEditReview(r)} 
                                      title="Edit Review"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '4px', display: 'flex', alignItems: 'center' }}
                                    >
                                      <FiEdit2 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteReview(r.id)} 
                                      title="Delete Review"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', display: 'flex', alignItems: 'center' }}
                                    >
                                      <FiTrash2 size={16} />
                                    </button>
                                  </>
                                )}
                                {/* Delete for admin (other people's reviews) */}
                                {user && role === 'admin' && r.user_id !== user.id && (
                                  <button 
                                    onClick={() => handleDeleteReview(r.id)} 
                                    title="Delete Review (Admin)"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px', display: 'flex', alignItems: 'center' }}
                                  >
                                    <FiTrash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p style={{ margin: 0, color: '#475569' }}>{r.comment}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="cd-sidebar animate-fade">
          <div className="cd-price-card">
            {/* Desktop Video Preview */}
            <div className="cd-video-preview animate-fade desk-only">
              {promoVideo ? (
                <iframe 
                  src={resolveVideoUrl(promoVideo)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allowFullScreen
                  allow="autoplay"
                />
              ) : (
                <img src={course.thumbnail} alt={course.title} />
              )}
            </div>

            <div className="cd-price-content">
              <div className="cd-price-row">
                <span className="cd-price">₹{finalPrice.toLocaleString()}</span>
                {(course.offer_price || couponApplied) && (
                  <span className="cd-original-price">₹{course.originalPrice.toLocaleString()}</span>
                )}
                {couponApplied && (
                  <span className="badge badge-success">
                    {couponApplied.discount_type === 'percentage' ? `${couponApplied.discount_value}% OFF` : `₹${couponApplied.discount_value} OFF`}
                  </span>
                )}
                {course.offer_price && !couponApplied && (
                  <span className="badge badge-warning">OFFER PRICE</span>
                )}
              </div>
              
              {!isEnrolled && (
                <>
                  <div className="cd-coupon">
                    <input type="text" placeholder="Enter coupon code" value={coupon} onChange={(e) => setCoupon(e.target.value)} />
                    <button className="btn btn-outline btn-sm" onClick={applyCoupon} disabled={couponApplied}><FiTag /> {couponApplied ? 'Applied' : 'Apply'}</button>
                  </div>
                  {couponApplied && <p className="coupon-msg">Coupon {couponApplied.code} applied successfully!</p>}
                  <Button variant="primary" size="lg" fullWidth onClick={handlePayment}>Enroll Now</Button>

                </>
              )}

              {isEnrolled && (
                 <Link to={`/learn/${course.id}`} style={{ width: '100%' }}><Button variant="success" size="lg" fullWidth>Go to Course</Button></Link>
              )}

              <div className="cd-includes">
                <h4>This course includes:</h4>
                <ul>
                  <li><FiPlay /> ~{Math.floor(totalDuration/60)} hours on-demand video</li>
                  <li><FiBookOpen /> {lessons.length} lessons</li>
                  <li><FiFileText /> Notes and Resource File Available</li>
                  <li><FiAward /> Certificate of completion</li>
                  <li><FiGlobe /> Full lifetime access</li>
                </ul>
              </div>
            </div>
          </div>

            {/* Latest Jobs Widget */}
            <LatestJobs limit={4} />
        </aside>
      </div>
    </div>
  );
}
