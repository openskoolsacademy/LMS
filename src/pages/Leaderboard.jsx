import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiZap, FiTrendingUp, FiCalendar, FiClock, FiAward, FiStar, FiTarget, FiGift, FiBookOpen } from 'react-icons/fi';
import { FaFire, FaTrophy, FaCrown, FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
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
  const { user, profile } = useAuth();
  const { showAlert } = useAlert();
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
        // Join user_points with users + streaks + attempt time data
        const { data: pts } = await supabase
          .from('user_points')
          .select('user_id, total_points, updated_at')
          .order('total_points', { ascending: false })
          .limit(50);

        if (pts?.length) {
          const userIds = pts.map(p => p.user_id);
          const [{ data: users }, { data: streaks }, { data: attempts }] = await Promise.all([
            supabase.from('users').select('id, name, avatar_url').in('id', userIds),
            supabase.from('user_streaks').select('user_id, current_streak').in('user_id', userIds),
            supabase.from('daily_quiz_attempts').select('user_id, time_taken, submitted_at').in('user_id', userIds),
          ]);
          const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));
          const sMap = Object.fromEntries((streaks || []).map(s => [s.user_id, s.current_streak]));

          // Aggregate: average time_taken and earliest submitted_at per user
          const timeMap = {};
          (attempts || []).forEach(a => {
            if (!timeMap[a.user_id]) timeMap[a.user_id] = { totalTime: 0, count: 0, earliest: a.submitted_at };
            timeMap[a.user_id].totalTime += (a.time_taken || 0);
            timeMap[a.user_id].count += 1;
            if (a.submitted_at && (!timeMap[a.user_id].earliest || a.submitted_at < timeMap[a.user_id].earliest)) {
              timeMap[a.user_id].earliest = a.submitted_at;
            }
          });

          rows = pts.map(p => ({
            user_id: p.user_id,
            name: uMap[p.user_id]?.name || 'Unknown',
            avatar_url: uMap[p.user_id]?.avatar_url,
            points: p.total_points,
            streak: sMap[p.user_id] || 0,
            avg_time: timeMap[p.user_id] ? Math.round(timeMap[p.user_id].totalTime / timeMap[p.user_id].count) : Infinity,
            earliest_submit: timeMap[p.user_id]?.earliest || null,
          }));
        }
      } else if (type === 'weekly') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const { data: attempts } = await supabase
          .from('daily_quiz_attempts')
          .select('user_id, points_earned, streak_bonus, time_taken, submitted_at')
          .gte('quiz_date', weekAgo);

        if (attempts?.length) {
          const agg = {};
          attempts.forEach(a => {
            if (!agg[a.user_id]) agg[a.user_id] = { points: 0, totalTime: 0, count: 0, earliest: a.submitted_at };
            agg[a.user_id].points += (a.points_earned || 0) + (a.streak_bonus || 0);
            agg[a.user_id].totalTime += (a.time_taken || 0);
            agg[a.user_id].count += 1;
            if (a.submitted_at && (!agg[a.user_id].earliest || a.submitted_at < agg[a.user_id].earliest)) {
              agg[a.user_id].earliest = a.submitted_at;
            }
          });
          const userIds = Object.keys(agg);
          const [{ data: users }, { data: streaks }, { data: userPts }] = await Promise.all([
            supabase.from('users').select('id, name, avatar_url').in('id', userIds),
            supabase.from('user_streaks').select('user_id, current_streak').in('user_id', userIds),
            supabase.from('user_points').select('user_id, total_points').in('user_id', userIds),
          ]);
          const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));
          const sMap = Object.fromEntries((streaks || []).map(s => [s.user_id, s.current_streak]));
          const ptsMap = Object.fromEntries((userPts || []).map(p => [p.user_id, p.total_points]));
          rows = Object.entries(agg)
            .map(([uid, data]) => ({
              user_id: uid,
              name: uMap[uid]?.name || 'Unknown',
              avatar_url: uMap[uid]?.avatar_url,
              points: Math.min(data.points, ptsMap[uid] !== undefined ? ptsMap[uid] : Infinity),
              streak: sMap[uid] || 0,
              avg_time: data.count > 0 ? Math.round(data.totalTime / data.count) : Infinity,
              earliest_submit: data.earliest || null,
            }));
        }
      } else { // daily
        const { data: attempts } = await supabase
          .from('daily_quiz_attempts')
          .select('user_id, points_earned, streak_bonus, time_taken, submitted_at')
          .eq('quiz_date', todayStr);

        if (attempts?.length) {
          const userIds = attempts.map(a => a.user_id);
          const [{ data: users }, { data: streaks }, { data: userPts }] = await Promise.all([
            supabase.from('users').select('id, name, avatar_url').in('id', userIds),
            supabase.from('user_streaks').select('user_id, current_streak').in('user_id', userIds),
            supabase.from('user_points').select('user_id, total_points').in('user_id', userIds),
          ]);
          const uMap = Object.fromEntries((users || []).map(u => [u.id, u]));
          const sMap = Object.fromEntries((streaks || []).map(s => [s.user_id, s.current_streak]));
          const ptsMap = Object.fromEntries((userPts || []).map(p => [p.user_id, p.total_points]));
          rows = attempts.map(a => ({
            user_id: a.user_id,
            name: uMap[a.user_id]?.name || 'Unknown',
            avatar_url: uMap[a.user_id]?.avatar_url,
            points: Math.min((a.points_earned || 0) + (a.streak_bonus || 0), ptsMap[a.user_id] !== undefined ? ptsMap[a.user_id] : Infinity),
            streak: sMap[a.user_id] || 0,
            avg_time: a.time_taken || Infinity,
            earliest_submit: a.submitted_at || null,
          }));
        }
      }

      // Stable 3-level sorting:
      // 1. Points (highest first)
      // 2. Time taken (lowest first — faster solver wins)
      // 3. Submitted first (earliest wins — who scored first)
      rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        const timeA = a.avg_time ?? Infinity;
        const timeB = b.avg_time ?? Infinity;
        if (timeA !== timeB) return timeA - timeB;
        const subA = a.earliest_submit || '';
        const subB = b.earliest_submit || '';
        if (subA !== subB) return subA < subB ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

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

  // ── Leaderboard Image Generation ─────────────────────────
  const wrapText = (ctx, text, maxWidth) => {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const generateLeaderboardImage = () => {
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Top accent bar
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#008ad1');
    grad.addColorStop(1, '#0db1e0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 8);

    const px = 72;
    let y = 70;

    // "LEADERBOARD" badge (top-right)
    ctx.fillStyle = '#008ad1';
    const tagText = 'LEADERBOARD';
    ctx.font = 'bold 22px Arial, sans-serif';
    const tagW = ctx.measureText(tagText).width + 40;
    const tagH = 42;
    const tagR = 21;
    const tagX = W - px - tagW;
    ctx.beginPath();
    ctx.moveTo(tagX + tagR, y);
    ctx.lineTo(tagX + tagW - tagR, y);
    ctx.arcTo(tagX + tagW, y, tagX + tagW, y + tagR, tagR);
    ctx.arcTo(tagX + tagW, y + tagH, tagX + tagW - tagR, y + tagH, tagR);
    ctx.lineTo(tagX + tagR, y + tagH);
    ctx.arcTo(tagX, y + tagH, tagX, y + tagH - tagR, tagR);
    ctx.arcTo(tagX, y, tagX + tagR, y, tagR);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tagText, tagX + 20, y + 29);
    y += 80;

    // User's rank highlight
    const userName = profile?.name || 'Student';
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 54px Arial, sans-serif';
    const nameLines = wrapText(ctx, userName, W - px * 2);
    for (const line of nameLines) {
      ctx.fillText(line, px, y);
      y += 68;
    }
    y += 10;

    // Rank & Points
    ctx.fillStyle = '#008ad1';
    ctx.font = 'bold 34px Arial, sans-serif';
    ctx.fillText(`Rank #${myRank || '—'}  •  ${myRow?.points || 0} pts`, px, y);
    y += 50;

    // Streak
    if (myRow?.streak > 0) {
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText(`${myRow.streak}-Day Streak`, px, y);
      y += 50;
    }

    // Tab label
    const tabLabel = tab === 'alltime' ? 'All-Time' : tab === 'weekly' ? 'This Week' : 'Today';
    ctx.fillStyle = '#6b7280';
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText(`${tabLabel} Rankings`, px, y);
    y += 40;

    // Divider
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(W - px, y);
    ctx.stroke();
    y += 40;

    // Top 3 table
    const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
    const medalLabels = ['1st', '2nd', '3rd'];
    const top3 = data.slice(0, 3);

    // Table header
    ctx.fillStyle = '#f8fafc';
    const headerH = 56;
    const headerR = 12;
    ctx.beginPath();
    ctx.moveTo(px + headerR, y);
    ctx.lineTo(W - px - headerR, y);
    ctx.arcTo(W - px, y, W - px, y + headerR, headerR);
    ctx.arcTo(W - px, y + headerH, W - px - headerR, y + headerH, headerR);
    ctx.lineTo(px + headerR, y + headerH);
    ctx.arcTo(px, y + headerH, px, y + headerH - headerR, headerR);
    ctx.arcTo(px, y, px + headerR, y, headerR);
    ctx.fill();

    ctx.fillStyle = '#6b7280';
    ctx.font = '600 22px Arial, sans-serif';
    ctx.fillText('Rank', px + 24, y + 36);
    ctx.fillText('Name', px + 180, y + 36);
    ctx.fillText('Points', W - px - 280, y + 36);
    ctx.fillText('Streak', W - px - 120, y + 36);
    y += headerH + 8;

    top3.forEach((row, idx) => {
      const rowH = 80;
      const rowY = y;
      const isMeRow = user && row.user_id === user.id;

      // Highlight user's row
      if (isMeRow) {
        ctx.fillStyle = '#eff6ff';
        ctx.fillRect(px, rowY, W - px * 2, rowH);
      }

      // Bottom border
      ctx.strokeStyle = '#f3f4f6';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, rowY + rowH);
      ctx.lineTo(W - px, rowY + rowH);
      ctx.stroke();

      // Medal circle
      const medalCX = px + 60;
      const medalCY = rowY + rowH / 2;
      ctx.fillStyle = medalColors[idx] || '#e5e7eb';
      ctx.beginPath();
      ctx.arc(medalCX, medalCY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(medalLabels[idx], medalCX, medalCY + 6);
      ctx.textAlign = 'left';

      // Name
      ctx.fillStyle = isMeRow ? '#008ad1' : '#111827';
      ctx.font = 'bold 28px Arial, sans-serif';
      const displayName = isMeRow ? 'You' : (row.name || 'Unknown').split(' ')[0];
      ctx.fillText(displayName, px + 180, rowY + rowH / 2 + 10);

      // Points
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText(`${row.points}`, W - px - 280, rowY + rowH / 2 + 10);

      // Streak
      ctx.fillStyle = row.streak > 0 ? '#f97316' : '#9ca3af';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.fillText(row.streak > 0 ? `${row.streak}d Streak` : '—', W - px - 120, rowY + rowH / 2 + 10);

      y += rowH;
    });

    // If user is not in top 3, show their position separately
    if (myRank && myRank > 3 && myRow) {
      y += 20;
      ctx.fillStyle = '#6b7280';
      ctx.font = '600 20px Arial, sans-serif';
      ctx.fillText('• • •', W / 2 - 20, y);
      y += 30;

      const rowH = 80;
      ctx.fillStyle = '#eff6ff';
      const rowR = 12;
      ctx.beginPath();
      ctx.moveTo(px + rowR, y);
      ctx.lineTo(W - px - rowR, y);
      ctx.arcTo(W - px, y, W - px, y + rowR, rowR);
      ctx.arcTo(W - px, y + rowH, W - px - rowR, y + rowH, rowR);
      ctx.lineTo(px + rowR, y + rowH);
      ctx.arcTo(px, y + rowH, px, y + rowH - rowR, rowR);
      ctx.arcTo(px, y, px + rowR, y, rowR);
      ctx.fill();

      // Rank number
      ctx.fillStyle = '#008ad1';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText(`#${myRank}`, px + 24, y + rowH / 2 + 10);

      // Name
      ctx.fillStyle = '#008ad1';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText('You', px + 180, y + rowH / 2 + 10);

      // Points
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText(`${myRow.points}`, W - px - 280, y + rowH / 2 + 10);

      // Streak
      ctx.fillStyle = myRow.streak > 0 ? '#f97316' : '#9ca3af';
      ctx.font = 'bold 24px Arial, sans-serif';
      ctx.fillText(myRow.streak > 0 ? `${myRow.streak}d Streak` : '—', W - px - 120, y + rowH / 2 + 10);

      y += rowH;
    }

    // "Try it" link
    y = Math.max(y + 50, H - 270);
    ctx.fillStyle = '#008ad1';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText('Challenge me: www.openskools.com', px, y);

    // Footer
    const footerH = 160;
    const footerY = H - footerH;
    const footGrad = ctx.createLinearGradient(0, footerY, W, footerY);
    footGrad.addColorStop(0, '#008ad1');
    footGrad.addColorStop(1, '#0068a3');
    ctx.fillStyle = footGrad;
    ctx.fillRect(0, footerY, W, footerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 32px Arial, sans-serif';
    ctx.fillText('Open Skools Academy', px, footerY + 52);

    ctx.font = '22px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('ISO 9001:2015 Certified  |  NCS Registered', px, footerY + 90);

    ctx.font = 'bold 24px Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('www.openskools.com  |  8189989150', px, footerY + 128);

    return canvas;
  };

  const handleShareLeaderboard = async () => {
    try {
      const canvas = generateLeaderboardImage();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const fileName = `Leaderboard-Rank-${myRank}-Open-Skools.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Leaderboard Rank - Open Skools',
          text: `*Leaderboard Update:*\n\n*My Rank:* #${myRank}\n*Points:* ${myRow?.points || 0} pts\n*Challenge me:* ${window.location.origin}/leaderboard`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert('Leaderboard poster downloaded! You can share it on WhatsApp.', 'Image Saved', 'success');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        showAlert('Could not share. Try again.', 'Error', 'error');
      }
    }
  };

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
          {user && myRank && (
            <button className="btn btn-whatsapp-outline" onClick={handleShareLeaderboard} style={{marginTop: 16, background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#166534'}}>
              <FaWhatsapp /> Share My Rank
            </button>
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

        {/* Points = Savings Banner */}
        {user && (
          <div className="lb-discount-banner">
            <div className="lb-discount-icon"><FiGift /></div>
            <div className="lb-discount-content">
              <h4>Your Points = Real Savings!</h4>
              <p>Every point you earn here can be redeemed as <strong>₹1 discount</strong> on Bootcamps (up to ₹3000) and Courses (up to ₹100). Keep climbing the leaderboard!</p>
              <div className="lb-discount-links">
                <Link to="/live-bootcamps" className="lb-discount-link bootcamp"><FiZap /> Browse Bootcamps</Link>
                <Link to="/courses" className="lb-discount-link course"><FiBookOpen /> Browse Courses</Link>
              </div>
            </div>
          </div>
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
