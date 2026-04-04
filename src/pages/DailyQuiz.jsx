import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FiZap, FiClock, FiCheckCircle, FiXCircle, FiArrowLeft, FiArrowRight,
  FiAward, FiTrendingUp, FiAlertCircle, FiStar, FiDatabase, FiHelpCircle, FiCalendar, FiCheck, FiLock
} from 'react-icons/fi';
import { FaFire } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import QuizRewardPopup from '../components/ui/QuizRewardPopup';
import InviteFriends from '../components/ui/InviteFriends';
import GlobalBanner from '../components/ui/GlobalBanner';
import './DailyQuiz.css';

// ── Fallback question bank (used when no admin quiz exists for today) ──────────
const FALLBACK_QUESTIONS = [
  { id: 'fq1', question_text: 'Which planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Mars', 'Earth'], correct_option: 1, order_index: 0 },
  { id: 'fq2', question_text: 'What is the capital of France?', options: ['Berlin', 'Madrid', 'Paris', 'Rome'], correct_option: 2, order_index: 1 },
  { id: 'fq3', question_text: 'Which element has the chemical symbol "O"?', options: ['Gold', 'Oxygen', 'Osmium', 'Oganesson'], correct_option: 1, order_index: 2 },
  { id: 'fq4', question_text: 'How many bones are in the adult human body?', options: ['196', '206', '216', '186'], correct_option: 1, order_index: 3 },
  { id: 'fq5', question_text: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct_option: 3, order_index: 4 },
];

const POINTS_PER_CORRECT = 10;
const QUIZ_TIME_SECONDS = 150; // 2.5 minutes for 5 questions

