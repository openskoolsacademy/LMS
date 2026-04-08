import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiAward, FiDownload, FiExternalLink, FiCheckCircle } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import Certificate from '../components/ui/Certificate';
import { resolveImageUrl } from '../utils/imageUtils';
import './Events.css';
import Loader from '../components/ui/Loader';


export default function Events() {
  const { user, profile } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState({}); // { eventId: attendanceRecord }
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [activeCert, setActiveCert] = useState(null);
  const [registering, setRegistering] = useState(null); // eventId being registered

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data: eventsData, error } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: false });

      if (error) throw error;
      setEvents(eventsData || []);

      // Fetch attendance for logged-in user
      if (user) {
        const { data: attData } = await supabase
          .from('event_attendance')
          .select('*')
          .eq('user_id', user.id);

        const attMap = {};
        (attData || []).forEach(a => { attMap[a.event_id] = a; });
        setAttendance(attMap);
      }
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event) => {
    if (!user) {
      await showAlert('Please log in to register for events.', 'Login Required', 'info');
      return;
    }

    setRegistering(event.id);

    try {
      if (event.price > 0) {
        // Paid event — Razorpay flow
        const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError) {
          await showAlert('Your session has expired. Please log in again.', 'Session Expired', 'info');
          setRegistering(null);
          return;
        }

        const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
          body: { event_id: event.id, amount: event.price * 100 }
        });

        if (orderError) throw orderError;
        if (orderData?.error) throw new Error(orderData.error);
        if (!orderData?.id || !orderData?.amount) throw new Error('Invalid order response from server.');

        if (typeof window.Razorpay === 'undefined') {
          throw new Error('Razorpay SDK not loaded. Please check your internet connection.');
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

              // Insert attendance record
              const { data: attData, error: attError } = await supabase.from('event_attendance').insert([{
                user_id: user.id,
                event_id: event.id,
                registered: true,
                payment_id: response.razorpay_payment_id,
                amount_paid: event.price
              }]).select().single();

              if (attError && attError.code !== '23505') throw attError;

              setAttendance(prev => ({ ...prev, [event.id]: attData || { registered: true, event_id: event.id } }));
              await showAlert('Payment successful! You are registered.', 'Success', 'success');
            } catch (err) {
              console.error('Payment verification failed:', err);
              await showAlert(err.message || 'Payment verification failed.', 'Error', 'error');
            } finally {
              setRegistering(null);
            }
          },
          prefill: {
            name: profile?.name || user?.user_metadata?.name || 'Student',
            email: user.email,
          },
          theme: { color: '#008ad1' }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async (response) => {
          await showAlert(`Payment Failed: ${response.error.description}`, 'Error', 'error');
          setRegistering(null);
        });
        rzp.open();
        return; // Don't set registering to null — Razorpay handler will
      }

      // Free event — direct registration
      const { data: attData, error: attError } = await supabase.from('event_attendance').insert([{
        user_id: user.id,
        event_id: event.id,
        registered: true,
        amount_paid: 0
      }]).select().single();

      if (attError) {
        if (attError.code === '23505') {
          await showAlert('You are already registered for this event.', 'Already Registered', 'info');
        } else {
          throw attError;
        }
      } else {
        setAttendance(prev => ({ ...prev, [event.id]: attData }));
        await showAlert('You have been registered successfully!', 'Registered', 'success');
      }
    } catch (err) {
      console.error('Registration error:', err);
      let msg = 'Failed to register.';
      if (err.context && typeof err.context.json === 'function') {
        try { const body = await err.context.json(); msg = body.error || msg; } catch {}
      } else if (err.message) { msg = err.message; }
      await showAlert(msg, 'Registration Error', 'error');
    } finally {
      setRegistering(null);
    }
  };

  const handleJoinLive = async (event) => {
    if (!user) {
      await showAlert('Please log in to join events.', 'Login Required', 'info');
      return;
    }

    const att = attendance[event.id];
    if (!att?.registered) {
      await showAlert('Please register for this event first.', 'Not Registered', 'info');
      return;
    }

    try {
      // Mark attendance
      await supabase.from('event_attendance')
        .update({ attended: true, join_time: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('event_id', event.id);

      setAttendance(prev => ({
        ...prev,
        [event.id]: { ...prev[event.id], attended: true, join_time: new Date().toISOString() }
      }));

      // Open live link
      if (event.live_link) {
        window.open(event.live_link, '_blank');
      }
    } catch (err) {
      console.error('Error joining event:', err);
    }
  };

  const handleDownloadCertificate = async (event) => {
    try {
      const { createEventCertificate } = await import('../utils/certificateLogUtils');
      const certRecord = await createEventCertificate(
        user, event.id, event.title, event.instructor_name, profile?.name
      );

      setActiveCert({
        id: certRecord.certificate_id,
        studentName: profile?.name || user.email,
        courseTitle: event.title,
        issuedAt: certRecord.issued_at,
        certificateType: 'live'
      });
    } catch (err) {
      console.error('Certificate generation error:', err);
      await showAlert('Error generating certificate.', 'Certificate Error', 'error');
    }
  };

  const getEventStatus = (event) => {
    const now = new Date();
    const eventDate = new Date(event.event_date);
    const endDate = new Date(eventDate.getTime() + (event.duration_minutes || 60) * 60000);

    if (event.status === 'completed' || now > endDate) return 'completed';
    if (event.status === 'live' || (now >= eventDate && now <= endDate)) return 'live';
    return 'upcoming';
  };

  const formatEventDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatEventTime = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true;
    return getEventStatus(e) === filter;
  });



  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;

  return (
    <div className="events-page section">
      <div className="container">
        {/* Hero */}
        <div className="events-hero animate-fade">
          <h1>Live Events & Webinars</h1>
          <p>Join interactive live sessions, earn certificates, and grow your skills with industry experts.</p>

        </div>

        {/* Filters */}
        <div className="events-filters">
          {[
            { key: 'all', label: 'All Events' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'live', label: 'Live Now' },
            { key: 'completed', label: 'Past Events' },
          ].map(f => (
            <button
              key={f.key}
              className={`events-filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Events Grid */}
        {filteredEvents.length === 0 ? (
          <div className="events-empty">
            <FiCalendar />
            <h3>No events found</h3>
            <p>{filter === 'all' ? 'Check back soon for upcoming events!' : `No ${filter} events at the moment.`}</p>
          </div>
        ) : (
          <div className="events-grid">
            {filteredEvents.map(event => {
              const status = getEventStatus(event);
              const att = attendance[event.id];
              const isRegistered = att?.registered;
              const isAttended = att?.attended;

              return (
                <Link to={`/events/${event.id}`} key={event.id} className="event-card animate-fade" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="event-card-img-wrap">
                    <img
                      src={resolveImageUrl(event.thumbnail_url) || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=800'}
                      alt={event.title}
                    />
                    <div className="event-card-badges">
                      <span className={`event-status-badge ${status}`}>
                        {status === 'live' ? 'Live Now' : status === 'upcoming' ? 'Upcoming' : 'Completed'}
                      </span>
                      <span className={`event-price-badge ${event.price <= 0 ? 'free' : ''}`}>
                        {event.price > 0 ? `₹${event.price}` : 'Free'}
                      </span>
                    </div>
                  </div>
                  <div className="event-card-body">
                    <div className="event-card-meta">
                      <span><FiCalendar /> {formatEventDate(event.event_date)}</span>
                      <span><FiClock /> {event.duration_minutes} min</span>
                    </div>
                    <h3>{event.title}</h3>
                    <p className="event-desc">{event.description || 'Join us for this exciting live session!'}</p>
                  </div>
                  <div className="event-card-footer">
                    {event.enable_certificate && (
                      <span className="event-cert-badge"><FiAward /> Certificate</span>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      {!isRegistered && status !== 'completed' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={(e) => { e.preventDefault(); handleRegister(event); }}
                          disabled={registering === event.id}
                        >
                          {registering === event.id ? 'Processing...' : event.price > 0 ? `₹${event.price}` : 'Register Free'}
                        </button>
                      )}
                      {isRegistered && !isAttended && (status === 'upcoming' || status === 'live') && (
                        <button className="btn btn-primary btn-sm" onClick={(e) => { e.preventDefault(); handleJoinLive(event); }}>
                          <FiExternalLink style={{ marginRight: 4 }} /> Join
                        </button>
                      )}
                      {isAttended && event.enable_certificate && (
                        <span style={{ fontSize: '0.8rem', color: '#008ad1', fontWeight: 700 }}><FiCheckCircle style={{ marginRight: 4 }} /> Attended</span>
                      )}
                      {isRegistered && status === 'completed' && !isAttended && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)', fontWeight: 600 }}>Ended</span>
                      )}
                      {isRegistered && isAttended && !event.enable_certificate && (
                        <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Attended</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>


      {/* Certificate Modal */}
      {activeCert && (
        <Certificate certificateData={activeCert} onClose={() => setActiveCert(null)} />
      )}
    </div>
  );
}
