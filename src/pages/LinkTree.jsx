import { useState, useEffect } from 'react';
import { FiExternalLink, FiChevronRight, FiLink, FiGlobe, FiInstagram, FiYoutube, FiTwitter, FiLinkedin, FiMail, FiPhone, FiBookOpen, FiVideo, FiAward, FiZap, FiMessageCircle, FiBriefcase, FiMap, FiFileText, FiHeart, FiStar, FiUsers, FiHome, FiShoppingCart, FiShoppingBag, FiCalendar, FiCamera, FiMusic, FiHeadphones, FiMic, FiTv, FiCpu, FiCode, FiTerminal, FiDatabase, FiCloud, FiLock, FiDownload, FiUpload, FiShare2, FiGift, FiDollarSign, FiCreditCard, FiTruck, FiMapPin, FiNavigation, FiCompass, FiSun, FiMoon, FiDroplet, FiWifi, FiRss, FiRadio, FiCast, FiPrinter, FiClipboard, FiBookmark, FiFlag, FiTrendingUp, FiBarChart2, FiPieChart, FiActivity, FiTarget, FiAnchor, FiFeather, FiPenTool, FiTool, FiSettings, FiGrid, FiLayout, FiImage, FiFilm, FiSliders, FiLayers, FiPackage, FiFolder, FiMonitor, FiSmartphone, FiTablet, FiWatch, FiSpeaker, FiBell, FiInfo, FiHelpCircle, FiThumbsUp, FiSmile, FiCoffee, FiSend, FiLifeBuoy, FiHash, FiAtSign, FiPercent, FiUser, FiUserPlus, FiShield } from 'react-icons/fi';
import { FaWhatsapp, FaTelegram, FaDiscord, FaFacebook, FaLinkedinIn, FaPinterest, FaReddit, FaSnapchat, FaTiktok, FaSpotify, FaAmazon, FaApple, FaGoogle, FaMicrosoft, FaGithub, FaGitlab, FaStackOverflow, FaDribbble, FaBehance, FaFigma, FaMedium, FaWordpress, FaShopify, FaPaypal, FaBitcoin, FaEthereum, FaNpm, FaDocker, FaAws, FaSlack, FaSkype, FaViber, FaLine, FaThreads, FaXTwitter } from 'react-icons/fa6';
import { supabase } from '../lib/supabase';
import './LinkTree.css';

// Icon map — resolves stored icon name strings to actual React components
const ICON_MAP = {
  FiExternalLink, FiLink, FiGlobe, FiInstagram, FiYoutube, FiTwitter,
  FiLinkedin, FiMail, FiPhone, FiBookOpen, FiVideo, FiAward, FiZap,
  FiMessageCircle, FiBriefcase, FiMap, FiFileText, FiHeart, FiStar, FiUsers,
  FiHome, FiShoppingCart, FiShoppingBag, FiCalendar, FiCamera, FiMusic,
  FiHeadphones, FiMic, FiTv, FiCpu, FiCode, FiTerminal, FiDatabase, FiCloud,
  FiLock, FiDownload, FiUpload, FiShare2, FiGift, FiDollarSign, FiCreditCard,
  FiTruck, FiMapPin, FiNavigation, FiCompass, FiSun, FiMoon, FiDroplet, FiWifi,
  FiRss, FiRadio, FiCast, FiPrinter, FiClipboard, FiBookmark, FiFlag,
  FiTrendingUp, FiBarChart2, FiPieChart, FiActivity, FiTarget, FiAnchor,
  FiFeather, FiPenTool, FiTool, FiSettings, FiGrid, FiLayout, FiImage,
  FiFilm, FiSliders, FiLayers, FiPackage, FiFolder, FiMonitor, FiSmartphone,
  FiTablet, FiWatch, FiSpeaker, FiBell, FiInfo, FiHelpCircle, FiThumbsUp,
  FiSmile, FiCoffee, FiSend, FiLifeBuoy, FiHash, FiAtSign, FiPercent,
  FiUser, FiUserPlus, FiShield, FiChevronRight,
  FaWhatsapp, FaTelegram, FaDiscord, FaFacebook, FaLinkedinIn, FaPinterest,
  FaReddit, FaSnapchat, FaTiktok, FaSpotify, FaAmazon, FaApple, FaGoogle,
  FaMicrosoft, FaGithub, FaGitlab, FaStackOverflow, FaDribbble, FaBehance,
  FaFigma, FaMedium, FaWordpress, FaShopify, FaPaypal, FaBitcoin, FaEthereum,
  FaNpm, FaDocker, FaAws, FaSlack, FaSkype, FaViber, FaLine, FaThreads, FaXTwitter,
};

export default function LinkTree() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Links — Open Skools Academy';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'All important links from Open Skools Academy — courses, events, community, and more.');

    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('link_tree')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setLinks(data || []);
    } catch (err) {
      console.error('LinkTree: Error fetching links:', err);
    } finally {
      setLoading(false);
    }
  };

  // Detect in-app browsers (Instagram, Facebook, etc.)
  const isInAppBrowser = () => {
    const ua = navigator.userAgent || navigator.vendor || '';
    return /Instagram|FBAN|FBAV|FB_IAB|Line|Snapchat|Twitter|LinkedIn/i.test(ua);
  };

  const [showInAppBanner, setShowInAppBanner] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isInAppBrowser()) setShowInAppBanner(true);
  }, []);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleClick = (link) => {
    // Fire-and-forget: increment click count without blocking navigation
    supabase.rpc('increment_link_click', { link_id: link.id })
      .then(({ error }) => { if (error) console.error('Click tracking error:', error.message); })
      .catch((err) => console.error('Click tracking error:', err));
  };

  const renderIcon = (iconName) => {
    const IconComponent = ICON_MAP[iconName] || FiExternalLink;
    return <IconComponent />;
  };

  return (
    <div className="lt-page">
      {/* In-App Browser Banner */}
      {showInAppBanner && (
        <div className="lt-inapp-banner animate-fade">
          <div className="lt-inapp-content">
            <FiExternalLink style={{ flexShrink: 0, fontSize: '1.1rem' }} />
            <div>
              <strong>Open in Browser</strong>
              <span>Tap <strong>⋮</strong> or <strong>…</strong> menu above → "Open in Browser" for the best experience</span>
            </div>
          </div>
          <button className="lt-copy-btn" onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      )}

      {/* Hero */}
      <div className="lt-hero animate-fade">
        <div className="lt-logo">OS</div>
        <h1>Open Skools Academy</h1>
        <p>Your gateway to all our platforms, courses, and community channels.</p>
      </div>

      {/* Links */}
      {loading ? (
        <div className="lt-skeleton-list">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="lt-skeleton-item" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="lt-empty">
          <div className="lt-empty-icon"><FiLink /></div>
          <h3>No links available</h3>
          <p>Links will appear here soon. Check back later!</p>
        </div>
      ) : (
        <div className="lt-links">
          {links.map((link) => (
            <a
              key={link.id}
              className="lt-link"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleClick(link)}
            >
              <div className="lt-link-icon">
                {renderIcon(link.icon_name)}
              </div>
              <span className="lt-link-title">{link.title}</span>
              <FiChevronRight className="lt-link-arrow" />
            </a>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="lt-footer">
        <p>Powered by <a href="/">Open Skools Academy</a></p>
      </div>
    </div>
  );
}
