import { useState, useEffect } from 'react';
import {
  FiPlus, FiTrash2, FiEdit2, FiCalendar, FiCheckCircle, FiXCircle,
  FiSave, FiFileText, FiClock, FiBarChart2, FiUsers, FiEye, FiEyeOff,
  FiAlertCircle, FiInfo, FiAward, FiTrendingUp, FiMessageSquare
} from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import QuizAnalyticsModal from './QuizAnalyticsModal';
import './DailyQuizManager.css';

const EMPTY_QUESTION = {
  question_text: '',
  options: ['', '', '', ''],
  correct_option: 0,
  order_index: 0,
  explanation: '',
};

// Helper: combine a date string + time string into a local ISO string
function toScheduledAt(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  return new Date(`${dateStr}T${timeStr}`).toISOString();
}

// Helper: extract date/time parts from an ISO string (local time)
function fromScheduledAt(iso) {
  if (!iso) return { date: '', time: '09:00' };
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export default function DailyQuizManager() {
  const { user } = useAuth();
  const { showAlert, showConfirm } = useAlert();

  const [quizzes, setQuizzes]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [quizForm, setQuizForm]       = useState({
    title: 'Daily Quiz Challenge', date: '', time: '09:00', is_active: true
  });
  const [scheduleError, setScheduleError] = useState('');
  const [questions, setQuestions]     = useState([{ ...EMPTY_QUESTION }]);
  const [saving, setSaving]           = useState(false);

  // Per-quiz expand states
  const [expandedQuiz, setExpandedQuiz]           = useState(null);
  const [quizQuestions, setQuizQuestions]         = useState({});
  const [expandedAnalytics, setExpandedAnalytics] = useState(null);
  const [analyticsData, setAnalyticsData]         = useState({});
  const [analyticsLoading, setAnalyticsLoading]   = useState({});

  // Answer-sheet modal
  const [sheetModal, setSheetModal] = useState(null); // { attempt, quiz, questions }

  useEffect(() => { loadQuizzes(); }, []);

  const loadQuizzes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('daily_quizzes')
      .select('*')
      .order('scheduled_at', { ascending: false, nullsFirst: false });
    setQuizzes(data || []);
    setLoading(false);
  };

  // ── Validate scheduled time is in the future ──────────────────
  const validateSchedule = (date, time) => {
    if (!date || !time) return 'Please set both date and time.';
    const dt = new Date(`${date}T${time}`);
    if (isNaN(dt.getTime())) return 'Invalid date or time.';
    if (dt <= new Date()) return 'Scheduled time must be in the future.';
    return '';
  };

  // ── Form open/close ───────────────────────────────────────────
  const openNew = () => {
    setEditingQuiz(null);
    const tom = new Date(); tom.setDate(tom.getDate() + 1);
    const pad = n => String(n).padStart(2, '0');
    const tDate = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
    setQuizForm({ title: 'Daily Quiz Challenge', date: tDate, time: '09:00', is_active: true });
    setScheduleError('');
    setQuestions([{ ...EMPTY_QUESTION }]);
    setShowForm(true);
  };

  const openEdit = async (quiz) => {
    setEditingQuiz(quiz);
    const { date, time } = fromScheduledAt(quiz.scheduled_at || (quiz.quiz_date + 'T09:00:00'));
    setQuizForm({ title: quiz.title, date, time, is_active: quiz.is_active });
    setScheduleError('');
    const { data } = await supabase
      .from('daily_quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('order_index');
    setQuestions(data?.length > 0
      ? data.map(q => ({
          ...q,
          options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
          explanation: q.explanation || '',
        }))
      : [{ ...EMPTY_QUESTION }]
    );
    setShowForm(true);
  };

  // ── Question helpers ──────────────────────────────────────────
  const addQuestion    = () => setQuestions(p => [...p, { ...EMPTY_QUESTION, order_index: p.length }]);
  const removeQuestion = (i) => setQuestions(p => p.filter((_, j) => j !== i));
  const updateQuestion = (i, field, val) => setQuestions(p => p.map((q, j) => j === i ? { ...q, [field]: val } : q));
  const updateOption   = (qi, oi, val) => setQuestions(p => p.map((q, i) => {
    if (i !== qi) return q;
    const opts = [...q.options]; opts[oi] = val; return { ...q, options: opts };
  }));

  // ── Save quiz ─────────────────────────────────────────────────
  const handleSave = async () => {
    const err = validateSchedule(quizForm.date, quizForm.time);
    if (err) { setScheduleError(err); return; }

    const validQs = questions.filter(q => q.question_text.trim() && q.options.every(o => o.trim()));
    if (validQs.length === 0) {
      await showAlert('Add at least one complete question.', 'No Questions', 'warning');
      return;
    }

    // Validate: every question must have an explanation
    const missingExplanation = validQs.findIndex(q => !q.explanation || !q.explanation.trim());
    if (missingExplanation !== -1) {
      await showAlert(
        `Question ${missingExplanation + 1} is missing an explanation. All questions must have an explanation before publishing.`,
        'Explanation Required',
        'warning'
      );
      return;
    }

    const scheduledAt = toScheduledAt(quizForm.date, quizForm.time);

    setSaving(true);
    try {
      let quizId;
      if (editingQuiz) {
        const { error } = await supabase.from('daily_quizzes').update({
          title: quizForm.title,
          quiz_date: quizForm.date,
          scheduled_at: scheduledAt,
          is_active: quizForm.is_active,
        }).eq('id', editingQuiz.id);
        if (error) throw error;
        quizId = editingQuiz.id;
        await supabase.from('daily_quiz_questions').delete().eq('quiz_id', quizId);
      } else {
        const { data, error } = await supabase.from('daily_quizzes').insert([{
          title: quizForm.title,
          quiz_date: quizForm.date,
          scheduled_at: scheduledAt,
          is_active: quizForm.is_active,
          created_by: user.id,
        }]).select().single();
        if (error) throw error;
        quizId = data.id;
      }

      const qPayload = validQs.map((q, i) => ({
        quiz_id: quizId,
        question_text: q.question_text,
        options: q.options,
        correct_option: Number(q.correct_option),
        order_index: i,
        explanation: q.explanation.trim(),
      }));
      const { error: qErr } = await supabase.from('daily_quiz_questions').insert(qPayload);
      if (qErr) throw qErr;

      await showAlert(`Quiz ${editingQuiz ? 'updated' : 'scheduled'} successfully!`, 'Success', 'success');
      setShowForm(false);
      setQuizQuestions({});
      setAnalyticsData({});
      loadQuizzes();
    } catch (err) {
      await showAlert('Error saving quiz: ' + err.message, 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = async (quizId) => {
    const ok = await showConfirm('Delete this quiz and all its questions?', undefined, 'Delete Quiz', 'Delete', 'Cancel');
    if (!ok) return;
    await supabase.from('daily_quizzes').delete().eq('id', quizId);
    setQuizzes(p => p.filter(q => q.id !== quizId));
    await showAlert('Quiz deleted.', 'Deleted', 'success');
  };

  // ── Toggle active ─────────────────────────────────────────────
  const toggleActive = async (quiz) => {
    await supabase.from('daily_quizzes').update({ is_active: !quiz.is_active }).eq('id', quiz.id);
    setQuizzes(p => p.map(q => q.id === quiz.id ? { ...q, is_active: !q.is_active } : q));
  };

  // ── Load question preview ─────────────────────────────────────
  const loadQuizQuestions = async (quizId) => {
    if (quizQuestions[quizId]) {
      setExpandedQuiz(expandedQuiz === quizId ? null : quizId);
      return;
    }
    const { data } = await supabase.from('daily_quiz_questions').select('*').eq('quiz_id', quizId).order('order_index');
    setQuizQuestions(p => ({ ...p, [quizId]: data || [] }));
    setExpandedQuiz(quizId);
  };

  // ── Load analytics ────────────────────────────────────────────
  const loadAnalytics = async (quiz) => {
    const quizId = quiz.id;
    if (expandedAnalytics === quizId) { setExpandedAnalytics(null); return; }

    setExpandedAnalytics(quizId);
    if (analyticsData[quizId]) return;

    setAnalyticsLoading(p => ({ ...p, [quizId]: true }));
    try {
      const { data: attempts } = await supabase
        .from('daily_quiz_attempts')
        .select('*, user:users(name, email)')
        .eq('quiz_date', quiz.quiz_date)
        .order('score', { ascending: false });

      let qs = quizQuestions[quizId];
      if (!qs) {
        const { data: qd } = await supabase.from('daily_quiz_questions').select('*').eq('quiz_id', quizId).order('order_index');
        qs = qd || [];
        setQuizQuestions(p => ({ ...p, [quizId]: qs }));
      }

      const enriched = (attempts || []).map(a => ({
        ...a,
        user_name:  a.user?.name  || '—',
        user_email: a.user?.email || '—',
      }));

      const totalAttempts = enriched.length;
      const avgScore      = totalAttempts ? Math.round(enriched.reduce((s, a) => s + (a.score || 0), 0) / totalAttempts) : 0;
      const highScore     = totalAttempts ? Math.max(...enriched.map(a => a.score || 0)) : 0;

      setAnalyticsData(p => ({
        ...p,
        [quizId]: { attempts: enriched, questions: qs, totalAttempts, avgScore, highScore },
      }));
    } finally {
      setAnalyticsLoading(p => ({ ...p, [quizId]: false }));
    }
  };

  // ── Formatted schedule time ───────────────────────────────────
  const fmtScheduled = (quiz) => {
    const iso = quiz.scheduled_at || (quiz.quiz_date ? quiz.quiz_date + 'T09:00:00' : null);
    if (!iso) return null;
    return new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const fmtTime = (sec) => sec != null ? `${Math.floor(sec / 60)}m ${sec % 60}s` : '—';

  // ── Form view ─────────────────────────────────────────────────
  if (showForm) {
    const schedErr = scheduleError;
    return (
      <div className="dqm-form animate-fade">
        <div className="dqm-form-header">
          <h3>{editingQuiz ? 'Edit Scheduled Quiz' : 'Schedule New Daily Quiz'}</h3>
          <button className="btn btn-outline btn-sm" onClick={() => setShowForm(false)}>Cancel</button>
        </div>

        <div className="dqm-form-meta">
          {/* Title */}
          <div className="form-group" style={{ gridColumn: 'span 4' }}>
            <label>Quiz Title</label>
            <input
              type="text"
              value={quizForm.title}
              onChange={e => setQuizForm(p => ({ ...p, title: e.target.value }))}
            />
          </div>

          {/* Date */}
          <div className="form-group">
            <label><FiCalendar size={13} style={{ marginRight: 4 }} />Schedule Date</label>
            <DatePicker
              selected={quizForm.date ? new Date(`${quizForm.date}T12:00:00`) : null}
              onChange={date => {
                if (!date) return;
                const pad = n => String(n).padStart(2, '0');
                const dStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
                setQuizForm(p => ({ ...p, date: dStr }));
                setScheduleError(validateSchedule(dStr, quizForm.time));
              }}
              dateFormat="MM/dd/yyyy"
              placeholderText="Select a date"
            />
          </div>

          {/* Time */}
          <div className="form-group">
            <label><FiClock size={13} style={{ marginRight: 4 }} />Schedule Time</label>
            <input
              type="time"
              value={quizForm.time}
              onChange={e => {
                setQuizForm(p => ({ ...p, time: e.target.value }));
                setScheduleError(validateSchedule(quizForm.date, e.target.value));
              }}
            />
            {schedErr
              ? <div className="dqm-schedule-note error"><FiAlertCircle size={12} /> {schedErr}</div>
              : quizForm.date && quizForm.time && (
                  <div className="dqm-schedule-note"><FiInfo size={12} /> Must be a future date &amp; time</div>
                )
            }
          </div>

          {/* Active */}
          <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: 22 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 0 }}>
              <input
                type="checkbox"
                checked={quizForm.is_active}
                onChange={e => setQuizForm(p => ({ ...p, is_active: e.target.checked }))}
                style={{ width: 18, height: 18 }}
              />
              Active (visible to students)
            </label>
          </div>
        </div>

        {/* Explanation requirement notice */}
        <div className="dqm-explanation-notice">
          <FiInfo size={14} />
          <span>An <strong>Explanation</strong> is required for every question before publishing. Students will see this after submitting.</span>
        </div>

        {/* Questions */}
        <div className="dqm-questions">
          <div className="dqm-q-header">
            <h4>Questions ({questions.length})</h4>
          </div>

          {questions.map((q, qi) => (
            <div key={qi} className="dqm-q-card">
              <div className="dqm-q-top">
                <span className="dqm-q-label">Q{qi + 1}</span>
                <button className="dqm-q-remove" onClick={() => removeQuestion(qi)} disabled={questions.length === 1}>
                  <FiTrash2 />
                </button>
              </div>
              <textarea
                className="dqm-q-text-input"
                placeholder="Enter question text..."
                value={q.question_text}
                onChange={e => updateQuestion(qi, 'question_text', e.target.value)}
                rows={2}
              />
              <div className="dqm-options-grid">
                {(q.options || ['', '', '', '']).map((opt, oi) => (
                  <div key={oi} className={`dqm-option-row ${q.correct_option === oi ? 'correct' : ''}`}>
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={q.correct_option === oi}
                      onChange={() => updateQuestion(qi, 'correct_option', oi)}
                      title="Mark as correct"
                    />
                    <span className="dqm-opt-letter">{String.fromCharCode(65 + oi)}</span>
                    <input
                      type="text"
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      value={opt}
                      onChange={e => updateOption(qi, oi, e.target.value)}
                      className="dqm-opt-input"
                    />
                    {q.correct_option === oi && <span className="dqm-correct-tag"><FiCheckCircle size={12} /> Correct</span>}
                  </div>
                ))}
              </div>

              {/* Explanation Field */}
              <div className="dqm-explanation-field">
                <label className="dqm-explanation-label">
                  <FiMessageSquare size={13} />
                  Explanation / Reason
                  <span className="dqm-explanation-required">Required</span>
                </label>
                <textarea
                  className={`dqm-explanation-input ${!q.explanation?.trim() ? 'missing' : ''}`}
                  placeholder="Explain why the correct answer is right. Students will see this after submitting the quiz."
                  value={q.explanation || ''}
                  onChange={e => updateQuestion(qi, 'explanation', e.target.value)}
                  rows={3}
                />
                {!q.explanation?.trim() && (
                  <div className="dqm-explanation-hint">
                    <FiAlertCircle size={11} /> Explanation is required to publish this quiz.
                  </div>
                )}
              </div>
            </div>
          ))}

          <button className="dqm-add-q-btn" onClick={addQuestion}>
            <FiPlus size={18} /> Add New Question
          </button>
        </div>

        <div className="dqm-form-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !!schedErr}>
            <FiSave /> {saving ? 'Saving...' : editingQuiz ? 'Update Quiz' : 'Schedule Quiz'}
          </button>
          <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────────────
  return (
    <div className="dqm animate-fade">
      <div className="dqm-header">
        <div>
          <h3>Daily Quiz Manager</h3>
          <p>Schedule and manage daily quiz challenges for students.</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <FiPlus /> Schedule Quiz
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
          Loading quizzes...
        </div>
      ) : quizzes.length === 0 ? (
        <div className="dqm-empty">
          <div style={{ fontSize: '3rem', marginBottom: 16, color: '#008ad1' }}><FiFileText /></div>
          <h4>No quizzes yet</h4>
          <p>Schedule your first daily quiz to get started.</p>
          <button className="btn btn-primary" onClick={openNew}><FiPlus /> Schedule Quiz</button>
        </div>
      ) : (
        <div className="dqm-list">
          {quizzes.map(quiz => {
            const an = analyticsData[quiz.id];
            const anLoading = analyticsLoading[quiz.id];
            const scheduled = fmtScheduled(quiz);

            return (
              <div key={quiz.id} className="dqm-quiz-row">
                {/* Main row */}
                <div className="dqm-quiz-main">
                  <div className="dqm-quiz-info">
                    <div className="dqm-quiz-date">
                      <FiCalendar />
                      <span>{new Date(quiz.quiz_date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {quiz.quiz_date === (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`; })() && (
                        <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>TODAY</span>
                      )}
                    </div>
                    {scheduled && (
                      <div className="dqm-quiz-scheduled">
                        <FiClock size={12} /> Goes live: {scheduled}
                      </div>
                    )}
                    <div className="dqm-quiz-title">{quiz.title}</div>
                  </div>

                  <div className="dqm-quiz-actions">
                    <span
                      className={`badge ${quiz.is_active ? 'badge-success' : 'badge-warning'}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => toggleActive(quiz)}
                      title="Click to toggle active status"
                    >
                      {quiz.is_active ? <><FiCheckCircle /> Active</> : <><FiXCircle /> Inactive</>}
                    </span>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => loadAnalytics(quiz)}
                      title="View attempt analytics"
                    >
                      <FiBarChart2 /> Analytics
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => loadQuizQuestions(quiz.id)}
                      title="Preview questions"
                    >
                      {expandedQuiz === quiz.id ? <><FiEyeOff /> Hide</> : <><FiEye /> Questions</>}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(quiz)} title="Edit quiz">
                      <FiEdit2 />
                    </button>
                    <button
                      className="btn btn-sm"
                      style={{ color: 'var(--danger)', border: '1px solid var(--gray-200)', borderRadius: 8 }}
                      onClick={() => handleDelete(quiz.id)}
                      title="Delete quiz"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>

                {/* Questions preview */}
                {expandedQuiz === quiz.id && quizQuestions[quiz.id] && (
                  <div className="dqm-q-preview">
                    {quizQuestions[quiz.id].length === 0 ? (
                      <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>No questions added.</p>
                    ) : quizQuestions[quiz.id].map((q, i) => (
                      <div key={q.id} className="dqm-q-preview-item">
                        <strong>Q{i + 1}.</strong> {q.question_text}
                        <div className="dqm-q-preview-opts">
                          {(q.options || []).map((o, oi) => (
                            <span key={oi} className={`dqm-qp-opt ${q.correct_option === oi ? 'correct' : ''}`}>
                              {String.fromCharCode(65 + oi)}. {o}
                            </span>
                          ))}
                        </div>
                        {q.explanation && (
                          <div className="dqm-q-preview-explanation">
                            <FiMessageSquare size={12} />
                            <span>{q.explanation}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Analytics panel */}
                {expandedAnalytics === quiz.id && (
                  <div className="dqm-analytics">
                    <div className="dqm-analytics-title">
                      <FiBarChart2 /> Quiz Analytics — {quiz.title}
                    </div>

                    {anLoading ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.875rem' }}>
                        Loading analytics...
                      </div>
                    ) : an ? (
                      <>
                        {/* Summary cards */}
                        <div className="dqm-summary-cards">
                          <div className="dqm-summary-card">
                            <div className="sc-icon"><FiUsers /></div>
                            <div className="sc-val">{an.totalAttempts}</div>
                            <div className="sc-label">Total Completions</div>
                          </div>
                          <div className="dqm-summary-card">
                            <div className="sc-icon"><FiTrendingUp /></div>
                            <div className="sc-val">{an.avgScore}%</div>
                            <div className="sc-label">Average Score</div>
                          </div>
                          <div className="dqm-summary-card">
                            <div className="sc-icon"><FiAward /></div>
                            <div className="sc-val">{an.highScore}%</div>
                            <div className="sc-label">Highest Score</div>
                          </div>
                        </div>

                        {/* Attempts table */}
                        {an.attempts.length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--gray-400)', fontSize: '0.875rem', background: 'var(--gray-50)', borderRadius: 8 }}>
                            No attempts yet for this quiz.
                          </div>
                        ) : (
                          <div className="dqm-attempts-table-wrap">
                            <table className="dqm-attempts-table">
                              <thead>
                                <tr>
                                  <th><FiUsers size={13} style={{ marginRight: 4 }} />Student</th>
                                  <th><FiAward size={13} style={{ marginRight: 4 }} />Score</th>
                                  <th>Correct</th>
                                  <th><FiClock size={13} style={{ marginRight: 4 }} />Time Taken</th>
                                  <th>Submitted At</th>
                                  <th>Answer Sheet</th>
                                </tr>
                              </thead>
                              <tbody>
                                {an.attempts.map(att => {
                                  const isPassing = (att.score || 0) >= 60;
                                  return (
                                    <tr key={att.id}>
                                      <td>
                                        <div style={{ fontWeight: 600, color: 'var(--gray-800)' }}>{att.user_name}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{att.user_email}</div>
                                      </td>
                                      <td>
                                        <span className={`dqm-score-pill ${isPassing ? 'pass' : 'fail'}`}>
                                          {att.score || 0}%
                                        </span>
                                      </td>
                                      <td style={{ color: 'var(--gray-600)' }}>
                                        {att.correct_count ?? '—'} / {an.questions.length}
                                      </td>
                                      <td style={{ color: 'var(--gray-600)' }}>{fmtTime(att.time_taken)}</td>
                                      <td style={{ color: 'var(--gray-500)', fontSize: '0.78rem' }}>
                                        {att.submitted_at
                                          ? new Date(att.submitted_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                          : '—'}
                                      </td>
                                      <td>
                                        <button
                                          className="btn btn-outline btn-sm"
                                          onClick={() => setSheetModal({ attempt: { ...att }, quiz, questions: an.questions })}
                                        >
                                          <FiEye /> View
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Answer Sheet Modal */}
      {sheetModal && (
        <QuizAnalyticsModal
          quiz={sheetModal.quiz}
          attempt={sheetModal.attempt}
          questions={sheetModal.questions}
          onClose={() => setSheetModal(null)}
        />
      )}
    </div>
  );
}
