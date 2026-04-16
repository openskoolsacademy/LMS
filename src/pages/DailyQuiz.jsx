import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FiZap, FiClock, FiCheckCircle, FiXCircle, FiArrowLeft, FiArrowRight,
  FiAward, FiTrendingUp, FiAlertCircle, FiStar, FiDatabase, FiHelpCircle,
  FiCalendar, FiCheck, FiLock, FiFilter, FiInfo, FiGift, FiBookOpen
} from 'react-icons/fi';
import { FaFire, FaWhatsapp } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import QuizRewardPopup from '../components/ui/QuizRewardPopup';
import InviteFriends from '../components/ui/InviteFriends';
import GlobalBanner from '../components/ui/GlobalBanner';
import './DailyQuiz.css';
import Loader from '../components/ui/Loader';




const POINTS_PER_CORRECT = 10;
const QUIZ_TIME_SECONDS = 150; // 2.5 minutes for 5 questions

export default function DailyQuiz() {
  const { user, profile } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const navigate = useNavigate();
  const location = useLocation();

  const refParam = new URLSearchParams(location.search).get('ref');

  const [loading, setLoading]         = useState(true);
  const [phase, setPhase]             = useState('intro'); // intro | quiz | result
  const [questions, setQuestions]     = useState([]);
  const [quizId, setQuizId]           = useState(null);
  const [todayAttempt, setTodayAttempt] = useState(null);
  const [userPoints, setUserPoints]   = useState(0);
  const [userStreak, setUserStreak]   = useState(0);
  const [newRewards, setNewRewards]   = useState([]);

  // Quiz state
  const [currentQ, setCurrentQ]     = useState(0);
  const [answers, setAnswers]       = useState({});
  const [timeLeft, setTimeLeft]     = useState(QUIZ_TIME_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);
  const [showPopup, setShowPopup]   = useState(false);

  // Result filter
  const [resultFilter, setResultFilter] = useState('all'); // all | correct | wrong

  // Per-question time tracking
  const questionStartRef = useRef({}); // { qId: timestamp }
  const questionTimesRef = useRef({}); // { qId: seconds_spent }

  const timerRef     = useRef(null);
  const startTimeRef = useRef(null);
  // Use local date (not UTC) — toISOString() returns UTC which can differ from local date
  const _now = new Date();
  const todayStr = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;

  useEffect(() => {
    loadQuizData();
  }, [user]);

  // Referral tracking
  useEffect(() => {
    if (!refParam || !user || refParam === user.id) return;
    const trackClick = async () => {
      try {
        await supabase.from('quiz_referrals').upsert({
          referrer_id: refParam,
          referred_user_id: user.id,
          quiz_date: todayStr,
          referral_token: refParam,
          status: 'clicked',
        }, { onConflict: 'referrer_id,referred_user_id,quiz_date', ignoreDuplicates: true });
      } catch { /* graceful */ }
    };
    trackClick();
  }, [user, refParam]);

  const loadQuizData = async () => {
    setLoading(true);
    try {
      const nowISO = new Date().toISOString();
      const todayQuizFetch = supabase
        .from('daily_quizzes')
        .select('id')
        .eq('quiz_date', todayStr)
        .eq('is_active', true)
        .lte('scheduled_at', nowISO)
        .maybeSingle();

      const userFetches = user ? [
        supabase.from('daily_quiz_attempts').select('*').eq('user_id', user.id).eq('quiz_date', todayStr).maybeSingle(),
        supabase.from('user_points').select('total_points').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_streaks').select('current_streak').eq('user_id', user.id).maybeSingle(),
      ] : [Promise.resolve({ data: null }), Promise.resolve({ data: null }), Promise.resolve({ data: null })];

      const [quizData, attemptRes, pointsRes, streakRes] = await Promise.all([
        todayQuizFetch, ...userFetches
      ]);

      if (user) {
        setTodayAttempt(attemptRes?.data || null);
        setUserPoints(pointsRes?.data?.total_points || 0);
        setUserStreak(streakRes?.data?.current_streak || 0);
        if (attemptRes?.data) { setResult(attemptRes.data); setPhase('result'); }
      }

      let loadedQuestions = null;

      if (quizData?.data) {
        setQuizId(quizData.data.id);
        const { data: qData } = await supabase
          .from('daily_quiz_questions')
          .select('*')
          .eq('quiz_id', quizData.data.id)
          .order('order_index');
        if (qData?.length > 0) loadedQuestions = qData.slice(0, 5);
      }

      // If we have a completed attempt, verify the loaded questions match the answers.
      // This handles cases where:
      // - The admin edited the quiz (questions deleted & re-inserted with new UUIDs)
      // - The quiz was deactivated
      // - Date boundary mismatches
      if (attemptRes?.data?.answers) {
        const answerKeys = Object.keys(attemptRes.data.answers);
        if (answerKeys.length > 0) {
          const loadedIds = new Set((loadedQuestions || []).map(q => q.id));
          const hasMatch = answerKeys.some(k => loadedIds.has(k));

          if (!hasMatch) {
            // Loaded questions don't match stored answers — load the original questions
            const { data: matchQ } = await supabase
              .from('daily_quiz_questions')
              .select('*')
              .in('id', answerKeys)
              .order('order_index');
            if (matchQ?.length > 0) loadedQuestions = matchQ;
          }
        }
      }

      setQuestions(loadedQuestions || []);
      if (!loadedQuestions) setQuizId(null);
    } catch {
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'quiz') return;
    if (timeLeft <= 0) { handleSubmit(true); return; }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [phase, timeLeft]);

  const startQuiz = () => {
    setAnswers({});
    setCurrentQ(0);
    setTimeLeft(QUIZ_TIME_SECONDS);
    questionStartRef.current = {};
    questionTimesRef.current = {};
    startTimeRef.current = Date.now();
    // Mark start time for first question
    if (questions[0]) {
      questionStartRef.current[questions[0].id] = Date.now();
    }
    setPhase('quiz');
  };

  const selectAnswer = (qId, idx) => setAnswers(prev => ({ ...prev, [qId]: idx }));

  // Track time when navigating questions
  const navigateToQuestion = (nextIdx) => {
    const currentQ_id = questions[currentQ]?.id;
    if (currentQ_id && questionStartRef.current[currentQ_id]) {
      const elapsed = Math.round((Date.now() - questionStartRef.current[currentQ_id]) / 1000);
      questionTimesRef.current[currentQ_id] = (questionTimesRef.current[currentQ_id] || 0) + elapsed;
      delete questionStartRef.current[currentQ_id];
    }
    setCurrentQ(nextIdx);
    const nextQ_id = questions[nextIdx]?.id;
    if (nextQ_id) {
      questionStartRef.current[nextQ_id] = Date.now();
    }
  };

  const handleSubmit = useCallback(async (isAuto = false) => {
    if (submitting) return;
    if (!isAuto) {
      const unanswered = questions.filter(q => answers[q.id] === undefined).length;
      const msg = unanswered > 0
        ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`
        : 'Submit your quiz now?';
      const ok = await showConfirm(msg, undefined, 'Submit Quiz', 'Submit', 'Cancel');
      if (!ok) return;
    }
    setSubmitting(true);
    clearTimeout(timerRef.current);

    // Finalize time for current question
    const curId = questions[currentQ]?.id;
    if (curId && questionStartRef.current[curId]) {
      const elapsed = Math.round((Date.now() - questionStartRef.current[curId]) / 1000);
      questionTimesRef.current[curId] = (questionTimesRef.current[curId] || 0) + elapsed;
    }

    const totalTimeTaken = startTimeRef.current
      ? QUIZ_TIME_SECONDS - timeLeft
      : null;

    try {
      let correct = 0;
      questions.forEach(q => { if (answers[q.id] === q.correct_option) correct++; });
      const total = questions.length;
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;
      const earned = correct * POINTS_PER_CORRECT;

      // Build answers payload with per-question time
      const answersPayload = {};
      questions.forEach(q => {
        answersPayload[q.id] = {
          selected: answers[q.id] !== undefined ? answers[q.id] : null,
          time_spent: questionTimesRef.current[q.id] || 0,
        };
      });

      const payload = {
        user_id: user.id,
        quiz_date: todayStr,
        score,
        correct_count: correct,
        total_questions: total,
        points_earned: earned,
        answers: answersPayload,
        time_taken: totalTimeTaken,
      };

      const { data, error } = await supabase
        .from('daily_quiz_attempts')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      await new Promise(r => setTimeout(r, 500));
      const { data: newPoints } = await supabase.from('user_points').select('total_points').eq('user_id', user.id).single();
      const { data: newStreak } = await supabase.from('user_streaks').select('current_streak').eq('user_id', user.id).single();

      const { data: rewards } = await supabase
        .from('user_rewards')
        .select('*')
        .eq('user_id', user.id)
        .eq('notified', false);

      if (rewards?.length > 0) {
        setNewRewards(rewards);
        await supabase.from('user_rewards').update({ notified: true }).eq('user_id', user.id).eq('notified', false);
      }

      // Attach per-question data from local state for result display
      const resultData = {
        ...data,
        streak_bonus: newStreak?.current_streak >= 3 ? data.streak_bonus : 0,
        earnedPoints: earned,
        // Store local answers map for result display
        _localAnswers: answers,
        _localQuestionTimes: { ...questionTimesRef.current },
      };

      setResult(resultData);
      setUserPoints(newPoints?.total_points || 0);
      setUserStreak(newStreak?.current_streak || 0);
      setTodayAttempt(data);
      setResultFilter('all');
      setPhase('result');
      setTimeout(() => setShowPopup(true), 600);

      if (refParam && refParam !== user.id) {
        try {
          await supabase.from('quiz_referrals')
            .update({ status: 'completed', completed_at: new Date().toISOString() })
            .eq('referrer_id', refParam)
            .eq('referred_user_id', user.id)
            .eq('quiz_date', todayStr);
        } catch { /* graceful */ }
      }
    } catch (err) {
      await showAlert('Failed to submit quiz: ' + err.message, 'Error', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, questions, answers, user, todayStr, currentQ, timeLeft]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const formatSeconds = (s) => s != null && s > 0 ? `${Math.floor(s / 60)}m ${s % 60}s` : null;

  // ── Quiz Result Image Generation ─────────────────────────
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

  const generateQuizResultImage = () => {
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

    // "QUIZ RESULT" badge (top-right)
    ctx.fillStyle = '#008ad1';
    const tagText = 'QUIZ RESULT';
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

    // User name
    const userName = profile?.name || 'Student';
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 54px Arial, sans-serif';
    const nameLines = wrapText(ctx, userName, W - px * 2);
    for (const line of nameLines) {
      ctx.fillText(line, px, y);
      y += 68;
    }
    y += 10;

    // Sub-heading
    ctx.fillStyle = '#008ad1';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText('Daily Quiz Challenge', px, y);
    y += 50;

    // Quiz date
    ctx.fillStyle = '#6b7280';
    ctx.font = '24px Arial, sans-serif';
    const dateDisplay = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    ctx.fillText(dateDisplay, px, y);
    y += 50;

    // Divider
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(W - px, y);
    ctx.stroke();
    y += 50;

    // Score ring (centered)
    const ringCX = W / 2;
    const ringCY = y + 130;
    const ringR = 120;
    const scoreVal = result?.score || 0;
    const isPassing = scoreVal >= 60;

    // Ring background
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(ringCX, ringCY, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // Ring fill
    ctx.strokeStyle = isPassing ? '#10b981' : '#f59e0b';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(ringCX, ringCY, ringR, -Math.PI / 2, -Math.PI / 2 + (scoreVal / 100) * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Score text in center
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 72px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${scoreVal}%`, ringCX, ringCY + 20);

    // Label under score
    ctx.fillStyle = '#6b7280';
    ctx.font = '24px Arial, sans-serif';
    ctx.fillText('Score', ringCX, ringCY + 55);
    ctx.textAlign = 'left';

    y = ringCY + ringR + 60;

    // Divider
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(W - px, y);
    ctx.stroke();
    y += 50;

    // Stats grid (2x2)
    const statBoxW = (W - px * 2 - 40) / 2;
    const statBoxH = 100;
    const drawStatBox = (x, yPos, label, value, color) => {
      // Box background
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      const r = 16;
      ctx.moveTo(x + r, yPos);
      ctx.lineTo(x + statBoxW - r, yPos);
      ctx.arcTo(x + statBoxW, yPos, x + statBoxW, yPos + r, r);
      ctx.arcTo(x + statBoxW, yPos + statBoxH, x + statBoxW - r, yPos + statBoxH, r);
      ctx.lineTo(x + r, yPos + statBoxH);
      ctx.arcTo(x, yPos + statBoxH, x, yPos + statBoxH - r, r);
      ctx.arcTo(x, yPos, x + r, yPos, r);
      ctx.fill();

      // Label
      ctx.fillStyle = '#6b7280';
      ctx.font = '600 22px Arial, sans-serif';
      ctx.fillText(label, x + 24, yPos + 38);

      // Value
      ctx.fillStyle = color;
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.fillText(value, x + 24, yPos + 78);
    };

    const correctCount = result?.correct_count || 0;
    const totalQ = result?.total_questions || 0;
    const wrongCount = totalQ - correctCount;
    const pointsEarned = result?.points_earned || 0;

    drawStatBox(px, y, 'Correct', `${correctCount}/${totalQ}`, '#10b981');
    drawStatBox(px + statBoxW + 40, y, 'Wrong', `${wrongCount}/${totalQ}`, '#ef4444');
    y += statBoxH + 24;
    drawStatBox(px, y, 'Points Earned', `+${pointsEarned}`, '#008ad1');
    drawStatBox(px + statBoxW + 40, y, 'Streak', `${userStreak} days`, '#f97316');
    y += statBoxH + 40;

    // Total earned line
    const totalEarned = (result?.points_earned || 0) + (result?.streak_bonus || 0);
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.fillText(`Total Earned: +${totalEarned} pts`, px, y);
    y += 30;

    // "Try it" link
    y = Math.max(y + 30, H - 270);
    ctx.fillStyle = '#008ad1';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.fillText('Take the Quiz: www.openskools.com', px, y);

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

  const handleShareQuizResult = async () => {
    try {
      const canvas = generateQuizResultImage();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const fileName = `Quiz-Result-${todayStr}-Open-Skools.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      const scoreVal = result?.score || 0;
      const correctCount = result?.correct_count || 0;
      const totalQ = result?.total_questions || 0;
      const pointsEarned = result?.points_earned || 0;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'My Quiz Result - Open Skools',
          text: `*Quiz Result:*\n\n*Score:* ${scoreVal}%\n*Correct:* ${correctCount}/${totalQ}\n*Points:* +${pointsEarned}\n*Try it:* ${window.location.origin}/daily-quiz`,
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
        showAlert('Quiz result poster downloaded! You can share it on WhatsApp.', 'Image Saved', 'success');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        showAlert('Could not share. Try again.', 'Error', 'error');
      }
    }
  };

  const NEXT_TIER = [
    { label: 'Bronze', pts: 100, icon: <FiAward style={{color: '#cd7f32'}}/> },
    { label: 'Silver', pts: 300, icon: <FiAward style={{color: '#c0c0c0'}}/> },
    { label: 'Gold',   pts: 700, icon: <FiAward style={{color: '#ffd700'}}/> },
    { label: 'Platinum', pts: 1500, icon: <FiStar style={{color: '#e5e4e2'}}/> },
    { label: 'Legend',   pts: 3000, icon: <FiStar style={{color: '#008ad1'}}/> },
  ];
  const nextTier = NEXT_TIER.find(t => t.pts > userPoints) || NEXT_TIER[NEXT_TIER.length - 1];
  const tpProgress = Math.min(100, Math.round((userPoints / nextTier.pts) * 100));

  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;

  // ── INTRO PHASE ────────────────────────────────────────────
  if (phase === 'intro') {
    const alreadyDone = !!todayAttempt;
    return (
      <div className="dq-page section">
        <div className="container">
          <div className="dq-intro animate-fade">
            <Link to="/dashboard" className="dq-back"><FiArrowLeft /> Dashboard</Link>

            <div className="dq-intro-hero">
              <div className="dq-hero-badge"><FiZap /> Daily Challenge</div>
              <h1>Daily Quiz Challenge</h1>
              <p>Test your knowledge, earn points, build your streak!</p>

              <div className="dq-stats-row">
                <div className="dq-stat">
                  <span className="dq-stat-emoji"><FiDatabase /></span>
                  <strong>{userPoints}</strong>
                  <span>Total Points</span>
                </div>
                <div className="dq-stat">
                  <span className="dq-stat-emoji" style={{color: '#f97316'}}><FaFire /></span>
                  <strong>{userStreak}</strong>
                  <span>Day Streak</span>
                </div>
                <div className="dq-stat">
                  <span className="dq-stat-emoji"><FiHelpCircle /></span>
                  <strong>{questions.length}</strong>
                  <span>Questions</span>
                </div>
                <div className="dq-stat">
                  <span className="dq-stat-emoji"><FiClock /></span>
                  <strong>2.5 min</strong>
                  <span>Time Limit</span>
                </div>
              </div>

              <div className="dq-tier-progress">
                <div className="dq-tier-labels">
                  <span>Progress to {nextTier.icon} {nextTier.label}</span>
                  <span>{userPoints} / {nextTier.pts} pts</span>
                </div>
                <div className="dq-tier-bar">
                  <div className="dq-tier-fill" style={{ width: `${tpProgress}%` }} />
                </div>
              </div>
            </div>

            {alreadyDone ? (
              <div className="dq-done-card">
                <div className="dq-done-icon"><FiCheckCircle /></div>
                <h3>Already Completed Today!</h3>
                <p>You scored <strong>{todayAttempt.score}%</strong> and earned <strong>+{todayAttempt.points_earned} pts</strong> today.</p>
                <p className="dq-done-sub">Come back tomorrow for a new challenge</p>
                <div className="dq-done-actions">
                  <Link to="/leaderboard" className="btn btn-primary"><FiTrendingUp /> View Leaderboard</Link>
                  <Link to="/dashboard" className="btn btn-outline"><FiArrowLeft /> Dashboard</Link>
                </div>
              </div>
            ) : questions.length === 0 ? (
              <div className="dq-done-card">
                <div className="dq-done-icon" style={{background: 'var(--gray-100)', color: 'var(--gray-500)', boxShadow: 'none'}}><FiCalendar /></div>
                <h3>No Quiz Scheduled</h3>
                <p>Looks like the admin hasn't added a Daily Quiz for today.</p>
                <p className="dq-done-sub">Please check back again tomorrow!</p>
                <div className="dq-done-actions">
                  <Link to="/dashboard" className="btn btn-primary"><FiArrowLeft /> Go to Dashboard</Link>
                </div>
              </div>
            ) : (
              <div className="dq-start-card">
                <div className="dq-rules">
                  <h4><FiAlertCircle /> How it works</h4>
                  <ul>
                    <li><FiCheck style={{color: 'var(--success)'}} /> <strong>+10 pts</strong> per correct answer</li>
                    <li><FaFire style={{color: '#f97316'}} /> <strong>Streak Bonus:</strong> Up to +200 pts for 3, 7, 30 days</li>
                    <li><FiClock style={{color: 'var(--primary)'}} /> <strong>2.5 mins</strong> to answer {questions.length} questions</li>
                    <li><FiCalendar style={{color: 'var(--gray-500)'}} /> <strong>1 attempt</strong> daily. Make it count!</li>
                  </ul>
                </div>
                {user ? (
                  <button className="btn btn-primary btn-lg dq-start-btn" onClick={startQuiz}>
                    <FiZap /> Start Today's Quiz
                  </button>
                ) : (
                  <div className="dq-guest-cta">
                    <p className="dq-guest-msg"><FiLock /> Login to start the quiz and track your progress!</p>
                    <Link to={`/login?redirect=/daily-quiz`} className="btn btn-primary btn-lg dq-start-btn">
                      <FiZap /> Login to Start Quiz
                    </Link>
                    <Link to="/signup" className="dq-register-link">Don't have an account? <strong>Sign up free</strong></Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── QUIZ PHASE ─────────────────────────────────────────────
  if (phase === 'quiz') {
    const q = questions[currentQ];
    const answered = Object.keys(answers).length;
    const progress = Math.round((answered / questions.length) * 100);
    const isTimeLow = timeLeft <= 60;

    return (
      <div className="dq-page">
        <GlobalBanner location="Quiz" />
        <div className="dq-quiz-layout">
          {/* Top bar */}
          <div className={`dq-topbar ${isTimeLow ? 'urgent' : ''}`}>
            <div className="dq-topbar-left">
              <span className="dq-challenge-tag"><FiZap /> <span className="dq-hide-mobile" style={{marginLeft: 4}}>Daily</span></span>
              <span className="dq-q-counter">Q{currentQ + 1}/{questions.length}</span>
            </div>
            <div className="dq-topbar-right">
              <div className={`dq-timer ${isTimeLow ? 'low' : ''}`}>
                <FiClock /> {formatTime(timeLeft)}
              </div>
              <span className="dq-answered">{answered}/{questions.length} <span className="dq-hide-mobile">answered</span></span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="dq-progress-bar">
            <div className="dq-progress-fill" style={{ width: `${progress}%` }} />
          </div>

          {/* Question */}
          <div className="dq-question-area">
            <div className="dq-question-card animate-fade">
              <div className="dq-q-num">Q{currentQ + 1}</div>
              <h2 className="dq-q-text">{q?.question_text}</h2>
              <div className="dq-options">
                {(q?.options || []).map((opt, idx) => (
                  <button
                    key={idx}
                    className={`dq-option ${answers[q.id] === idx ? 'selected' : ''}`}
                    onClick={() => selectAnswer(q.id, idx)}
                  >
                    <span className="dq-opt-letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="dq-opt-text">{opt}</span>
                    {answers[q.id] === idx && <FiCheckCircle className="dq-opt-check" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Nav */}
            <div className="dq-nav">
              <button className="btn btn-outline" disabled={currentQ === 0} onClick={() => navigateToQuestion(currentQ - 1)}>
                <FiArrowLeft /> Previous
              </button>
              {currentQ < questions.length - 1 ? (
                <button className="btn btn-primary" onClick={() => navigateToQuestion(currentQ + 1)}>
                  Next <FiArrowRight />
                </button>
              ) : (
                <button className="btn btn-primary dq-submit-btn" onClick={() => handleSubmit(false)} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Submit Quiz'}
                </button>
              )}
            </div>
          </div>

          {/* Dot nav */}
          <div className="dq-q-dots">
            {questions.map((qd, idx) => (
              <button
                key={qd.id}
                className={`dq-dot ${currentQ === idx ? 'current' : ''} ${answers[qd.id] !== undefined ? 'answered' : ''}`}
                onClick={() => navigateToQuestion(idx)}
                title={`Q${idx + 1}`}
              >{idx + 1}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── RESULT PHASE ───────────────────────────────────────────
  if (phase === 'result' && result) {
    const circumference = Math.PI * 104;
    const strokeDash = (result.score / 100) * circumference;
    const isPassing = result.score >= 60;
    const totalEarned = (result.points_earned || 0) + (result.streak_bonus || 0);
    const wrongCount = (result.total_questions || 0) - (result.correct_count || 0);

    // Build local answers map — prefer _localAnswers (fresh session), else use DB answers JSONB
    const localAnswers = result._localAnswers || null;
    const dbAnswers    = result.answers || {};
    const hasAnswerData = localAnswers !== null || (result.answers && Object.keys(result.answers).length > 0);

    // Get user selected option for a question
    const getUserAnswer = (qId) => {
      if (localAnswers !== null) return localAnswers[qId];
      const entry = dbAnswers[qId];
      if (entry && typeof entry === 'object') return entry.selected;
      if (typeof entry === 'number') return entry;
      return undefined;
    };

    // Get time spent on a question
    const getQuestionTime = (qId) => {
      if (result._localQuestionTimes) return result._localQuestionTimes[qId];
      const entry = dbAnswers[qId];
      if (entry && typeof entry === 'object') return entry.time_spent;
      return null;
    };

    // Filter questions
    const filteredQuestions = questions.filter(q => {
      if (!hasAnswerData) return true; // Show all when no answer data
      const userAns = getUserAnswer(q.id);
      const isCorrect = userAns === q.correct_option;
      if (resultFilter === 'correct') return isCorrect;
      if (resultFilter === 'wrong') return !isCorrect || userAns === undefined;
      return true;
    });

    // Improvement tip
    const improvementTip = (() => {
      if (result.score === 100) return 'Outstanding! You answered every question correctly. Keep up the excellent work!';
      if (result.score >= 80) return `Great performance! You got ${wrongCount} question${wrongCount > 1 ? 's' : ''} wrong. Review the explanations above to master those topics.`;
      if (result.score >= 60) return `Good effort! You passed today's quiz. Study the explanations for the ${wrongCount} incorrect answer${wrongCount > 1 ? 's' : ''} to strengthen your knowledge.`;
      if (result.score >= 40) return `Keep going! You got ${wrongCount} wrong today. Read through each explanation carefully — understanding mistakes is how you improve.`;
      return `Don't give up! Every expert started as a beginner. Review all the explanations above and try again tomorrow.`;
    })();

    return (
      <div className="dq-page section">
        <GlobalBanner location="Quiz" />
        <div className="container">
          <div className="dq-result animate-fade">

            {/* Score card */}
            <div className={`dq-result-card ${isPassing ? 'passed' : 'tried'}`}>
              <div className="dq-result-header">
                <div className={`dq-result-icon ${isPassing ? 'pass' : 'try'}`}>
                  {isPassing ? <FiAward /> : <FiStar />}
                </div>
                <h1>{isPassing ? 'Well Done!' : 'Keep Going!'}</h1>
                <p>{isPassing ? "Great performance on today's challenge!" : 'Every attempt makes you stronger.'}</p>
              </div>

              {/* Streak badge */}
              {userStreak > 0 && (
                <div className="dq-streak-badge">
                  <FaFire style={{ color: '#f97316' }} />
                  <span>{userStreak}-day streak</span>
                </div>
              )}

              {/* Score ring */}
              <div className="dq-score-ring">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gray-200)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="52" fill="none"
                    stroke={isPassing ? '#10b981' : '#f59e0b'}
                    strokeWidth="10"
                    strokeDasharray={`${strokeDash} ${circumference}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dasharray 1.2s ease-out' }}
                  />
                </svg>
                <span className="dq-score-val">{result.score}%</span>
              </div>

              {/* Score progress bar */}
              <div className="dq-result-progress-wrap">
                <div className="dq-result-progress-bar-wrap">
                  <div
                    className={`dq-result-progress-bar ${isPassing ? 'pass' : 'fail'}`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
                <div className="dq-result-progress-labels">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Stats */}
              <div className="dq-result-stats">
                <div className="dq-r-stat">
                  <span>Total Questions</span>
                  <strong>{result.total_questions}</strong>
                </div>
                <div className="dq-r-stat correct-stat">
                  <span>Correct</span>
                  <strong className="text-success">{result.correct_count}</strong>
                </div>
                <div className="dq-r-stat wrong-stat">
                  <span>Wrong</span>
                  <strong className="text-danger">{wrongCount}</strong>
                </div>
                <div className="dq-r-stat">
                  <span>Points Earned</span>
                  <strong className="text-primary">+{result.points_earned}</strong>
                </div>
                {result.streak_bonus > 0 && (
                  <div className="dq-r-stat">
                    <span><FaFire style={{color:'#f97316', marginRight:4}} /> Streak Bonus</span>
                    <strong style={{ color: '#f59e0b' }}>+{result.streak_bonus}</strong>
                  </div>
                )}
              </div>

              <div className="dq-result-total">
                <span>Total: </span>
                <strong>+{totalEarned} pts</strong>
                <span className="dq-total-streak">({userStreak} day streak <FaFire style={{color: '#f97316', verticalAlign: 'text-bottom'}} />)</span>
              </div>

              <div className="dq-result-actions">
                <Link to="/leaderboard" className="btn btn-primary btn-lg">
                  <FiTrendingUp /> View Leaderboard
                </Link>
                <button className="btn btn-whatsapp-outline btn-lg" onClick={handleShareQuizResult} style={{background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#166534'}}>
                  <FaWhatsapp /> Share Result
                </button>
                <Link to="/dashboard" className="btn btn-outline">
                  <FiArrowLeft /> Dashboard
                </Link>
              </div>
            </div>

            {/* Points = Savings Banner */}
            <div className="dq-discount-banner">
              <div className="dq-discount-icon"><FiGift /></div>
              <div className="dq-discount-content">
                <h4>Turn Your Points into Discounts!</h4>
                <p>You just earned <strong>+{totalEarned} pts</strong> — use them for <strong>₹1-per-point discounts</strong> on Bootcamps (up to ₹3,000) and Courses (up to ₹100). The more you quiz, the more you save!</p>
                <div className="dq-discount-links">
                  <Link to="/live-bootcamps" className="dq-discount-link bootcamp"><FiZap /> Bootcamps</Link>
                  <Link to="/courses" className="dq-discount-link course"><FiBookOpen /> Courses</Link>
                </div>
              </div>
            </div>

            {/* Review Section */}
            <div className="dq-review-section">
              <div className="dq-review-header">
                <h2>Question Review</h2>
                <p>See how you did on each question and learn from the explanations.</p>
              </div>

              {/* Filter tabs — only show when per-question answer data is available */}
              {hasAnswerData && (
              <div className="dq-result-filters">
                <button
                  className={`dq-filter-pill ${resultFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setResultFilter('all')}
                >
                  <FiFilter size={13} /> All ({questions.length})
                </button>
                <button
                  className={`dq-filter-pill correct ${resultFilter === 'correct' ? 'active' : ''}`}
                  onClick={() => setResultFilter('correct')}
                >
                  <FiCheckCircle size={13} /> Correct ({result.correct_count})
                </button>
                <button
                  className={`dq-filter-pill wrong ${resultFilter === 'wrong' ? 'active' : ''}`}
                  onClick={() => setResultFilter('wrong')}
                >
                  <FiXCircle size={13} /> Wrong ({wrongCount})
                </button>
              </div>
              )}

              {/* No per-question data notice */}
              {!hasAnswerData && (
                <div className="dq-explanation-box" style={{ marginBottom: 16 }}>
                  <FiInfo size={14} />
                  <span>Detailed per-question answer tracking was not available for this attempt. Correct answers are highlighted below for your review.</span>
                </div>
              )}

              {/* Question review cards */}
              <div className="dq-review-list">
                {filteredQuestions.length === 0 ? (
                  <div className="dq-review-empty">
                    <FiCheckCircle size={32} />
                    <p>No questions in this category.</p>
                  </div>
                ) : filteredQuestions.map((q, idx) => {
                  const userAns = getUserAnswer(q.id);
                  const isCorrect = hasAnswerData ? userAns === q.correct_option : null;
                  const notAnswered = hasAnswerData ? (userAns === undefined || userAns === null) : false;
                  const qTime = getQuestionTime(q.id);
                  const qTimeStr = formatSeconds(qTime);

                  // Card border class: green if correct, red if wrong, neutral if no data
                  const cardClass = !hasAnswerData ? '' : (isCorrect ? 'correct' : 'wrong');

                  return (
                    <div key={q.id} className={`dq-review-card ${cardClass}`}>
                      {/* Card header */}
                      <div className="dq-review-card-top">
                        <div className="dq-review-q-info">
                          <span className="dq-review-q-num">Q{questions.indexOf(q) + 1}</span>
                          {qTimeStr && (
                            <span className="dq-review-time">
                              <FiClock size={11} /> {qTimeStr}
                            </span>
                          )}
                        </div>
                        <span className={`dq-review-status ${!hasAnswerData ? '' : isCorrect ? 'correct' : 'wrong'}`}>
                          {!hasAnswerData
                            ? <><FiHelpCircle /> Review</>
                            : isCorrect
                              ? <><FiCheckCircle /> Correct</>
                              : <><FiXCircle /> {notAnswered ? 'Not Answered' : 'Wrong'}</>
                          }
                        </span>
                      </div>

                      {/* Question text */}
                      <p className="dq-review-q-text">{q.question_text}</p>

                      {/* Options */}
                      <div className="dq-review-options">
                        {(q.options || []).map((opt, oi) => {
                          const isUserPick  = hasAnswerData && userAns === oi;
                          const isRightAns  = q.correct_option === oi;
                          let cls = 'dq-review-opt';
                          if (isRightAns)              cls += ' dq-review-correct';
                          else if (isUserPick && !isRightAns) cls += ' dq-review-selected';

                          return (
                            <div key={oi} className={cls}>
                              <span className="dq-review-opt-letter">{String.fromCharCode(65 + oi)}</span>
                              <span className="dq-review-opt-text">{opt}</span>
                              <div className="dq-review-opt-tags">
                                {isRightAns && <span className="dq-review-tag correct-tag"><FiCheckCircle size={11} /> Correct Answer</span>}
                                {isUserPick && !isRightAns && <span className="dq-review-tag wrong-tag"><FiXCircle size={11} /> Your Answer</span>}
                                {isUserPick && isRightAns && <span className="dq-review-tag your-tag">Your Answer</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {q.explanation ? (
                        <div className="dq-explanation-box">
                          <FiInfo size={14} />
                          <div>
                            <strong style={{ display: 'block', marginBottom: 4, fontSize: '0.82rem' }}>Explanation</strong>
                            <span>{q.explanation}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="dq-explanation-box" style={{ background: 'var(--gray-50)', borderColor: 'var(--gray-200)', color: 'var(--gray-500)' }}>
                          <FiInfo size={14} style={{ color: 'var(--gray-400)' }} />
                          <span style={{ fontStyle: 'italic' }}>No explanation available for this question.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Improvement tip */}
              <div className="dq-improvement-tip">
                <div className="dq-tip-icon">
                  <FiTrendingUp />
                </div>
                <div>
                  <strong>Improvement Tip</strong>
                  <p>{improvementTip}</p>
                </div>
              </div>
            </div>

            {/* Invite Friends */}
            {user && (
              <InviteFriends
                userId={user.id}
                quizDate={todayStr}
                userName={profile?.name || 'A friend'}
              />
            )}
          </div>
        </div>

        {showPopup && (
          <QuizRewardPopup
            pointsEarned={result.points_earned || 0}
            streakBonus={result.streak_bonus || 0}
            streakCount={userStreak}
            newRewards={newRewards}
            onClose={() => setShowPopup(false)}
          />
        )}
      </div>
    );
  }

  return null;
}
