import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiAward, FiExternalLink, FiCheckCircle, FiUsers, FiBookOpen } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import Certificate from '../components/ui/Certificate';
import { resolveImageUrl } from '../utils/imageUtils';
import './LiveBootcamps.css';

export default function LiveBootcamps() {
  const { user, profile } = useAuth();
  const { showAlert } = useAlert();
  const [bootcamps, setBootcamps] = useState([]);
  const [enrollments, setEnrollments] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [activeCert, setActiveCert] = useState(null);
  const [registering, setRegistering] = useState(null);

  useEffect(() => {
    fetchBootcamps();
  }, [user]);

  const fetchBootcamps = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('live_bootcamps')
        .select('*')
        .order('start_date', { ascending: false });

      if (error) throw error;
      setBootcamps(data || []);

      if (user) {
        const { data: enrollData } = await supabase
          .from('live_bootcamp_enrollments')
          .select('*')
          .eq('user_id', user.id);

        const enrollMap = {};
        (enrollData || []).forEach(e => { enrollMap[e.live_bootcamp_id] = e; });
        setEnrollments(enrollMap);
      }
    } catch (err) {
      console.error('Error fetching live bootcamps:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (bootcamp) => {
    if (!user) {
      await showAlert('Please log in to register for this bootcamp.', 'Login Required', 'info');
      return;
    }

    setRegistering(bootcamp.id);
    try {
      if (bootcamp.price > 0) {
        const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError) {
          await showAlert('Your session has expired. Please log in again.', 'Session Expired', 'info');
          setRegistering(null);
          return;
        }

        const { data: orderData, error: orderError } = await supabase.functions.invoke('create-razorpay-order', {
          body: { live_bootcamp_id: bootcamp.id, amount: bootcamp.price * 100 }
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

              const { data: enrollData } = await supabase.from('live_bootcamp_enrollments').insert([{
                user_id: user.id,
                live_bootcamp_id: bootcamp.id,
                registered: true,
                payment_id: response.razorpay_payment_id,
                amount_paid: bootcamp.price
              }]).select().single();

              setEnrollments(prev => ({ ...prev, [bootcamp.id]: enrollData || { registered: true } }));
              await showAlert('Payment successful! You are enrolled.', 'Success', 'success', { celebrate: true });
            } catch (err) {
              await showAlert(err.message || 'Payment verification failed.', 'Error', 'error');
            } finally {
              setRegistering(null);
            }
          },
          prefill: { name: profile?.name || 'Student', email: user.email },
          theme: { color: '#008ad1' }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', async (response) => {
          await showAlert(`Payment Failed: ${response.error.description}`, 'Error', 'error');
          setRegistering(null);
        });
        rzp.open();
        return;
      }

      // Free bootcamp
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
        setEnrollments(prev => ({ ...prev, [bootcamp.id]: enrollData }));
        await showAlert('You have been enrolled successfully!', 'Enrolled', 'success', { celebrate: true });
      }
    } catch (err) {
      let msg = 'Registration failed.';
      if (err.context && typeof err.context.json === 'function') {
        try { const body = await err.context.json(); msg = body.error || msg; } catch {}
      } else if (err.message) msg = err.message;
      await showAlert(msg, 'Error', 'error');
    } finally {
      setRegistering(null);
    }
  };

  const getBootcampStatus = (bc) => {
    const now = new Date();
    const startDate = new Date(bc.start_date);
    const endDate = new Date(bc.end_date);
    if (bc.status === 'completed' || now > endDate) return 'completed';
    if (bc.status === 'active' || (now >= startDate && now <= endDate)) return 'active';
    return 'upcoming';
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const filteredBootcamps = bootcamps.filter(bc => {
    if (filter === 'all') return true;
    return getBootcampStatus(bc) === filter;
  });



  if (loading) return (
    <div className="container section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '20px' }}>
      <div className="spinner" style={{ width: 48, height: 48, border: '4px solid var(--gray-200)', borderTopColor: '#008ad1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <h2 style={{ color: '#008ad1', fontWeight: 700 }}>Loading Bootcamps...</h2>
    </div>
  );

  return (
    <div className="live-bootcamps-page section">
      <div className="container">
        {/* Hero */}
        <div className="lb-hero animate-fade">
          <span className="lb-hero-label">Online Bootcamp</span>
          <h1>Bootcamps</h1>
          <p>Master in-demand skills with intensive, instructor-led live sessions. Get certified and job-ready.</p>

        </div>

        {/* Filters */}
        <div className="lb-filters">
          {[
            { key: 'all', label: 'All Bootcamps' },
            { key: 'upcoming', label: 'Upcoming' },
            { key: 'active', label: 'Active Now' },
            { key: 'completed', label: 'Past Bootcamps' },
          ].map(f => (
            <button
              key={f.key}
              className={`lb-filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filteredBootcamps.length === 0 ? (
          <div className="lb-empty">
            <FiBookOpen />
            <h3>No bootcamps found</h3>
            <p>{filter === 'all' ? 'Check back soon for upcoming live bootcamps!' : `No ${filter} bootcamps at the moment.`}</p>
          </div>
        ) : (
          <div className="lb-grid">
            {filteredBootcamps.map(bc => {
              const status = getBootcampStatus(bc);
              const enroll = enrollments[bc.id];
              const isEnrolled = enroll?.registered;
              const isCompleted = enroll?.completed;

              return (
                <Link to={`/live-bootcamps/${bc.id}`} key={bc.id} className="lb-card animate-fade" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div className="lb-card-img-wrap">
                    <img
                      src={resolveImageUrl(bc.thumbnail_url) || 'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&q=80&w=800'}
                      alt={bc.title}
                    />
                    <div className="lb-card-badges">
                      <span className={`lb-status-badge ${status}`}>
                        {status === 'active' ? 'Active Now' : status === 'upcoming' ? 'Upcoming' : 'Completed'}
                      </span>
                      <span className={`lb-price-badge ${bc.price <= 0 ? 'free' : ''}`}>
                        {bc.price > 0 ? `₹${bc.price}` : 'Free'}
                      </span>
                    </div>
                  </div>
                  <div className="lb-card-body">
                    <div className="lb-card-meta">
                      <span><FiCalendar /> {formatDate(bc.start_date)} - {formatDate(bc.end_date)}</span>
                      <span><FiClock /> {bc.total_sessions} Sessions</span>
                    </div>
                    <h3>{bc.title}</h3>
                    <p className="lb-desc">{bc.description || 'Master in-demand skills with live instructor-led sessions.'}</p>
                    {bc.schedule_info && (
                      <p className="lb-schedule"><FiClock style={{ marginRight: 4 }} /> {bc.schedule_info}</p>
                    )}
                  </div>
                  <div className="lb-card-footer">
                    {bc.enable_certificate && (
                      <span className="lb-cert-badge"><FiAward /> Certificate</span>
                    )}
                    <div style={{ marginLeft: 'auto' }}>
                      {!isEnrolled && status !== 'completed' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={(e) => { e.preventDefault(); handleRegister(bc); }}
                          disabled={registering === bc.id}
                        >
                          {registering === bc.id ? 'Processing...' : bc.price > 0 ? `₹${bc.price}` : 'Enroll Free'}
                        </button>
                      )}
                      {isEnrolled && (
                        <span style={{ fontSize: '0.8rem', color: '#008ad1', fontWeight: 700 }}>
                          <FiCheckCircle style={{ marginRight: 4 }} /> Enrolled
                        </span>
                      )}
                      {!isEnrolled && status === 'completed' && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--gray-400)', fontWeight: 600 }}>Ended</span>
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
