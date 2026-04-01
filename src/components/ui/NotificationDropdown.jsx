import { useState, useRef, useEffect } from 'react';
import { FiBell, FiBookOpen, FiAward, FiTag, FiSettings, FiShoppingCart, FiCheckCircle } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import './NotificationDropdown.css';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const ref = useRef();
  const unread = items.filter(n => !n.read).length;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Set up Realtime subscription
    let subscription;
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      subscription = supabase
        .channel('public:notifications')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          setItems(prev => [payload.new, ...prev].slice(0, 20));
        })
        .subscribe();
    };

    setupSubscription();
    return () => { if (subscription) supabase.removeChannel(subscription); };
  }, []);

  const markAllRead = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);

      if (error) throw error;
      setItems(items.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const markAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);

      if (error) throw error;
      setItems(items.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const typeIcon = { 
    course: <FiBookOpen />, 
    achievement: <FiAward />, 
    promo: <FiTag />, 
    system: <FiSettings />,
    payment: <FiShoppingCart />,
    approval: <FiCheckCircle />
  };

  const formatNotifTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="notif-dropdown" ref={ref}>
      <button className="notif-btn" onClick={() => setOpen(!open)}>
        <FiBell />
        {unread > 0 && <span className="notif-badge animate-scale">{unread}</span>}
      </button>
      {open && (
        <div className="notif-panel animate-scale">
          <div className="notif-header">
            <h4>Notifications</h4>
            {unread > 0 && <button onClick={markAllRead} className="notif-mark">Mark all read</button>}
          </div>
          <div className="notif-list">
            {loading ? (
              <div className="notif-empty">Loading...</div>
            ) : items.length > 0 ? (
              items.map(n => (
                <div 
                  key={n.id} 
                  className={`notif-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => !n.read && markAsRead(n.id)}
                >
                  <span className={`notif-type-icon ${n.type}`}>{typeIcon[n.type] || <FiBell />}</span>
                  <div className="notif-content">
                    <p className="notif-title">{n.title}</p>
                    <p className="notif-msg" dangerouslySetInnerHTML={{ __html: n.message }} />
                    <span className="notif-time">{formatNotifTime(n.created_at)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="notif-empty">No notifications yet</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

