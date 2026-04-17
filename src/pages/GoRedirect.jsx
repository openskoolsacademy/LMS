import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './GoRedirect.css';

export default function GoRedirect() {
  const { slug } = useParams();
  const [status, setStatus] = useState('loading'); // loading | redirecting | notfound
  const [destination, setDestination] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  useEffect(() => {
    if (!slug) {
      setDebugInfo('No slug in URL');
      setStatus('notfound');
      return;
    }

    const redirect = async () => {
      try {
        setDebugInfo(`Looking up slug: "${slug}"...`);

        const { data, error } = await supabase
          .from('short_links')
          .select('destination_url, slug, is_active')
          .eq('slug', slug)
          .eq('is_active', true)
          .maybeSingle();

        if (error) {
          setDebugInfo(`DB Error: ${error.message} (code: ${error.code})`);
          setStatus('notfound');
          return;
        }

        if (!data) {
          setDebugInfo(`No active link found for slug: "${slug}"`);
          setStatus('notfound');
          return;
        }

        // Track click — await so request fires before redirect
        try { await supabase.rpc('increment_short_link_click', { link_slug: slug }); } catch(e) {}

        const destUrl = data.destination_url;
        setDestination(destUrl);
        setStatus('redirecting');

        // ── Detect in-app browsers ──
        const ua = navigator.userAgent || navigator.vendor || '';
        const isInApp = /Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|Twitter|LinkedIn/i.test(ua);

        if (isInApp) {
          const isAndroid = /Android/i.test(ua);

          if (isAndroid) {
            // Android: Use intent:// to open in Chrome
            const url = new URL(destUrl);
            const intentUrl = `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(destUrl)};end`;
            window.location.href = intentUrl;
            return;
          } else {
            // iOS: Try target=_system approach, then fallback to normal redirect
            const a = document.createElement('a');
            a.setAttribute('href', destUrl);
            a.setAttribute('target', '_system');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            // Fallback after delay
            setTimeout(() => {
              window.location.href = destUrl;
            }, 1000);
            return;
          }
        }

        // Normal browser: just redirect
        window.location.href = destUrl;

      } catch (err) {
        setDebugInfo(`Exception: ${err.message}`);
        setStatus('notfound');
      }
    };

    redirect();
  }, [slug]);

  return (
    <div className="go-page">
      <div className="go-container">
        {status === 'loading' && (
          <div className="go-loader animate-fade">
            <div className="go-spinner" />
            <p>Loading...</p>
          </div>
        )}

        {status === 'redirecting' && (
          <div className="go-loader animate-fade">
            <div className="go-spinner" />
            <p>Redirecting you...</p>
            <a href={destination} className="go-manual-link">
              Click here if not redirected
            </a>
          </div>
        )}

        {status === 'notfound' && (
          <div className="go-notfound animate-fade">
            <div className="go-logo">OS</div>
            <h2>Link Not Found</h2>
            <p>This link doesn't exist or has been deactivated.</p>
            <a href="/" className="go-home-btn">Go to Homepage</a>
            {/* Temporary debug info — remove after fixing */}
            {debugInfo && (
              <p style={{ marginTop: 20, fontSize: '0.75rem', color: '#9ca3af', wordBreak: 'break-all', maxWidth: 300 }}>
                Debug: {debugInfo}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
