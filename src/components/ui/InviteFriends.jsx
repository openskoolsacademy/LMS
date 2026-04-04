import { useState, useEffect } from 'react';
import {
  FiShare2, FiCopy, FiCheck, FiUsers, FiLink,
  FiMessageCircle, FiArrowRight
} from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import './InviteFriends.css';

const BASE_URL = 'https://openskools.com';

export default function InviteFriends({ userId, quizDate, userName }) {
  const [copied, setCopied] = useState(false);
  const [referralStats, setReferralStats] = useState({ clicked: 0, attempted: 0, completed: 0 });

  const referralLink = `${BASE_URL}/daily-quiz?ref=${userId}`;
  const whatsappMsg = encodeURIComponent(
    `Can you beat my score on today's quiz?\n\nI just completed the Daily Quiz Challenge on Open Skools.\nTry now and beat me!\n${referralLink}`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMsg}`;

  useEffect(() => {
    if (!userId) return;
    loadStats();
  }, [userId, quizDate]);

  const loadStats = async () => {
    try {
      const { data } = await supabase
        .from('quiz_referrals')
        .select('status')
        .eq('referrer_id', userId)
        .eq('quiz_date', quizDate);

      if (data) {
        const stats = { clicked: 0, attempted: 0, completed: 0 };
        data.forEach(r => {
          if (r.status === 'clicked') stats.clicked++;
          else if (r.status === 'attempted') stats.attempted++;
          else if (r.status === 'completed') stats.completed++;
        });
        setReferralStats(stats);
      }
    } catch {
      // Graceful fallback — table may not exist yet
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = referralLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const totalReferrals = referralStats.clicked + referralStats.attempted + referralStats.completed;

  return (
    <div className="inv-card">
      {/* Header */}
      <div className="inv-header">
        <div className="inv-header-left">
          <div className="inv-icon-wrap">
            <FiUsers />
          </div>
          <div>
            <h3>Challenge Your Friends</h3>
            <p>Share the quiz and see who scores higher!</p>
          </div>
        </div>
        {totalReferrals > 0 && (
          <div className="inv-badge">
            <FiArrowRight size={12} />
            <span>{totalReferrals} invite{totalReferrals !== 1 ? 's' : ''} sent</span>
          </div>
        )}
      </div>

      {/* Referral link */}
      <div className="inv-link-row">
        <div className="inv-link-box">
          <FiLink className="inv-link-icon" />
          <span className="inv-link-text">{referralLink}</span>
        </div>
        <button className={`inv-copy-btn ${copied ? 'copied' : ''}`} onClick={copyLink}>
          {copied ? <><FiCheck /> Copied!</> : <><FiCopy /> Copy</>}
        </button>
      </div>

      {/* Action buttons */}
      <div className="inv-actions">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inv-wa-btn"
        >
          <FiMessageCircle />
          Send on WhatsApp
        </a>
        <button className="inv-share-btn" onClick={copyLink}>
          <FiShare2 />
          {copied ? 'Copied!' : 'Copy Link'}
        </button>
      </div>

      {/* Referral stats (shown only if there are referrals) */}
      {totalReferrals > 0 && (
        <div className="inv-stats">
          <div className="inv-stat-row">
            <div className="inv-stat-item">
              <strong>{totalReferrals}</strong>
              <span>Link Clicks</span>
            </div>
            <div className="inv-stat-divider" />
            <div className="inv-stat-item">
              <strong>{referralStats.attempted + referralStats.completed}</strong>
              <span>Tried Quiz</span>
            </div>
            <div className="inv-stat-divider" />
            <div className="inv-stat-item">
              <strong>{referralStats.completed}</strong>
              <span>Completed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
