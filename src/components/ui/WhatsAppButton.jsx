import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import './WhatsAppButton.css';

const WHATSAPP_URL = 'https://wa.me/message/E5OKPXTRFRD5E1';

const PAGE_MESSAGES = {
  '/courses': 'Hi, I need help finding the right course on Open Skools',
  '/careers': 'Hi, I need help with the job listings on Open Skools',
  '/dashboard': 'Hi, I need help with my Open Skools dashboard',
  '/learn': 'Hi, I have a doubt about this course on Open Skools',
  '/instructor': 'Hi, I need help with my instructor account on Open Skools',
  '/blog': 'Hi, I need help with the Open Skools blog',
};

function getMessageForPath(pathname) {
  if (pathname.startsWith('/learn/') || pathname.startsWith('/assessment/')) {
    return 'Hi, I have a doubt about this course on Open Skools';
  }
  if (pathname.startsWith('/courses/')) {
    return 'Hi, I have a doubt about this course on Open Skools';
  }
  for (const [key, msg] of Object.entries(PAGE_MESSAGES)) {
    if (pathname.startsWith(key)) return msg;
  }
  return 'Hi, I need help with Open Skools';
}

export default function WhatsAppButton() {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    // Hide while scrolling down, show when scrolling up
    if (currentScrollY > lastScrollY && currentScrollY > 200) {
      setVisible(false);
      setShowTooltip(false);
    } else {
      setVisible(true);
    }
    setLastScrollY(currentScrollY);
  }, [lastScrollY]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleClick = () => {
    const message = getMessageForPath(location.pathname);
    const encodedMessage = encodeURIComponent(message);
    const url = `${WHATSAPP_URL}?text=${encodedMessage}`;

    // Analytics tracking
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'whatsapp_support_click', {
        event_category: 'Support',
        event_label: location.pathname,
        value: 1,
      });
    }
    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', 'WhatsAppSupportClick', { page: location.pathname });
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={`wa-fab-wrapper ${visible ? 'wa-fab--visible' : 'wa-fab--hidden'}`}
      aria-label="WhatsApp Support"
    >
      <span className="wa-fab-label">Need Help?</span>
      <button
        id="whatsapp-support-btn"
        className="wa-fab-btn"
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label="Chat with us on WhatsApp"
        title="Chat with us on WhatsApp"
      >
        {/* WhatsApp SVG icon */}
        <svg
          className="wa-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          fill="white"
          aria-hidden="true"
        >
          <path d="M16 .5C7.44.5.5 7.44.5 16c0 2.84.74 5.5 2.03 7.83L.5 31.5l7.88-2.06A15.46 15.46 0 0016 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5zm0 28.17a13.6 13.6 0 01-6.96-1.9l-.5-.3-5.17 1.36 1.38-5.04-.32-.52A13.63 13.63 0 012.33 16C2.33 8.44 8.44 2.33 16 2.33S29.67 8.44 29.67 16 23.56 28.67 16 28.67z" />
          <path d="M23.1 19.26c-.38-.19-2.24-1.1-2.59-1.23-.35-.13-.6-.19-.85.19-.25.38-.97 1.23-1.19 1.48-.22.25-.44.28-.82.09-.38-.19-1.6-.59-3.05-1.87-1.13-1-1.89-2.23-2.11-2.61-.22-.38-.02-.58.17-.77.17-.17.38-.44.57-.66.19-.22.25-.38.38-.63.13-.25.06-.47-.03-.66-.09-.19-.85-2.05-1.17-2.8-.31-.73-.62-.63-.85-.64h-.72c-.25 0-.66.09-1 .47-.35.38-1.32 1.29-1.32 3.14s1.35 3.65 1.54 3.9c.19.25 2.66 4.06 6.44 5.69.9.39 1.6.62 2.15.79.9.29 1.73.25 2.38.15.73-.11 2.24-.91 2.56-1.79.32-.88.32-1.63.22-1.79-.09-.16-.35-.25-.73-.44z" />
        </svg>
        <div className={`wa-tooltip ${showTooltip ? 'wa-tooltip--visible' : ''}`}>
          Chat with us
        </div>
      </button>
    </div>
  );
}
