import { useEffect } from 'react';
import { FiAward, FiStar, FiTrendingUp, FiZap, FiCheckCircle, FiGift, FiShield, FiX } from 'react-icons/fi';
import './QuizRewardPopup.css';

const REWARD_DISPLAY = {
  bronze: { icon: <FiAward />, color: '#cd7f32', label: 'Bronze Learner' },
  silver: { icon: <FiAward />, color: '#9ca3af', label: 'Silver Scholar' },
  gold: { icon: <FiAward />, color: '#f59e0b', label: 'Gold Champion' },
  platinum: { icon: <FiShield />, color: '#005f9e', label: 'Platinum Elite' },
  legend: { icon: <FiStar />, color: '#008ad1', label: 'Legend' },
  streak_3: { icon: <FiTrendingUp />, color: '#f97316', label: '3-Day Streak!' },
  streak_7: { icon: <FiTrendingUp />, color: '#ef4444', label: '7-Day Streak!' },
  streak_30: { icon: <FiZap />, color: '#005f9e', label: '30-Day Streak!' },
};

export default function QuizRewardPopup({ pointsEarned, streakBonus, streakCount, newRewards = [], onClose }) {
  const totalEarned = (pointsEarned || 0) + (streakBonus || 0);

  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, []);

  const streakMsg =
    streakCount >= 30 ? <><FiZap style={{marginRight: 6}} /> 30-Day Streak! Legendary!</> :
    streakCount >= 7  ? <><FiTrendingUp style={{marginRight: 6}} /> 7-Day Streak! Amazing!</> :
    streakCount >= 3  ? <><FiTrendingUp style={{marginRight: 6}} /> {streakCount}-Day Streak!</> :
    streakCount >= 1  ? <><FiTrendingUp style={{marginRight: 6}} /> {streakCount}-Day Streak</> : null;

  return (
    <div className="qrp-overlay" onClick={onClose}>
      {/* Confetti */}
      <div className="qrp-confetti" aria-hidden>
        {[...Array(18)].map((_, i) => (
          <div key={i} className={`qrp-piece qrp-piece-${(i % 6) + 1}`} style={{ left: `${(i / 18) * 100}%`, animationDelay: `${(i % 5) * 0.1}s` }} />
        ))}
      </div>

      <div className="qrp-card animate-fade" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button className="qrp-close" onClick={onClose} aria-label="Close"><FiX size={20} /></button>

        {/* Points badge */}
        <div className="qrp-points-badge">
          <div className="qrp-points-icon"><FiZap /></div>
          <div className="qrp-points-val">+{totalEarned}</div>
          <div className="qrp-points-label">Points Earned!</div>
        </div>

        {/* Breakdown */}
        <div className="qrp-breakdown">
          <div className="qrp-brow">
            <span>Quiz answers</span>
            <strong>+{pointsEarned} pts</strong>
          </div>
          {streakBonus > 0 && (
            <div className="qrp-brow highlight">
              <span style={{display: 'flex', alignItems: 'center', gap: 6}}><FiTrendingUp /> Streak bonus</span>
              <strong>+{streakBonus} pts</strong>
            </div>
          )}
        </div>

        {/* Streak message */}
        {streakMsg && (
          <div className="qrp-streak-msg">
            {streakMsg}
          </div>
        )}

        {/* New rewards unlocked */}
        {newRewards.length > 0 && (
          <div className="qrp-rewards">
            <div className="qrp-rewards-title"><FiGift style={{marginRight: 6}} /> New Reward Unlocked!</div>
            {newRewards.map(r => {
              const rd = REWARD_DISPLAY[r.reward_type] || { icon: <FiAward />, color: '#008ad1', label: r.reward_label };
              return (
                <div key={r.id} className="qrp-reward-chip" style={{ borderColor: rd.color }}>
                  <span className="qrp-reward-emoji">{rd.icon}</span>
                  <span className="qrp-reward-name" style={{ color: rd.color }}>{rd.label}</span>
                </div>
              );
            })}
          </div>
        )}

        <button className="qrp-dismiss" onClick={onClose} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          Awesome! <FiCheckCircle />
        </button>
      </div>
    </div>
  );
}
