import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiUser, FiVideo, FiAward, FiDownload, FiExternalLink, FiCheckCircle, FiXCircle, FiUsers, FiMapPin, FiMessageCircle, FiChevronRight, FiTag } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import Certificate from '../components/ui/Certificate';
import { resolveImageUrl } from '../utils/imageUtils';
import './EventDetail.css';
import Loader from '../components/ui/Loader';


export default function EventDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const { showAlert } = useAlert();
  const [event, setEvent] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [activeCert, setActiveCert] = useState(null);
  const [coupon, setCoupon] = useState('');
  const [couponApplied, setCouponApplied] = useState(null);

  useEffect(() => {
    fetchEvent();
  }, [id, user]);

  const fetchEvent = async () => {
    setLoading(true);
    try {
      const { data: eventData, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setEvent(eventData);

      if (user) {
        const { data: attData } = await supabase
          .from('event_attendance')
          .select('*')
          .eq('user_id', user.id)
          .eq('event_id', id)
          .maybeSingle();

        setAttendance(attData || null);
      }
    } catch (err) {
      console.error('Error fetching event:', err);
    } finally {
      setLoading(false);
    }
  };

  const getEventStatus = () => {
    if (!event) return 'upcoming';
    const now = new Date();
    const eventDate = new Date(event.event_date);
    const endDate = new Date(eventDate.getTime() + (event.duration_minutes || 60) * 60000);
    if (event.status === 'completed' || now > endDate) return 'completed';
    if (event.status === 'live' || (now >= eventDate && now <= endDate)) return 'live';
    return 'upcoming';
  };

  // Coupon logic
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
      // If coupon is course-specific, it can't be used for events
      if (data.course_id) {
        await showAlert('This coupon is not applicable to events.', 'Not Applicable', 'error');
        return;
      }
      // If coupon is event-specific, check it matches this event
      if (data.event_id && data.event_id !== id) {
        await showAlert('This coupon is not applicable to this event.', 'Not Applicable', 'error');
        return;
      }
      setCouponApplied(data);
      await showAlert(`Coupon ${data.code} applied!`, 'Success', 'success', { celebrate: true });
    } catch (err) {
      await showAlert('Could not apply coupon.', 'Error', 'error');
    }
  };

  const calculateFinalPrice = () => {
    if (!event || event.price <= 0) return 0;
    const basePrice = event.price;
    if (!couponApplied) return basePrice;
    if (couponApplied.discount_type === 'percentage') {
      return Math.max(0, Math.round(basePrice * (1 - couponApplied.discount_value / 100)));
    } else {
      return Math.max(0, basePrice - couponApplied.discount_value);
    }
  };

  const handleRegister = async () => {
    if (!user) {
      await showAlert('Please log in to register for this event.', 'Login Required', 'info');
      return;
    }
    setRegistering(true);
    try {
      const finalPrice = calculateFinalPrice();

      if (finalPrice > 0) {
        // Paid event — Razorpay flow
        const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError || !sessionData?.session) {
          await showAlert('Your session has expired. Please log in again.', 'Session Expired', 'info');
          setRegistering(false);
          return;
        }

        const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
          body: { event_id: event.id, amount: finalPrice * 100 }
        });

        if (orderError) throw orderError;
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
          description: `Register for ${event.title}`,
          image: '/favicon.png',
          order_id: orderData.id,
          handler: async function (response) {
            try {
              const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
                body: {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                  event_id: event.id,
                  amount: orderData.amount
                }
              });
              if (verifyError) throw verifyError;
              if (verifyData?.error) throw new Error(verifyData.error);

              // Increment coupon usage
              if (couponApplied) {
                await supabase.from('coupons').update({ used_count: (couponApplied.used_count || 0) + 1 }).eq('id', couponApplied.id);
              }

              const { data: attData } = await supabase.from('event_attendance').insert([{
                user_id: user.id,
                event_id: event.id,
                registered: true,
                payment_id: response.razorpay_payment_id,
                amount_paid: finalPrice
              }]).select().single();

              setAttendance(attData || { registered: true });
              await showAlert('Payment successful! You are registered.', 'Success', 'success', { celebrate: true });
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

      // Free event (or 100% coupon discount)
      // Increment coupon usage if applied
      if (couponApplied) {
        await supabase.from('coupons').update({ used_count: (couponApplied.used_count || 0) + 1 }).eq('id', couponApplied.id);
      }

      const { data: attData, error: attError } = await supabase.from('event_attendance').insert([{
        user_id: user.id,
        event_id: event.id,
        registered: true,
        amount_paid: 0
      }]).select().single();

      if (attError) {
        if (attError.code === '23505') {
          await showAlert('You are already registered.', 'Already Registered', 'info');
        } else throw attError;
      } else {
        setAttendance(attData);
        await showAlert('You have been registered!', 'Success', 'success', { celebrate: true });
      }
    } catch (err) {
      let msg = 'Registration failed.';
      if (err.context && typeof err.context.json === 'function') {
        try { const body = await err.context.json(); msg = body.error || msg; } catch {}
      } else if (err.message) msg = err.message;
      await showAlert(msg, 'Error', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleJoinLive = async () => {
    if (!attendance?.registered) return;
    try {
      await supabase.from('event_attendance')
        .update({ attended: true, join_time: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('event_id', event.id);
      setAttendance(prev => ({ ...prev, attended: true, join_time: new Date().toISOString() }));
      if (event.live_link) window.open(event.live_link, '_blank');
    } catch (err) {
      console.error('Error joining:', err);
    }
  };



  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;

  if (!event) return (
    <div className="container section" style={{ textAlign: 'center', padding: '80px 20px' }}>
      <h2>Event not found</h2>
      <Link to="/events" className="btn btn-primary btn-md" style={{ marginTop: 16 }}>Browse Events</Link>
    </div>
  );

  const status = getEventStatus();
  const isRegistered = attendance?.registered;
  const isAttended = attendance?.attended;

  return (
    <div className="event-detail">
      {/* Header */}
      <div className="ed-header">
        <div className="container">
          <nav className="ed-breadcrumb animate-fade">
            <Link to="/">Home</Link>
            <FiChevronRight />
            <Link to="/events">Events</Link>
            <FiChevronRight />
            <span>{event.title}</span>
          </nav>

          <div className="ed-header-grid">
            <div className="ed-header-content animate-fade">
              <div className="ed-header-badges">
                <span className="ed-badge"><FiVideo /> Online Event</span>
                {status === 'live' && <span className="ed-badge live">Live Now</span>}
                {status === 'upcoming' && <span className="ed-badge">Upcoming</span>}
                {status === 'completed' && <span className="ed-badge">Completed</span>}
                {event.enable_certificate && <span className="ed-badge cert"><FiAward /> Certificate</span>}
              </div>

              <h1>{event.title}</h1>
              <p className="ed-header-desc">{event.description || 'Join us for this exciting live session with industry experts.'}</p>

              <div className="ed-header-meta">
                <div className="ed-header-meta-item">
                  <FiCalendar /> {formatDate(event.event_date)}
                </div>
                <div className="ed-header-meta-item">
                  <FiClock /> {formatTime(event.event_date)}
                </div>
                <div className="ed-header-meta-item">
                  <FiUser /> {event.instructor_name}
                </div>
              </div>
            </div>

            {/* Media */}
            <div className="ed-media animate-fade">
              <img
                src={resolveImageUrl(event.thumbnail_url) || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800'}
                alt={event.title}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Body — 2-column */}
      <div className="container">
        <div className="ed-body">
          {/* Main Content */}
          <div className="ed-main animate-fade">
            {/* Attendance Status */}
            {isAttended && event.enable_certificate && (
              <div className="ed-attendance-banner attended">
                <FiCheckCircle />
                <div>
                  <span>You attended this event</span>
                  <span className="sub-text">Certificate available for download</span>
                </div>
              </div>
            )}
            {isAttended && !event.enable_certificate && (
              <div className="ed-attendance-banner attended">
                <FiCheckCircle />
                <span>You attended this event</span>
              </div>
            )}
            {isRegistered && status === 'completed' && !isAttended && (
              <div className="ed-attendance-banner not-attended">
                <FiXCircle />
                <div>
                  <span>Certificate not available</span>
                  <span className="sub-text">You did not attend this event</span>
                </div>
              </div>
            )}

            {/* About */}
            <span className="ed-section-label">Overview</span>
            <h2 className="ed-section-title">About This Event</h2>
            <div className="ed-about-text">
              {event.description || 'Join us for this exciting live session. Learn from industry experts and gain practical knowledge that you can apply immediately.'}
            </div>

            {/* What You'll Achieve */}
            <span className="ed-section-label">By the End of This Event</span>
            <h2 className="ed-section-title">What You'll Achieve</h2>
            <ul className="ed-achieve-list">
              <li><FiCheckCircle /> Gain practical knowledge from industry experts</li>
              <li><FiCheckCircle /> Learn hands-on skills you can apply immediately</li>
              <li><FiCheckCircle /> Network with other learners and professionals</li>
              {event.enable_certificate && (
                <li><FiCheckCircle /> Earn a verifiable certificate of attendance</li>
              )}
            </ul>

            {/* Instructor */}
            <div className="ed-instructor-section">
              <span className="ed-section-label">Your Instructor</span>
              <h2 className="ed-section-title">Why Learn From {event.instructor_name.split(' ')[0]}?</h2>
              <div className="ed-instructor-card">
                <img
                  src={resolveImageUrl(event.instructor_image) || `https://ui-avatars.com/api/?name=${encodeURIComponent(event.instructor_name)}&size=200&background=e0f2fe&color=008ad1&bold=true&font-size=0.4`}
                  alt={event.instructor_name}
                  className="ed-instructor-avatar"
                />
                <div className="ed-instructor-info">
                  {event.instructor_bio ? (
                    <>
                      {event.instructor_bio.split('\n').filter(p => p.trim()).map((para, i) => (
                        <p key={i} dangerouslySetInnerHTML={{ __html: para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                      ))}
                    </>
                  ) : (
                    <>
                      <p>Hi! I'm <strong>{event.instructor_name}</strong>, a passionate educator and industry professional dedicated to helping learners grow their skills.</p>
                      <p>My teaching style is simple: <strong>practical, structured, and easy to follow.</strong> Every session is designed to give you real-world knowledge you can apply immediately.</p>
                      <p>When you attend my sessions, you don't just learn concepts — <strong>you learn how to think like a professional.</strong></p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="ed-sidebar animate-fade">
            <div className="ed-sidebar-card">
              <div className="ed-sidebar-card-header">
                {(() => {
                  const fp = calculateFinalPrice();
                  if (event.price <= 0) return <span className="ed-sidebar-price"><span className="free-label">Free</span></span>;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span className="ed-sidebar-price">₹{fp}</span>
                      {couponApplied && fp < event.price && (
                        <>
                          <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontSize: '1.1rem' }}>₹{event.price}</span>
                          <span style={{ background: '#dcfce7', color: '#15803d', padding: '2px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700 }}>
                            {couponApplied.discount_type === 'percentage' ? `${couponApplied.discount_value}% OFF` : `₹${couponApplied.discount_value} OFF`}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              <div className="ed-sidebar-card-body">
                <div className="ed-sidebar-actions">
                  {!isRegistered && status !== 'completed' && event.price > 0 && (
                    <div className="ed-coupon">
                      <input
                        type="text"
                        placeholder="Enter coupon code"
                        value={coupon}
                        onChange={(e) => setCoupon(e.target.value)}
                        disabled={!!couponApplied}
                      />
                      <button
                        className="btn ed-btn-outline"
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
                  {!isRegistered && status !== 'completed' && (
                    <button className="btn ed-btn-primary" onClick={handleRegister} disabled={registering}>
                      {registering ? 'Processing...' : (() => {
                        const fp = calculateFinalPrice();
                        if (event.price <= 0 || fp <= 0) return 'Register for Free';
                        return `Register - ₹${fp}`;
                      })()}
                    </button>
                  )}
                  {isRegistered && !isAttended && (status === 'upcoming' || status === 'live') && (
                    <button className="btn ed-btn-primary" onClick={handleJoinLive}>
                      <FiExternalLink /> Join Live Session
                    </button>
                  )}
                  {isAttended && event.enable_certificate && !attendance?.certificate_issued && (
                    <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280', margin: '16px 0 0 0', padding: '12px', background: '#f9fafb', borderRadius: '8px' }}>
                      <FiAward style={{ marginRight: 6, verticalAlign: 'middle', color: '#008ad1' }} />
                      Certificate will be available in your <Link to="/student-dashboard" style={{ color: '#008ad1', fontWeight: 600, textDecoration: 'none' }}>Dashboard</Link> once issued by the Admin.
                    </p>
                  )}
                  {isAttended && event.enable_certificate && attendance?.certificate_issued && (
                    <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#059669', margin: '16px 0 0 0', padding: '12px', background: '#dcfce7', borderRadius: '8px', fontWeight: 500 }}>
                      <FiAward style={{ marginRight: 6, verticalAlign: 'middle', color: '#059669' }} />
                      Certificate has been issued! View it in your <Link to="/student-dashboard" style={{ color: '#059669', fontWeight: 600, textDecoration: 'underline' }}>Dashboard</Link>.
                    </p>
                  )}
                  {isRegistered && (
                    <span style={{ textAlign: 'center', fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                      <FiCheckCircle style={{ marginRight: 4 }} /> You are registered
                    </span>
                  )}
                  {!isRegistered && status === 'completed' && (
                    <span style={{ textAlign: 'center', fontSize: '0.85rem', color: '#9ca3af', fontWeight: 600 }}>
                      This event has ended
                    </span>
                  )}
                </div>

                {/* Event Highlights */}
                <div className="ed-highlights">
                  <h4>Event Highlights</h4>
                  <ul className="ed-highlights-list">
                    <li><FiCalendar /> {formatDate(event.event_date)}</li>
                    <li><FiClock /> {event.duration_minutes} minutes</li>
                    <li><FiMapPin /> Online Event</li>
                    <li><FiUser /> {event.instructor_name}</li>
                    {event.enable_certificate && (
                      <li><FiAward /> Certificate of Attendance</li>
                    )}
                  </ul>
                </div>

                {/* Help */}
                <div className="ed-sidebar-help">
                  <p>Have questions about this event?</p>
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