export default function DailyQuiz() {
  const { user, profile } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const navigate = useNavigate();
  const location = useLocation();

  // Extract referral token from URL (?ref=USER_ID)
  const refParam = new URLSearchParams(location.search).get('ref');

  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('intro'); // intro | quiz | result
  const [questions, setQuestions] = useState([]);
  const [quizId, setQuizId] = useState(null); // today's quiz ID (null = fallback)
  const [todayAttempt, setTodayAttempt] = useState(null);
  const [userPoints, setUserPoints] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const [newRewards, setNewRewards] = useState([]);

  // Quiz state
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(QUIZ_TIME_SECONDS);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const todayStr = new Date().toISOString().split('T')[0];

  // ── Load data on mount ───────────────────────────────────
  useEffect(() => {
    // Always load questions (works for guests too)
    loadQuizData();
  }, [user]);

  // ── Referral tracking: log click when arriving via ?ref= ──
  useEffect(() => {
    if (!refParam || !user || refParam === user.id) return; // skip self-referral
    const trackClick = async () => {
      try {
        await supabase.from('quiz_referrals').upsert({
          referrer_id: refParam,
          referred_user_id: user.id,
          quiz_date: todayStr,
          referral_token: refParam,
          status: 'clicked',
        }, { onConflict: 'referrer_id,referred_user_id,quiz_date', ignoreDuplicates: true });
      } catch { /* graceful — table may not exist yet */ }
    };
    trackClick();
  }, [user, refParam]);

  const loadQuizData = async () => {
    setLoading(true);
    try {
      // Load today's quiz questions (works for all visitors)
      const todayQuizFetch = supabase
        .from('daily_quizzes')
        .select('id')
        .eq('quiz_date', todayStr)
        .eq('is_active', true)
        .single();

      // Only fetch user-specific data if logged in
      const userFetches = user ? [
        supabase.from('daily_quiz_attempts').select('*').eq('user_id', user.id).eq('quiz_date', todayStr).single(),
        supabase.from('user_points').select('total_points').eq('user_id', user.id).single(),
        supabase.from('user_streaks').select('current_streak').eq('user_id', user.id).single(),
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

      if (quizData?.data) {
        setQuizId(quizData.data.id);
        const { data: qData } = await supabase
          .from('daily_quiz_questions')
          .select('*')
          .eq('quiz_id', quizData.data.id)
          .order('order_index');
        setQuestions(qData?.length > 0 ? qData.slice(0, 5) : FALLBACK_QUESTIONS);
      } else {
        setQuizId(null);
        setQuestions(FALLBACK_QUESTIONS);
      }
    } catch {
      setQuestions(FALLBACK_QUESTIONS);
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
    startTimeRef.current = Date.now();
    setPhase('quiz');
  };

  const selectAnswer = (qId, idx) => setAnswers(prev => ({ ...prev, [qId]: idx }));

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

    try {
      let correct = 0;
      questions.forEach(q => { if (answers[q.id] === q.correct_option) correct++; });
      const total = questions.length;
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;
      const earned = correct * POINTS_PER_CORRECT;

      const payload = {
        user_id: user.id,
        quiz_date: todayStr,
        score,
        correct_count: correct,
        total_questions: total,
        points_earned: earned,
      };

      const { data, error } = await supabase
        .from('daily_quiz_attempts')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      // Reload points/streak after trigger runs
      await new Promise(r => setTimeout(r, 500));
      const { data: newPoints } = await supabase.from('user_points').select('total_points').eq('user_id', user.id).single();
      const { data: newStreak } = await supabase.from('user_streaks').select('current_streak').eq('user_id', user.id).single();

      // Check for newly unlocked rewards (unnotified)
      const { data: rewards } = await supabase
        .from('user_rewards')
        .select('*')
        .eq('user_id', user.id)
        .eq('notified', false);

      if (rewards?.length > 0) {
        setNewRewards(rewards);
        // Mark as notified
        await supabase.from('user_rewards').update({ notified: true }).eq('user_id', user.id).eq('notified', false);
      }

      setResult({ ...data, streak_bonus: newStreak?.current_streak >= 3 ? data.streak_bonus : 0, earnedPoints: earned });
      setUserPoints(newPoints?.total_points || 0);
      setUserStreak(newStreak?.current_streak || 0);
      setTodayAttempt(data);
      setPhase('result');
      setTimeout(() => setShowPopup(true), 600);

      // ── Mark referral as completed if user arrived via ref link ──
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
  }, [submitting, questions, answers, user, todayStr]);

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const NEXT_TIER = [
    { label: 'Bronze', pts: 100, emoji: <FiAward style={{color: '#cd7f32'}}/> },
    { label: 'Silver', pts: 300, emoji: <FiAward style={{color: '#c0c0c0'}}/> },
    { label: 'Gold', pts: 700, emoji: <FiAward style={{color: '#ffd700'}}/> },
    { label: 'Platinum', pts: 1500, emoji: <FiStar style={{color: '#e5e4e2'}}/> },
    { label: 'Legend', pts: 3000, emoji: <FiStar style={{color: '#008ad1'}}/> },
  ];
  const nextTier = NEXT_TIER.find(t => t.pts > userPoints) || NEXT_TIER[NEXT_TIER.length - 1];
  const tpProgress = Math.min(100, Math.round((userPoints / nextTier.pts) * 100));

  if (loading) return (
    <div className="dq-page section">
      <GlobalBanner location="Quiz" />
      <div className="container">
        <div className="dq-loading">
          <div className="dq-loading-spinner" />
          <p>Loading today's challenge...</p>
        </div>
      </div>
    </div>
  );

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

              {/* Stats row */}
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

              {/* Points progress */}
              <div className="dq-tier-progress">
                <div className="dq-tier-labels">
                  <span>Progress to {nextTier.emoji} {nextTier.label}</span>
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
            ) : (
              <div className="dq-start-card">
                <div className="dq-rules">
                  <h4><FiAlertCircle /> How it works</h4>
                  <ul>
                    <li><FiCheck style={{color: 'var(--success)', marginRight: 4}} /> <strong>+10 points</strong> for every correct answer</li>
                    <li><FaFire style={{color: '#f97316', marginRight: 4}} /> <strong>Streak Bonus:</strong> 3 days = +20 pts | 7 days = +50 pts | 30 days = +200 pts</li>
                    <li><FiClock style={{color: 'var(--primary)', marginRight: 4}} /> You have <strong>2.5 minutes</strong> to answer all {questions.length} questions</li>
                    <li><FiCalendar style={{color: 'var(--gray-500)', marginRight: 4}} /> One attempt per day — make it count!</li>
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
                    <Link to="/signup" className="dq-register-link">Don't have an account? <strong>Sign up free →</strong></Link>
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
              <span className="dq-challenge-tag"><FiZap style={{marginRight: 4}} /> Daily Challenge</span>
              <span className="dq-q-counter">Q{currentQ + 1} / {questions.length}</span>
            </div>
            <div className="dq-topbar-right">
              <div className={`dq-timer ${isTimeLow ? 'low' : ''}`}>
                <FiClock /> {formatTime(timeLeft)}
              </div>
              <span className="dq-answered">{answered}/{questions.length} answered</span>
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
              <button className="btn btn-outline" disabled={currentQ === 0} onClick={() => setCurrentQ(c => c - 1)}>
                <FiArrowLeft /> Previous
              </button>
              {currentQ < questions.length - 1 ? (
                <button className="btn btn-primary" onClick={() => setCurrentQ(c => c + 1)}>
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
                onClick={() => setCurrentQ(idx)}
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

    return (
      <div className="dq-page section">
        <GlobalBanner location="Quiz" />
        <div className="container">
          <div className="dq-result animate-fade">
            <div className={`dq-result-card ${isPassing ? 'passed' : 'tried'}`}>
              <div className="dq-result-header">
                <div className={`dq-result-icon ${isPassing ? 'pass' : 'try'}`}>
                  {isPassing ? <FiAward /> : <FiStar />}
                </div>
                <h1>{isPassing ? 'Well Done!' : 'Keep Going!'}</h1>
                <p>{isPassing ? "Great performance on today's challenge!" : 'Every attempt makes you stronger.'}</p>
              </div>

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

              <div className="dq-result-stats">
                <div className="dq-r-stat"><span>Correct</span><strong className="text-success">{result.correct_count}</strong></div>
                <div className="dq-r-stat"><span>Wrong</span><strong className="text-danger">{result.total_questions - result.correct_count}</strong></div>
                <div className="dq-r-stat"><span>Points Earned</span><strong className="text-primary">+{result.points_earned}</strong></div>
                {result.streak_bonus > 0 && (
                  <div className="dq-r-stat"><span><FaFire style={{color:'#f97316', marginRight:4}} /> Streak Bonus</span><strong style={{ color: '#f59e0b' }}>+{result.streak_bonus}</strong></div>
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
                <Link to="/dashboard" className="btn btn-outline">
                  <FiArrowLeft /> Dashboard
                </Link>
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
