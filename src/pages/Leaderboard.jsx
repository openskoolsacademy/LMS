import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiZap, FiTrendingUp, FiCalendar, FiClock, FiAward, FiStar, FiTarget } from 'react-icons/fi';
import { FaFire, FaTrophy, FaCrown } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import GlobalBanner from '../components/ui/GlobalBanner';
import './Leaderboard.css';

const MEDAL = [
  <FiAward key="g" style={{color: '#ffd700'}} />, 
  <FiAward key="s" style={{color: '#c0c0c0'}} />, 
  <FiAward key="b" style={{color: '#cd7f32'}} />
];
const TABS = [
  { key: 'alltime', label: 'All-Time', icon: <FiTrendingUp /> },
  { key: 'weekly', label: 'This Week', icon: <FiCalendar /> },
  { key: 'daily', label: 'Today', icon: <FiClock /> },
];

export default function Leaderboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('alltime');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState(null);
  const [myRow, setMyRow] = useState(null);
  // Use local date (not UTC)
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    loadLeaderboard(tab);
  }, [tab]);

  const loadLeaderboard = async (type) => {
    setLoading(true);
    try {
      let rows = [];

      if (type === 'alltime') {
        // Join user_points with users + streaks
        const { data: pts } = await supabase
          .from('user_points')
          .select('user_id, total_points, updated_at')
          .order('total_points', { ascending: false })
          .limit(50);

        if (pts?.length) {
          const userIds = pts.map(p => p.user_id);
          const { data: users } = await supabase.from('users').select('id, name, avatar_url').in('id', userIds);
          const { data: streaks } = await supabase.from('user_streaks').select('user_id, current_streak').in('user_id', userIds);
          const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));
          const sMap = Object.fromEntries((streaks || []).map(s => [s.user_id, s.current_streak]));
          rows = pts.map(p => ({
            user_id: p.user_id,
            name: uMap[p.user_id]?.name || 'Unknown',
            avatar_url: uMap[p.user_id]?.avatar_url,
            points: p.total_points,
            streak: sMap[p.user_id] || 0,
          }));
        }
      } else if (type === 'weekly') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: attempts } = await supabase
          .from('daily_quiz_attempts')
          .select('user_id, points_earned, streak_bonus')
          .gte('quiz_date', weekAgo);

        if (attempts?.length) {
          const agg = {};
          attempts.forEach(a => {
            if (!agg[a.user_id]) agg[a.user_id] = 0;
            agg[a.user_id] += (a.points_earned || 0) + (a.streak_bonus || 0);
          });
          const userIds = Object.keys(agg);
          const { data: users } = await supabase.from('users').select('id, name, avatar_url').in('id', userIds);
          const { data: streaks } = await supabase.from('user_streaks').select('user_id, current_streak').in('user_id', userIds);
          const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));
          const sMap = Object.fromEntries((streaks || []).map(s => [s.user_id, s.current_streak]));
          rows = Object.entries(agg)
            .map(([uid, pts]) => ({
              user_id: uid,
              name: uMap[uid]?.name || 'Unknown',
              avatar_url: uMap[uid]?.avatar_url,
              points: pts,
              streak: sMap[uid] || 0,
            }))
            .sort((a, b) => b.points - a.points);
        }
      } else { // daily
        const { data: attempts } = await supabase
          .from('daily_quiz_attempts')
          .select('user_id, points_earned, streak_bonus')
          .eq('quiz_date', todayStr)
          .order('points_earned', { ascending: false });

        if (attempts?.length) {
          const userIds = attempts.map(a => a.user_id);
          const { data: users } = await supabase.from('users').select('id, name, avatar_url').in('id', userIds);
          const { data: streaks } = await supabase.from('user_streaks').select('user_id, current_streak').in('user_id', userIds);
          const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));
          const sMap = Object.fromEntries((streaks || []).map(s => [s.user_id, s.current_streak]));
          rows = attempts.map(a => ({
            user_id: a.user_id,
            name: uMap[a.user_id]?.name || 'Unknown',
            avatar_url: uMap[a.user_id]?.avatar_url,
            points: (a.points_earned || 0) + (a.streak_bonus || 0),
            streak: sMap[a.user_id] || 0,
          }));
        }
      }

      // Find user's rank
      if (user) {
        const idx = rows.findIndex(r => r.user_id === user.id);
        if (idx >= 0) {
          setMyRank(idx + 1);
          setMyRow({ ...rows[idx], rank: idx + 1 });
        } else {
          setMyRank(null);
          setMyRow(null);
        }
      }

      setData(rows.slice(0, 20));
    } catch (err) {
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const isMe = (row) => user && row.user_id === user.id;

  return (
    <div className="lb-page section">
      <GlobalBanner location="Leaderboard" />
      <div className="container">
        {/* Hero */}
        <div className="lb-hero animate-fade">
          <div className="lb-hero-icon"><FaTrophy style={{color: '#ffd700'}} /></div>
          <h1>Leaderboard</h1>
          <p>Compete with learners, earn points, and claim the top spot!</p>
          {!user && (
            <div className="lb-guest-cta">
              <Link to="/login" className="btn btn-primary" style={{ background: 'white', color: 'var(--primary)' }}>Login to Compete</Link>
              <Link to="/daily-quiz" className="btn btn-outline" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}><FiZap /> Start Quiz</Link>
            </div>
          )}
          {user && myRank && (
            <div className="lb-my-rank-badge">
              Your Rank: <strong>#{myRank}</strong> • {myRow?.points} pts
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="lb-tabs">
          {TABS.map(t => (
            <button
              key={t.key}
              className={`lb-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="lb-loading">
            <div className="dq-loading-spinner" />
            <p>Loading rankings...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="lb-empty">
            <div className="lb-empty-icon"><FiTarget /></div>
            <h3>No entries yet!</h3>
            <p>Be the first to complete today's quiz and claim the top spot.</p>
            <Link to="/daily-quiz" className="btn btn-primary"><FiZap /> Take the Quiz</Link>
          </div>
        ) : (
          <>
            {/* Podium (top 3) */}
            {data.length >= 3 && (
              <div className="lb-podium">
                {/* 2nd */}
                <div className={`lb-podium-card p2 ${isMe(data[1]) ? 'me' : ''}`}>
                  <div className="lb-pod-medal"><FiAward style={{color: '#c0c0c0'}} /></div>
                  <div className="lb-pod-avatar">{data[1].avatar_url ? <img src={data[1].avatar_url} alt="" /> : getInitials(data[1].name)}</div>
                  <div className="lb-pod-name">{isMe(data[1]) ? 'You' : data[1].name.split(' ')[0]}</div>
                  <div className="lb-pod-pts">{data[1].points} pts</div>
                  <div className="lb-pod-bar p2-bar" />
                </div>
                {/* 1st */}
                <div className={`lb-podium-card p1 ${isMe(data[0]) ? 'me' : ''}`}>
                  <div className="lb-pod-crown"><FaCrown style={{color: '#ffd700'}} /></div>
                  <div className="lb-pod-medal"><FiAward style={{color: '#ffd700'}} /></div>
                  <div className="lb-pod-avatar large">{data[0].avatar_url ? <img src={data[0].avatar_url} alt="" /> : getInitials(data[0].name)}</div>
                  <div className="lb-pod-name">{isMe(data[0]) ? 'You' : data[0].name.split(' ')[0]}</div>
                  <div className="lb-pod-pts">{data[0].points} pts</div>
                  <div className="lb-pod-bar p1-bar" />
                </div>
                {/* 3rd */}
                <div className={`lb-podium-card p3 ${isMe(data[2]) ? 'me' : ''}`}>
                  <div className="lb-pod-medal"><FiAward style={{color: '#cd7f32'}} /></div>
                  <div className="lb-pod-avatar">{data[2].avatar_url ? <img src={data[2].avatar_url} alt="" /> : getInitials(data[2].name)}</div>
                  <div className="lb-pod-name">{isMe(data[2]) ? 'You' : data[2].name.split(' ')[0]}</div>
                  <div className="lb-pod-pts">{data[2].points} pts</div>
                  <div className="lb-pod-bar p3-bar" />
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="lb-list">
              <div className="lb-list-header">
                <span>Rank</span>
                <span>Learner</span>
                <span>Points</span>
                <span>Streak</span>
              </div>
              {data.map((row, idx) => (
                <div key={row.user_id} className={`lb-row ${isMe(row) ? 'lb-me' : ''} ${idx < 3 ? 'top3' : ''}`}>
                  <div className="lb-rank">
                    {idx < 3 ? (
                      <span className="lb-medal">{MEDAL[idx]}</span>
                    ) : (
                      <span className="lb-rank-num">#{idx + 1}</span>
                    )}
                  </div>
                  <div className="lb-user-cell">
                    <div className="lb-avatar">
                      {row.avatar_url ? <img src={row.avatar_url} alt="" /> : getInitials(row.name)}
                    </div>
                    <div className="lb-user-info">
                      <span className="lb-name">{isMe(row) ? <><FiStar style={{color: '#ffd700', marginRight: '4px', verticalAlign: 'text-bottom'}} /> You</> : row.name}</span>
                      {isMe(row) && <span className="lb-you-tag">That's you!</span>}
                    </div>
                  </div>
                  <div className="lb-points">
                    <span className="lb-pts-val">{row.points}</span>
                    <span className="lb-pts-label">pts</span>
                  </div>
                  <div className="lb-streak">
                    {row.streak > 0 ? (
                      <span className="lb-streak-badge"><FaFire style={{color: '#f97316', marginRight: '4px', verticalAlign: 'text-bottom'}} /> {row.streak}d</span>
                    ) : (
                      <span className="lb-streak-none">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pinned: user's own rank if not in top 20 */}
            {user && myRank && myRank > 20 && myRow && (
              <div className="lb-my-pinned">
                <div className="lb-pinned-label">Your Position</div>
                <div className="lb-row lb-me">
                  <div className="lb-rank"><span className="lb-rank-num">#{myRank}</span></div>
                  <div className="lb-user-cell">
                    <div className="lb-avatar">{getInitials(myRow.name)}</div>
                    <div className="lb-user-info"><span className="lb-name"><FiStar style={{color: '#ffd700', marginRight: '4px', verticalAlign: 'text-bottom'}} /> You</span></div>
                  </div>
                  <div className="lb-points">
                    <span className="lb-pts-val">{myRow.points}</span>
                    <span className="lb-pts-label">pts</span>
                  </div>
                  <div className="lb-streak">
                    {myRow.streak > 0 ? <span className="lb-streak-badge"><FaFire style={{color: '#f97316', marginRight: '4px', verticalAlign: 'text-bottom'}} /> {myRow.streak}d</span> : <span className="lb-streak-none">—</span>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* CTA */}
        {user && (
          <div className="lb-cta">
            <div className="lb-cta-text">
              <h3>Ready to climb the ranks?</h3>
              <p>Complete today's quiz to earn more points!</p>
            </div>
            <Link to="/daily-quiz" className="btn btn-primary btn-lg">
              <FiZap /> Take Today's Quiz
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
