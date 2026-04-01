import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import './GlobalBanner.css';

// Helper to track banner analytics in localStorage
function trackBannerEvent(bannerId, eventType) {
  const key = `banner_analytics_${bannerId}`;
  const data = JSON.parse(localStorage.getItem(key) || '{"impressions":0,"clicks":0}');
  data[eventType] = (data[eventType] || 0) + 1;
  data.lastSeen = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(data));
  
  // Also update a global analytics summary
  const summaryKey = 'banner_analytics_summary';
  const summary = JSON.parse(localStorage.getItem(summaryKey) || '{}');
  if (!summary[bannerId]) summary[bannerId] = { impressions: 0, clicks: 0 };
  summary[bannerId][eventType] = (summary[bannerId][eventType] || 0) + 1;
  summary[bannerId].lastSeen = new Date().toISOString();
  localStorage.setItem(summaryKey, JSON.stringify(summary));
}

export function getBannerAnalytics() {
  return JSON.parse(localStorage.getItem('banner_analytics_summary') || '{}');
}

export default function GlobalBanner({ location }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const trackedRef = useRef(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    fetchActiveBanners();
  }, [location]);

  // Track impressions when banners are rendered
  useEffect(() => {
    banners.forEach(b => {
      if (!trackedRef.current.has(b.id)) {
        trackBannerEvent(b.id, 'impressions');
        trackedRef.current.add(b.id);
      }
    });
  }, [banners]);

  const fetchActiveBanners = async () => {
    try {
      setLoading(true);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('marketing_banners')
        .select('*')
        .eq('status', 'active')
        .lte('start_date', now)
        .gte('end_date', now)
        .contains('display_locations', [location]);

      if (error) throw error;

      // Retargeting: Show banners to ALL users — no dismiss filter
      setBanners(data || []);
    } catch (err) {
      console.error('Error fetching marketing banners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCtaClick = (e, banner) => {
    e.stopPropagation();
    trackBannerEvent(banner.id, 'clicks');
    if (banner.cta_link.startsWith('/')) navigate(banner.cta_link);
    else window.open(banner.cta_link, '_blank', 'noopener,noreferrer');
  };

  const handleBannerClick = (e, banner) => {
    if (e.target.closest('a') || e.target.closest('.btn-banner-cta')) return;
    if (banner.cta_link) {
      trackBannerEvent(banner.id, 'clicks');
      if (banner.cta_link.startsWith('/')) navigate(banner.cta_link);
      else window.open(banner.cta_link, '_blank', 'noopener,noreferrer');
    }
  };

  if (loading || banners.length === 0) return null;

  return (
    <div className="global-banner-wrapper">
      <div className="global-banner-carousel" ref={scrollRef}>
        {banners.map((banner) => (
          <div 
            key={banner.id} 
            className={`global-banner animate-fade ${!banner.image_url ? 'no-image' : ''}`}
            onClick={(e) => handleBannerClick(e, banner)}
            style={{ 
              backgroundImage: banner.image_url ? `url("${banner.image_url}")` : 'none',
              backgroundColor: banner.image_url ? 'var(--dark)' : (banner.bg_color || 'var(--primary)'),
              cursor: banner.cta_link ? 'pointer' : 'default'
            }}
          >
            <div className="global-banner-content">
              {banner.subtitle && <tag className="global-banner-badge">{banner.subtitle}</tag>}
              <h2>{banner.title}</h2>
              {banner.cta_text && banner.cta_link && (
                <div className="global-banner-actions" style={{marginTop: 16}}>
                  <button className="btn-banner-cta" onClick={(e) => handleCtaClick(e, banner)}>
                    {banner.cta_text} <FiArrowRight />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
