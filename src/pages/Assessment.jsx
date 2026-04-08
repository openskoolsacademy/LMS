import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiClock, FiCheckCircle, FiXCircle, FiAward, FiArrowLeft, FiArrowRight, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import Certificate from '../components/ui/Certificate';
import './Assessment.css';
import Loader from '../components/ui/Loader';


export default function Assessment() {
  const { courseId } = useParams();
  const { user, profile } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [phase, setPhase] = useState('intro'); // intro, quiz, result
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeCert, setActiveCert] = useState(null);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  // Fetch all data
  useEffect(() => {
    if (!user || !courseId) return;
    
    async function fetchData() {
      setLoading(true);
      try {
        // Fetch course
        const { data: courseData } = await supabase
          .from('courses').select('id, title, thumbnail_url, category').eq('id', courseId).single();
        setCourse(courseData);

        // Fetch assessment for this course
        const { data: assessmentData } = await supabase
          .from('assessments').select('*').eq('course_id', courseId).eq('is_active', true).single();
        
        if (!assessmentData) {
          await showAlert('No assessment available for this course.', 'Not Found', 'warning');
          navigate(`/learn/${courseId}`);
          return;
        }
        setAssessment(assessmentData);

        // Fetch questions
        const { data: questionsData } = await supabase
          .from('assessment_questions').select('*').eq('assessment_id', assessmentData.id).order('order_index');
        setQuestions(questionsData || []);

        // Fetch past attempts
        const { data: attemptsData } = await supabase
          .from('assessment_attempts').select('*')
          .eq('user_id', user.id).eq('assessment_id', assessmentData.id)
          .order('submitted_at', { ascending: false });
        setAttempts(attemptsData || []);

        // If user already passed, show result directly
        const passedAttempt = (attemptsData || []).find(a => a.passed);
        if (passedAttempt) {
          setResult(passedAttempt);
          setPhase('result');
        }
      } catch (err) {
        console.error('Error loading assessment:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, courseId]);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'quiz' || !assessment?.time_limit_minutes || timeLeft === null) return;

    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }

    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [phase, timeLeft]);

  const hasPassed = attempts.some(a => a.passed);
  const attemptsUsed = attempts.length;
  const attemptsRemaining = assessment?.max_attempts ? assessment.max_attempts - attemptsUsed : Infinity;
  const canAttempt = !hasPassed && attemptsRemaining > 0;

  const startQuiz = () => {
    let orderedQuestions = [...questions];
    if (assessment?.shuffle_questions) {
      orderedQuestions = orderedQuestions.sort(() => Math.random() - 0.5);
    }
    setQuestions(orderedQuestions);
    setAnswers({});
    setCurrentQ(0);
    setResult(null);
    startTimeRef.current = Date.now();
    if (assessment?.time_limit_minutes) {
      setTimeLeft(assessment.time_limit_minutes * 60);
    }
    setPhase('quiz');
  };

  const selectAnswer = (questionId, optionIndex) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = useCallback(async (isAutoSubmit = false) => {
    if (submitting) return;
    
    if (!isAutoSubmit) {
      const unanswered = questions.filter(q => answers[q.id] === undefined).length;
      const msg = unanswered > 0 
        ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?` 
        : 'Are you sure you want to submit your assessment?';
      const confirmed = await showConfirm(msg, undefined, 'Submit Assessment', 'Submit', 'Cancel');
      if (!confirmed) return;
    }
    
    setSubmitting(true);
    clearTimeout(timerRef.current);

    try {
      // Calculate score
      let correctCount = 0;
      questions.forEach(q => {
        if (answers[q.id] === q.correct_option) correctCount++;
      });

      const totalQ = questions.length;
      const scorePercent = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
      const passed = scorePercent >= (assessment?.pass_percentage || 60);
      const timeTaken = startTimeRef.current ? Math.round((Date.now() - startTimeRef.current) / 1000) : null;

      const attemptData = {
        user_id: user.id,
        assessment_id: assessment.id,
        course_id: courseId,
        answers,
        score: scorePercent,
        total_questions: totalQ,
        correct_count: correctCount,
        passed,
        time_taken_seconds: timeTaken
      };

      const { data, error } = await supabase
        .from('assessment_attempts').insert([attemptData]).select().single();
      
      if (error) throw error;

      setResult(data);
      setAttempts(prev => [data, ...prev]);
      setPhase('result');
    } catch (err) {
      console.error('Error submitting assessment:', err);
      await showAlert('Failed to submit assessment: ' + err.message, 'Error', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [submitting, questions, answers, assessment, user, courseId]);

  const generateCertificate = async () => {
    try {
      const { createStudentCertificate } = await import('../utils/certificateLogUtils');
      const certRecord = await createStudentCertificate(user, courseId, course?.title, profile?.name);

      setActiveCert({
        id: certRecord.certificate_id,
        studentName: profile?.name || user.email,
        courseTitle: course?.title,
        issuedAt: certRecord.issued_at,
        userId: user.id,
        courseId
      });
    } catch (err) {
      console.error('Certificate error:', err);
      await showAlert('Error generating certificate.', 'Error', 'error');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;
  if (!course || !assessment) return <div className="container section"><h2>Assessment not found</h2><Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link></div>;

  // ─── INTRO PHASE ─────────────────────
  if (phase === 'intro') {
    return (
      <div className="assess-page section">
        <div className="container">
          <div className="assess-intro animate-fade">
            <Link to={`/learn/${courseId}`} className="assess-back"><FiArrowLeft /> Back to Course</Link>
            
            <div className="assess-intro-card">
              <div className="assess-intro-icon">
                <FiAward />
              </div>
              <h1>{assessment.title}</h1>
              <p className="assess-intro-course">{course.title}</p>

              <div className="assess-meta-grid">
                <div className="assess-meta-item">
                  <span className="meta-label">Questions</span>
                  <span className="meta-value">{questions.length}</span>
                </div>
                <div className="assess-meta-item">
                  <span className="meta-label">Pass Mark</span>
                  <span className="meta-value">{assessment.pass_percentage}%</span>
                </div>
                <div className="assess-meta-item">
                  <span className="meta-label">Time Limit</span>
                  <span className="meta-value">{assessment.time_limit_minutes ? `${assessment.time_limit_minutes} mins` : 'No limit'}</span>
                </div>
                <div className="assess-meta-item">
                  <span className="meta-label">Attempts</span>
                  <span className="meta-value">
                    {assessment.max_attempts ? `${attemptsUsed}/${assessment.max_attempts}` : `${attemptsUsed} used`}
                  </span>
                </div>
              </div>

              {hasPassed ? (
                <div className="assess-passed-banner">
                  <FiCheckCircle />
                  <div>
                    <strong>You've already passed!</strong>
                    <p>Score: {attempts.find(a => a.passed)?.score}%</p>
                  </div>
                  <button className="btn btn-primary" onClick={generateCertificate}><FiAward /> View Certificate</button>
                </div>
              ) : canAttempt ? (
                <>
                  <div className="assess-rules">
                    <h4><FiAlertCircle /> Instructions</h4>
                    <ul>
                      <li>All questions are multiple choice (MCQ).</li>
                      <li>You need at least <strong>{assessment.pass_percentage}%</strong> to pass.</li>
                      {assessment.time_limit_minutes && <li>You have <strong>{assessment.time_limit_minutes} minutes</strong> to complete.</li>}
                      {assessment.max_attempts && <li>You have <strong>{attemptsRemaining}</strong> attempt{attemptsRemaining !== 1 ? 's' : ''} remaining.</li>}
                      {assessment.shuffle_questions && <li>Questions will appear in random order.</li>}
                      <li>You cannot go back once you submit.</li>
                    </ul>
                  </div>
                  <button className="btn btn-primary btn-lg assess-start-btn" onClick={startQuiz}>
                    Start Assessment
                  </button>
                </>
              ) : (
                <div className="assess-maxed-banner">
                  <FiXCircle />
                  <div>
                    <strong>Maximum attempts reached</strong>
                    <p>You've used all {assessment.max_attempts} attempts. Contact your instructor for assistance.</p>
                  </div>
                </div>
              )}

              {/* Past attempts table */}
              {attempts.length > 0 && (
                <div className="assess-history">
                  <h4>Attempt History</h4>
                  <div className="assess-history-list">
                    {attempts.map((a, idx) => (
                      <div key={a.id} className={`assess-history-item ${a.passed ? 'passed' : 'failed'}`}>
                        <span className="attempt-num">#{attempts.length - idx}</span>
                        <span className="attempt-score">{a.score}%</span>
                        <span className={`attempt-badge ${a.passed ? 'pass' : 'fail'}`}>
                          {a.passed ? 'PASSED' : 'FAILED'}
                        </span>
                        <span className="attempt-date">
                          {new Date(a.submitted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {a.time_taken_seconds && <span className="attempt-time">{formatTime(a.time_taken_seconds)}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {activeCert && <Certificate certificateData={activeCert} onClose={() => setActiveCert(null)} />}
      </div>
    );
  }

  // ─── QUIZ PHASE ──────────────────────
  if (phase === 'quiz') {
    const q = questions[currentQ];
    const answeredCount = Object.keys(answers).length;
    const progress = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
    const isTimeLow = timeLeft !== null && timeLeft <= 60;

    return (
      <div className="assess-page section">
        <div className="assess-quiz-layout">
          {/* Timer & progress bar */}
          <div className={`assess-topbar ${isTimeLow ? 'urgent' : ''}`}>
            <div className="assess-topbar-left">
              <span className="assess-course-tag">{course.title}</span>
              <span className="assess-q-counter">
                Question {currentQ + 1} of {questions.length}
              </span>
            </div>
            <div className="assess-topbar-right">
              {timeLeft !== null && (
                <div className={`assess-timer ${isTimeLow ? 'low' : ''}`}>
                  <FiClock /> {formatTime(timeLeft)}
                </div>
              )}
              <span className="assess-answered">{answeredCount}/{questions.length} answered</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="assess-progress-bar">
            <div className="assess-progress-fill" style={{ width: `${progress}%` }} />
          </div>

          {/* Question card */}
          <div className="assess-question-area">
            <div className="assess-question-card animate-fade">
              <div className="assess-q-number">Q{currentQ + 1}</div>
              <h2 className="assess-q-text">{q?.question_text}</h2>
              
              <div className="assess-options">
                {(q?.options || []).map((opt, idx) => (
                  <button
                    key={idx}
                    className={`assess-option ${answers[q.id] === idx ? 'selected' : ''}`}
                    onClick={() => selectAnswer(q.id, idx)}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + idx)}</span>
                    <span className="option-text">{opt}</span>
                    {answers[q.id] === idx && <FiCheckCircle className="option-check" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation */}
            <div className="assess-nav">
              <button 
                className="btn btn-outline" 
                disabled={currentQ === 0} 
                onClick={() => setCurrentQ(c => c - 1)}
              >
                <FiArrowLeft /> Previous
              </button>

              {currentQ < questions.length - 1 ? (
                <button className="btn btn-primary" onClick={() => setCurrentQ(c => c + 1)}>
                  Next <FiArrowRight />
                </button>
              ) : (
                <button 
                  className="btn btn-primary assess-submit-btn" 
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Assessment'}
                </button>
              )}
            </div>
          </div>

          {/* Question nav dots */}
          <div className="assess-q-dots">
            {questions.map((q, idx) => (
              <button
                key={q.id}
                className={`assess-q-dot ${currentQ === idx ? 'current' : ''} ${answers[q.id] !== undefined ? 'answered' : ''}`}
                onClick={() => setCurrentQ(idx)}
                title={`Question ${idx + 1}`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── RESULT PHASE ────────────────────
  if (phase === 'result' && result) {
    const isPassed = result.passed;
    const circumference = Math.PI * 104;
    const strokeDash = (result.score / 100) * circumference;

    return (
      <div className="assess-page section">
        <div className="container">
          <div className="assess-result animate-fade">
            <div className={`assess-result-card ${isPassed ? 'passed' : 'failed'}`}>
              <div className="assess-result-header">
                <div className={`assess-result-icon ${isPassed ? 'pass' : 'fail'}`}>
                  {isPassed ? <FiCheckCircle /> : <FiXCircle />}
                </div>
                <h1>{isPassed ? 'Congratulations!' : 'Not Quite There'}</h1>
                <p>{isPassed ? 'You passed the assessment!' : `You need ${assessment.pass_percentage}% to pass.`}</p>
              </div>

              {/* Score ring */}
              <div className="assess-score-ring">
                <svg viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gray-200)" strokeWidth="10" />
                  <circle cx="60" cy="60" r="52" fill="none"
                    stroke={isPassed ? '#10b981' : '#ef4444'}
                    strokeWidth="10"
                    strokeDasharray={`${strokeDash} ${circumference}`}
                    strokeLinecap="round"
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dasharray 1s ease-out' }}
                  />
                </svg>
                <span className="score-value">{result.score}%</span>
              </div>

              <div className="assess-result-stats">
                <div className="result-stat">
                  <span>Correct</span>
                  <strong className="text-success">{result.correct_count}</strong>
                </div>
                <div className="result-stat">
                  <span>Wrong</span>
                  <strong className="text-danger">{result.total_questions - result.correct_count}</strong>
                </div>
                <div className="result-stat">
                  <span>Total</span>
                  <strong>{result.total_questions}</strong>
                </div>
                {result.time_taken_seconds && (
                  <div className="result-stat">
                    <span>Time</span>
                    <strong>{formatTime(result.time_taken_seconds)}</strong>
                  </div>
                )}
              </div>

              <div className="assess-result-actions">
                {isPassed ? (
                  <button className="btn btn-primary btn-lg" onClick={generateCertificate}>
                    <FiAward /> Download Certificate
                  </button>
                ) : canAttempt ? (
                  <button className="btn btn-primary btn-lg" onClick={() => { setPhase('intro'); }}>
                    <FiRefreshCw /> Try Again ({attemptsRemaining - 1} left)
                  </button>
                ) : (
                  <div className="assess-maxed-inline">
                    <FiAlertCircle /> No attempts remaining
                  </div>
                )}
                <Link to={`/learn/${courseId}`} className="btn btn-outline">
                  <FiArrowLeft /> Back to Course
                </Link>
              </div>
            </div>
          </div>
        </div>
        {activeCert && <Certificate certificateData={activeCert} onClose={() => setActiveCert(null)} />}
      </div>
    );
  }

  return null;
}
