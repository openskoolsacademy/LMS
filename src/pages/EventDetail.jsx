import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiUser, FiVideo, FiAward, FiDownload, FiExternalLink, FiCheckCircle, FiXCircle, FiUsers, FiMapPin, FiMessageCircle, FiChevronRight } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import Certificate from '../components/ui/Certificate';
import './EventDetail.css';

export default function EventDetail() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const { showAlert } = useAlert();
  const [event, setEvent] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [activeCert, setActiveCert] = useState(null);

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

  const handleRegister = async () => {
    if (!user) {
      await showAlert('Please log in to register for this event.', 'Login Required', 'info');
      return;
    }
    setRegistering(true);
    try {
      if (event.price > 0) {
        // Paid event — Razorpay flow
        const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError || !sessionData?.session) {
          await showAlert('Your session has expired. Please log in again.', 'Session Expired', 'info');
          setRegistering(false);
          return;
        }

        const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
          body: { event_id: event.id, amount: event.price * 100 }
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

              const { data: attData } = await supabase.from('event_attendance').insert([{
                user_id: user.id,
                event_id: event.id,
                registered: true,
                payment_id: response.razorpay_payment_id,
                amount_paid: event.price
              }]).select().single();

              setAttendance(attData || { registered: true });
              await showAlert('Payment successful! You are registered.', 'Success', 'success');
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

      // Free event
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
        await showAlert('You have been registered!', 'Success', 'success');
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

  const handleDownloadCert = async () => {
    try {
      const { createEventCertificate } = await import('../utils/certificateLogUtils');
      const certRecord = await createEventCertificate(user, event.id, event.title, event.instructor_name, profile?.name);
      setActiveCert({
        id: certRecord.certificate_id,
        studentName: profile?.name || user.email,
        courseTitle: event.title,
        issuedAt: certRecord.issued_at,
        certificateType: 'live'
      });
    } catch (err) {
      await showAlert('Error generating certificate.', 'Error', 'error');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formatTime = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div className="container section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px' }}>
      <div className="spinner" style={{ width: 48, height: 48, border: '4px solid var(--gray-200)', borderTopColor: '#008ad1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <h2 style={{ color: '#008ad1', fontWeight: 700 }}>Loading Event...</h2>
    </div>
  );

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
                src={event.thumbnail_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800'}
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
                  src={event.instructor_image || `https://ui-avatars.com/api/?name=${encodeURIComponent(event.instructor_name)}&size=200&background=e0f2fe&color=008ad1&bold=true&font-size=0.4`}
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
                {event.price > 0 ? (
                  <span className="ed-sidebar-price">₹{event.price}</span>
                ) : (
                  <span className="ed-sidebar-price"><span className="free-label">Free</span></span>
                )}
              </div>
              <div className="ed-sidebar-card-body">
                <div className="ed-sidebar-actions">
                  {!isRegistered && status !== 'completed' && (
                    <button className="btn ed-btn-primary" onClick={handleRegister} disabled={registering}>
                      {registering ? 'Processing...' : event.price > 0 ? `Register - ₹${event.price}` : 'Register for Free'}
                    </button>
                  )}
                  {isRegistered && !isAttended && (status === 'upcoming' || status === 'live') && (
                    <button className="btn ed-btn-primary" onClick={handleJoinLive}>
                      <FiExternalLink /> Join Live Session
                    </button>
                  )}
                  {isAttended && event.enable_certificate && (
                    <button className="btn ed-btn-cert" onClick={handleDownloadCert}>
                      <FiDownload /> Download Certificate
                    </button>
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
                  <a href="https://wa.me/919361166523" target="_blank" rel="noreferrer">
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
