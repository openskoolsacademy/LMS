import { FiX, FiCheckCircle, FiXCircle, FiUser, FiClock, FiAward, FiInfo } from 'react-icons/fi';
import './DailyQuizManager.css';

export default function QuizAnalyticsModal({ quiz, attempt, questions, onClose }) {
  if (!attempt || !questions) return null;

  const rawAnswers = attempt.answers || {};

  // Extract the user's selected option from JSONB — handles both
  // { selected: N, time_spent: S } objects and plain number values
  const getUserAnswer = (qId) => {
    const entry = rawAnswers[qId];
    if (entry && typeof entry === 'object') return entry.selected;
    if (typeof entry === 'number') return entry;
    return undefined;
  };

  const correct = questions.filter(q => getUserAnswer(q.id) === q.correct_option).length;
  const total = questions.length;
  const scorePercent = Math.round((correct / total) * 100);
  const timeTaken = attempt.time_taken ? `${Math.floor(attempt.time_taken / 60)}m ${attempt.time_taken % 60}s` : '—';
  const submittedAt = attempt.submitted_at
    ? new Date(attempt.submitted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  return (
    <div className="qam-overlay" onClick={onClose}>
      <div className="qam-modal animate-fade" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="qam-header">
          <div className="qam-header-info">
            <div className="qam-header-title">
              <FiUser size={16} />
              <strong>{attempt.user_name || attempt.user_email || 'Student'}</strong>
            </div>
            <div className="qam-header-meta">
              <span><FiAward size={13} /> Score: <strong>{scorePercent}%</strong> ({correct}/{total})</span>
              <span><FiClock size={13} /> Time: <strong>{timeTaken}</strong></span>
              <span>Submitted: {submittedAt}</span>
            </div>
          </div>
          <button className="qam-close" onClick={onClose} aria-label="Close">
            <FiX size={20} />
          </button>
        </div>

        {/* Quiz title */}
        <div className="qam-quiz-title">{quiz?.title} — Answer Sheet</div>

        {/* Questions */}
        <div className="qam-questions">
          {questions.map((q, i) => {
            const userAns = getUserAnswer(q.id);
            const isCorrect = userAns === q.correct_option;
            const notAnswered = userAns === undefined || userAns === null;
            return (
              <div key={q.id} className={`qam-q-item ${isCorrect ? 'correct' : 'wrong'}`}>
                <div className="qam-q-top">
                  <span className="qam-q-num">Q{i + 1}</span>
                  <span className={`qam-q-status ${isCorrect ? 'pass' : 'fail'}`}>
                    {isCorrect ? <><FiCheckCircle /> Correct</> : <><FiXCircle /> {notAnswered ? 'Not Answered' : 'Wrong'}</>}
                  </span>
                </div>
                <p className="qam-q-text">{q.question_text}</p>
                <div className="qam-options">
                  {(q.options || []).map((opt, oi) => {
                    const isUserPick = userAns === oi;
                    const isRightAns = q.correct_option === oi;
                    let cls = 'qam-opt';
                    if (isRightAns) cls += ' qam-opt-correct';
                    else if (isUserPick && !isRightAns) cls += ' qam-opt-wrong';
                    return (
                      <div key={oi} className={cls}>
                        <span className="qam-opt-letter">{String.fromCharCode(65 + oi)}</span>
                        <span className="qam-opt-text">{opt}</span>
                        {isRightAns && <FiCheckCircle className="qam-opt-icon correct" />}
                        {isUserPick && !isRightAns && <FiXCircle className="qam-opt-icon wrong" />}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation block */}
                {q.explanation && (
                  <div className="qam-explanation-box">
                    <FiInfo size={13} />
                    <span>{q.explanation}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="qam-footer">
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
