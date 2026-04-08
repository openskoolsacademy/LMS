import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiUser, FiVideo, FiAward, FiDownload, FiExternalLink, FiCheckCircle, FiXCircle, FiUsers, FiMapPin, FiMessageCircle, FiChevronRight, FiTag, FiBookOpen, FiTarget } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import Certificate from '../components/ui/Certificate';
import { resolveImageUrl } from '../utils/imageUtils';
import './LiveBootcampDetail.css';
import Loader from '../components/ui/Loader';


export default function LiveBootcampDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const { showAlert } = useAlert();
  const [bootcamp, setBootcamp] = useState(null);
  const [enrollment, setEnrollment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [activeCert, setActiveCert] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(null);

  useEffect(() => {
    fetchBootcamp();
  }, [id, user]);

  const fetchBootcamp = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_bootcamps')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setBootcamp(data);

      if (user) {
        const { data: enrollData } = await supabase
          .from('live_bootcamp_enrollments')
          .select('*')
          .eq('user_id', user.id)
          .eq('live_bootcamp_id', id)
          .maybeSingle();

        setEnrollment(enrollData || null);
      }
    } catch (err) {
      console.error('Error fetching bootcamp:', err);
    } finally {
      setLoading(false);
    }
  };

  const getBootcampStatus = () => {
    if (!bootcamp) return 'upcoming';
    const now = new Date();
    const startDate = new Date(bootcamp.start_date);
    const endDate = new Date(bootcamp.end_date);
    if (bootcamp.status === 'completed' || now > endDate) return 'completed';
    if (bootcamp.status === 'active' || (now >= startDate && now <= endDate)) return 'active';
    return 'upcoming';
  };

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
        await showAlert('Invalid or inactive coupon code.', 'Invalid Coupon', 'error');
        return;
      }
      if (data.expiry_date && new Date(data.expiry_date) < new Date()) {
        await showAlert('This coupon has expired.', 'Expired', 'error');
        return;
      }
      if (data.usage_limit && data.used_count >= data.usage_limit) {
        await showAlert('This coupon has reached its usage limit.', 'Limit Reached', 'error');
        return;
      }
      if (data.course_id || data.event_id) {
        await showAlert('This coupon is not applicable to bootcamps.', 'Not Applicable', 'error');
        return;
      }
      if (data.live_bootcamp_id && data.live_bootcamp_id !== id) {
        await showAlert('This coupon is not applicable to this bootcamp.', 'Not Applicable', 'error');
        return;
      }
      setCouponApplied(data);
      await showAlert(`Coupon ${data.code} applied!`, 'Success', 'success', { celebrate: true });
    } catch (err) {
      await showAlert('Could not apply coupon.', 'Error', 'error');
    }
  };

  const calculateFinalPrice = () => {
    if (!bootcamp || bootcamp.price <= 0) return 0;
    const basePrice = bootcamp.price;
    if (!couponApplied) return basePrice;
    if (couponApplied.discount_type === 'percentage') {
      return Math.max(0, Math.round(basePrice * (1 - couponApplied.discount_value / 100)));
    } else {
      return Math.max(0, basePrice - couponApplied.discount_value);
    }
  };

  const handleRegister = async () => {
    if (!user) {
      await showAlert('Please log in to enroll in this bootcamp.', 'Login Required', 'info');
      return;
    }
    setRegistering(true);
    try {
      // Always refresh session before any operation
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !sessionData?.session) {
        await showAlert('Your session has expired. Please log in again.', 'Session Expired', 'info');
        setRegistering(false);
        return;
      }

      const finalPrice = calculateFinalPrice();

      if (finalPrice > 0) {
        const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
          body: { live_bootcamp_id: bootcamp.id, amount: finalPrice * 100 }
        });

        if (orderError) {
          // Extract actual error message from edge function response
          let errMsg = 'Order creation failed.';
          if (orderError.context && typeof orderError.context.json === 'function') {
            try { const body = await orderError.context.json(); errMsg = body.error || body.message || errMsg; } catch {}
          } else if (orderError.message) errMsg = orderError.message;
          throw new Error(errMsg);
        }
        if (orderData?.error) throw new Error(orderData.error);
        if (!orderData?.id || !orderData?.amount) throw new Error('Invalid order response.');

        if (typeof window.Razorpay === 'undefined') {
          throw new Error('Razorpay SDK not loaded.');
        }

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_live_SXsCOJNHFUtIJA',
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'Open Skools',
          description: `Enroll in ${bootcamp.title}`,
          image: '/favicon.png',
          order_id: orderData.id,
          handler: async function (response) {
            try {
              const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
                body: {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  live_bootcamp_id: bootcamp.id,
                  amount: orderData.amount
                }
              });
              if (verifyError) throw verifyError;
              if (verifyData?.error) throw new Error(verifyData.error);

              if (couponApplied) {
                await supabase.from('coupons').update({ used_count: (couponApplied.used_count || 0) + 1 }).eq('id', couponApplied.id);
              }

              const { data: enrollData } = await supabase.from('live_bootcamp_enrollments').insert([{
                user_id: user.id,
                live_bootcamp_id: bootcamp.id,
                registered: true,
                payment_id: response.razorpay_payment_id,
                amount_paid: finalPrice
              }]).select().single();

              setEnrollment(enrollData || { registered: true });
              await showAlert('Payment successful! You are enrolled.', 'Success', 'success', { celebrate: true });
            } catch (err) {
              await showAlert(err.message || 'Payment verification failed.', 'Error', 'error');
            } finally {
              setRegistering(false);
            }
          },
          prefill: { name: profile?.name || 'Student', email: user.email },
          theme: { color: '#008ad1' }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async (response) => {
          await showAlert(`Payment Failed: ${response.error.description}`, 'Error', 'error');
          setRegistering(false);
        });
        rzp.open();
        return;
      }

      // Free or fully discounted
      if (couponApplied) {
        await supabase.from('coupons').update({ used_count: (couponApplied.used_count || 0) + 1 }).eq('id', couponApplied.id);
      }

      const { data: enrollData, error: enrollError } = await supabase.from('live_bootcamp_enrollments').insert([{
        user_id: user.id,
        live_bootcamp_id: bootcamp.id,
        registered: true,
        amount_paid: 0
      }]).select().single();

      if (enrollError) {
        if (enrollError.code === '23505') {
          await showAlert('You are already enrolled.', 'Already Enrolled', 'info');
        } else throw enrollError;
      } else {
        setEnrollment(enrollData);
        await showAlert('You have been enrolled!', 'Success', 'success', { celebrate: true });
      }
    } catch (err) {
      console.error('Enrollment error:', err);
      let msg = 'Enrollment failed.';
      if (err.context && typeof err.context.json === 'function') {
        try { const body = await err.context.json(); msg = body.error || body.message || msg; } catch {}
      } else if (err.message) msg = err.message;
      await showAlert(msg, 'Error', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleJoinLive = async () => {
    if (!enrollment?.registered) return;
    if (bootcamp.live_link) window.open(bootcamp.live_link, '_blank');
    else await showAlert('Live link not available yet. Please check back later.', 'Info', 'info');
  };


  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formatShortDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;

  if (!bootcamp) return (
    <div className="container section" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h2>Bootcamp not found</h2>
      <Link to="/live-bootcamps" className="btn btn-primary btn-md" style={{ marginTop: 16 }}>Browse Bootcamps</Link>
    </div>
  );

  const status = getBootcampStatus();
  const isEnrolled = enrollment?.registered;
  const isCompleted = enrollment?.completed;

  return (
    <div className="lbd-detail">
      {/* Header */}
      <div className="lbd-header">
        <div className="container">
          <nav className="lbd-breadcrumb animate-fade">
            <Link to="/">Home</Link>
            <FiChevronRight />
            <Link to="/live-bootcamps">Bootcamps</Link>
            <FiChevronRight />
            <span>{bootcamp.title}</span>
          </nav>

          <div className="lbd-header-grid">
            <div className="lbd-header-content animate-fade">
              <div className="lbd-header-badges">
                <span className="lbd-badge"><FiBookOpen /> Online Bootcamp</span>
                {status === 'active' && <span className="lbd-badge live">Active Now</span>}
                {status === 'upcoming' && <span className="lbd-badge">Upcoming</span>}
                {status === 'completed' && <span className="lbd-badge">Completed</span>}
                {bootcamp.enable_certificate && <span className="lbd-badge cert"><FiAward /> Certificate</span>}
              </div>

              <h1>{bootcamp.title}</h1>
              <p className="lbd-header-desc">{bootcamp.description || 'Master in-demand skills with intensive, instructor-led live sessions.'}</p>

              <div className="lbd-header-meta">
                <div className="lbd-header-meta-item">
                  <FiCalendar /> {formatShortDate(bootcamp.start_date)} - {formatShortDate(bootcamp.end_date)}
                </div>
                <div className="lbd-header-meta-item">
                  <FiClock /> {bootcamp.total_sessions} Sessions
                </div>
                <div className="lbd-header-meta-item">
                  <FiUser /> {bootcamp.instructor_name}
                </div>
              </div>
            </div>

            {/* Media */}
            <div className="lbd-media animate-fade">
              <img
                src={resolveImageUrl(bootcamp.thumbnail_url) || 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800'}
                alt={bootcamp.title}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Body — 2-column */}
      <div className="container">
        <div className="lbd-body">
          {/* Main Content */}
          <div className="lbd-main animate-fade">
            {/* Status Banners */}
            {isCompleted && bootcamp.enable_certificate && (
              <div className="lbd-attendance-banner attended">
                <FiCheckCircle />
                <div>
                  <span>You completed this bootcamp</span>
                  <span className="sub-text">Certificate available for download</span>
                </div>
              </div>
            )}
            {isEnrolled && !isCompleted && status === 'completed' && (
              <div className="lbd-attendance-banner not-attended">
                <FiXCircle />
                <div>
                  <span>Certificate not available</span>
                  <span className="sub-text">You did not complete this bootcamp</span>
                </div>
              </div>
            )}

            {/* Schedule */}
            {bootcamp.schedule_info && (
              <>
                <span className="lbd-section-label">Schedule</span>
                <h2 className="lbd-section-title">Bootcamp Schedule</h2>
                <div className="lbd-schedule-card">
                  <div className="lbd-schedule-row">
                    <FiCalendar />
                    <div>
                      <strong>Duration</strong>
                      <span>{formatShortDate(bootcamp.start_date)} to {formatShortDate(bootcamp.end_date)}</span>
                    </div>
                  </div>
                  <div className="lbd-schedule-row">
                    <FiClock />
                    <div>
                      <strong>Timing</strong>
                      <span>{bootcamp.schedule_info}</span>
                    </div>
                  </div>
                  <div className="lbd-schedule-row">
                    <FiTarget />
                    <div>
                      <strong>Total Sessions</strong>
                      <span>{bootcamp.total_sessions} Live Sessions</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* About */}
            <span className="lbd-section-label">Overview</span>
            <h2 className="lbd-section-title">About This Bootcamp</h2>
            <div className="lbd-about-text">
              {bootcamp.description || 'Join us for this intensive live bootcamp. Learn from industry experts and gain practical knowledge that you can apply immediately.'}
            </div>

            {/* Learning Outcomes */}
            {bootcamp.learning_outcomes && bootcamp.learning_outcomes.length > 0 && (
              <>
                <span className="lbd-section-label">What You Will Learn</span>
                <h2 className="lbd-section-title">Learning Outcomes</h2>
                <ul className="lbd-achieve-list">
                  {bootcamp.learning_outcomes.flatMap(o => o.split('\n')).map(o => o.trim()).filter(Boolean).map((outcome, i) => (
                    <li key={i}><FiCheckCircle /> {outcome}</li>
                  ))}
                </ul>
              </>
            )}

            {/* What You'll Achieve */}
            <span className="lbd-section-label">By the End of This Bootcamp</span>
            <h2 className="lbd-section-title">What You'll Achieve</h2>
            <ul className="lbd-achieve-list">
              {bootcamp.achievements && bootcamp.achievements.length > 0 ? (
                <>
                  {bootcamp.achievements.flatMap(o => o.split('\n')).map(o => o.trim()).filter(Boolean).map((outcome, i) => (
                    <li key={`achieve-${i}`}><FiCheckCircle /> {outcome}</li>
                  ))}
                  {bootcamp.enable_certificate && (
                    <li><FiCheckCircle /> Earn a verifiable certificate of completion</li>
                  )}
                </>
              ) : (
                <>
                  <li><FiCheckCircle /> Gain practical, job-ready skills from industry experts</li>
                  <li><FiCheckCircle /> Hands-on experience through live coding sessions</li>
                  <li><FiCheckCircle /> Network with other learners and professionals</li>
                  {bootcamp.enable_certificate && (
                    <li><FiCheckCircle /> Earn a verifiable certificate of completion</li>
                  )}
                </>
              )}
            </ul>

            {/* Instructor */}
            <div className="lbd-instructor-section">
              <span className="lbd-section-label">Your Instructor</span>
              <h2 className="lbd-section-title">Why Learn From {bootcamp.instructor_name.split(' ')[0]}?</h2>
              <div className="lbd-instructor-card">
                <img
                  src={resolveImageUrl(bootcamp.instructor_image) || `https://ui-avatars.com/api/?name=${encodeURIComponent(bootcamp.instructor_name)}&size=200&background=e0f2fe&color=008ad1&bold=true&font-size=0.4`}
                  alt={bootcamp.instructor_name}
                  className="lbd-instructor-avatar"
                />
                <div className="lbd-instructor-info">
                  {bootcamp.instructor_bio ? (
                    <>
                      {bootcamp.instructor_bio.split('\n').filter(p => p.trim()).map((para, i) => (
                        <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                      ))}
                    </>
                  ) : (
                    <>
                      <p>Hi! I'm <strong>{bootcamp.instructor_name}</strong>, a passionate educator and industry professional dedicated to helping learners grow their skills.</p>
                      <p>My teaching style is simple: <strong>practical, structured, and easy to follow.</strong> Every session is designed to give you real-world knowledge you can apply immediately.</p>
                      <p>When you attend my bootcamp, you don't just learn concepts — <strong>you learn how to think like a professional.</strong></p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="lbd-sidebar animate-fade">
            <div className="lbd-sidebar-card">
              <div className="lbd-sidebar-card-header">
                {(() => {
                  const fp = calculateFinalPrice();
                  if (bootcamp.price <= 0) return <span className="lbd-sidebar-price"><span className="free-label">Free</span></span>;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span className="lbd-sidebar-price">₹{fp}</span>
                      {couponApplied && fp < bootcamp.price && (
                        <>
                          <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '1.1rem' }}>₹{bootcamp.price}</span>
                          <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {couponApplied.discount_type === 'percentage' ? `${couponApplied.discount_value}% OFF` : `₹${couponApplied.discount_value} OFF`}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="lbd-sidebar-card-body">
                <div className="lbd-sidebar-actions">
                  {/* Coupon */}
                  {!isEnrolled && status !== 'completed' && bootcamp.price > 0 && (
                    <div className="lbd-coupon">
                      <input
                        type="text"
                        placeholder="Enter coupon code"
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                        disabled={!!couponApplied}
                      />
                      <button
                        className="btn lbd-btn-outline"
                        onClick={applyCoupon}
                        disabled={!!couponApplied}
                        style={{ whiteSpace: 'nowrap', padding: '8px 14px', fontSize: '0.82rem' }}
                      >
                        <FiTag /> {couponApplied ? 'Applied' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {couponApplied && (
                    <p style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, margin: '0 0 4px 0', textAlign: 'center' }}>
                      Coupon {couponApplied.code} applied successfully!
                    </p>
                  )}

                  {/* Enroll Button */}
                  {!isEnrolled && status !== 'completed' && (
                    <button className="btn lbd-btn-primary" onClick={handleRegister} disabled={registering}>
                      {registering ? 'Processing...' : (() => {
                        const fp = calculateFinalPrice();
                        if (bootcamp.price <= 0 || fp <= 0) return 'Enroll for Free';
                        return `Enroll - ₹${fp}`;
                      })()}
                    </button>
                  )}

                  {/* Join Live */}
                  {isEnrolled && !isCompleted && (status === 'upcoming' || status === 'active') && (
                    <button className="btn lbd-btn-primary" onClick={handleJoinLive}>
                      <FiExternalLink /> Join Live Session
                    </button>
                  )}

                  {isCompleted && bootcamp.enable_certificate && (
                    <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280', margin: '16px 0 0 0', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <FiAward style={{ marginRight: 6, verticalAlign: 'middle', color: '#008ad1' }} />
                      Certificate will be available in your <Link to="/student-dashboard" style={{ color: '#008ad1', fontWeight: 600, textDecoration: 'none' }}>Dashboard</Link> once issued by the Admin.
                    </p>
                  )}

                  {isEnrolled && (
                    <span style={{ textAlign: 'center', fontSize: '0.8rem', color: '#008ad1', fontWeight: 600 }}>
                      <FiCheckCircle style={{ marginRight: 4 }} /> You are enrolled
                    </span>
                  )}
                  {!isEnrolled && status === 'completed' && (
                    <span style={{ textAlign: 'center', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 600 }}>
                      This bootcamp has ended
                    </span>
                  )}
                </div>

                {/* Highlights */}
                <div className="lbd-highlights">
                  <h4>Bootcamp Highlights</h4>
                  <ul className="lbd-highlights-list">
                    <li><FiCalendar /> {formatShortDate(bootcamp.start_date)} - {formatShortDate(bootcamp.end_date)}</li>
                    <li><FiClock /> {bootcamp.total_sessions} Live Sessions</li>
                    {bootcamp.schedule_info && <li><FiTarget /> {bootcamp.schedule_info}</li>}
                    <li><FiMapPin /> Online Bootcamp</li>
                    <li><FiUser /> {bootcamp.instructor_name}</li>
                    {bootcamp.enable_certificate && (
                      <li><FiAward /> Certificate of Completion</li>
                    )}
                    {bootcamp.max_students && (
                      <li><FiUsers /> Limited to {bootcamp.max_students} students</li>
                    )}
                  </ul>
                </div>

                {/* Help */}
                <div className="lbd-sidebar-help">
                  <p>Have questions about this bootcamp?</p>
                  <a href="https://api.whatsapp.com/message/E5OKPXTRFRD5E1?autoload=1&app_absent=0" target="_blank" rel="noreferrer">
                    <FiMessageCircle /> Contact Support
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Certificate Modal */}
      {activeCert && (
        <Certificate certificateData={activeCert} onClose={() => setActiveCert(null)} />
      )}
    </div>
  );
}
