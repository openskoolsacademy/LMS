import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiPlay, FiCheckCircle, FiCircle, FiChevronLeft, FiMaximize, FiVolume2, FiSkipForward, FiBookOpen, FiAward } from 'react-icons/fi';
import ReactPlayer from 'react-player';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import Loader from '../components/ui/Loader';
import './VideoLearning.css';

export default function VideoLearning() {
  const { id } = useParams();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [course, setCourse] = useState(null);
  const [curriculum, setCurriculum] = useState([]);
  const [activeLesson, setActiveLesson] = useState('');
  const [completed, setCompleted] = useState([]);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [tab, setTab] = useState(window.innerWidth <= 1024 ? 'lessons' : 'notes');
  const [loading, setLoading] = useState(true);
  const [hasAssessment, setHasAssessment] = useState(false);

  // Auto-switch tab if resizing screen to prevent empty state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1024 && tab === 'lessons') {
        setTab('notes');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tab]);

  useEffect(() => {
    async function loadCourse(retryCount = 0) {
      const MAX_RETRIES = 3;
      try {
        const { data: courseData, error: courseError } = await supabase.from('courses').select('*').eq('id', id).single();
        if (courseError) {
          console.error('VideoLearning: Course fetch error:', courseError);
          // Retry on transient errors (not on "row not found")
          if (courseError.code !== 'PGRST116' && retryCount < MAX_RETRIES) {
            console.log(`VideoLearning: Retrying in 1.5s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            setTimeout(() => loadCourse(retryCount + 1), 1500);
            return;
          }
          throw courseError;
        }
        
        const { data: lessonsData, error: lessonsError } = await supabase.from('lessons').select('*').eq('course_id', id).order('order_index', { ascending: true });
        if (lessonsError) throw lessonsError;

        if (user) {
          const [enrRes, complRes] = await Promise.all([
            supabase.from('enrollments').select('notes').eq('course_id', id).eq('user_id', user.id).single(),
            supabase.from('lesson_completions').select('lesson_id').eq('user_id', user.id)
          ]);
          
          if (enrRes.data && enrRes.data.notes) setNotes(enrRes.data.notes);
          if (complRes.data) setCompleted(complRes.data.map(c => c.lesson_id));

          // Log daily activity for streak
          await supabase.from('activity_log').upsert({
            user_id: user.id,
            activity_type: 'learning_session',
            activity_date: new Date().toISOString().split('T')[0]
          }, { onConflict: 'user_id,activity_date' });
        }

        setCourse(courseData);

        const grouped = (lessonsData || []).reduce((acc, lesson) => {
          const sec = (lesson.section_title && lesson.section_title !== 'General') ? lesson.section_title : '';
          if (!acc[sec]) acc[sec] = [];
          acc[sec].push(lesson);
          return acc;
        }, {});

        const curr = Object.entries(grouped).map(([title, sectionLessons]) => ({
          title,
          lessons: sectionLessons
        }));
        
        setCurriculum(curr);
        if (curr.length > 0 && curr[0].lessons.length > 0) {
          setActiveLesson(curr[0].lessons[0].id);
        }
      } catch (err) {
        console.error("VideoLearning: Error loading course:", err);
        if (retryCount < MAX_RETRIES) {
          console.log(`VideoLearning: Retrying after error in 1.5s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => loadCourse(retryCount + 1), 1500);
          return;
        }
      } finally {
        setLoading(false);
      }
    }
    loadCourse();
  }, [id]);

  // Check if assessment exists for this course
  useEffect(() => {
    async function checkAssessment() {
      const { data } = await supabase
        .from('assessments')
        .select('id')
        .eq('course_id', id)
        .eq('is_active', true)
        .single();
      setHasAssessment(!!data);
    }
    if (id) checkAssessment();
  }, [id]);

  // All hooks MUST be called before any early returns (React Rules of Hooks)
  const toggleComplete = async (lid) => {
    if (!user) return;
    const isCompleted = completed.includes(lid);
    
    // Optimistic UI update
    setCompleted(prev => isCompleted ? prev.filter(x => x !== lid) : [...prev, lid]);

    try {
      if (isCompleted) {
        await supabase.from('lesson_completions').delete().eq('user_id', user.id).eq('lesson_id', lid);
      } else {
        await supabase.from('lesson_completions').insert([{ user_id: user.id, lesson_id: lid }]);
      }
    } catch (err) {
      console.error("Error toggling completion:", err);
      // Revert on error
      setCompleted(prev => isCompleted ? [...prev, lid] : prev.filter(x => x !== lid));
    }
  };

  const markComplete = useCallback(async (lid) => {
    if (!lid || !user) return;
    if (completed.includes(lid)) return;

    setCompleted(prev => [...prev, lid]);
    try {
      await supabase.from('lesson_completions').insert([{ user_id: user.id, lesson_id: lid }]);
    } catch (err) {
      console.error("Error marking completion:", err);
    }
  }, [user, completed]);

  const allLessons = curriculum.flatMap(s => s.lessons);
  const currentLesson = allLessons.find(l => l.id === activeLesson);

  // Safely extract YouTube video IDs
  const getYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? match[1] : null;
  };

  // Safely extract Google Drive file IDs
  const getDriveId = (url) => {
    if (!url) return null;
    const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const ytId = getYouTubeId(currentLesson?.video_url);
  const driveId = getDriveId(currentLesson?.video_url);

  // Timer-based auto-completion for Google Drive videos
  const driveTimerRef = useRef(null);
  useEffect(() => {
    if (driveTimerRef.current) {
      clearTimeout(driveTimerRef.current);
      driveTimerRef.current = null;
    }
    if (driveId && currentLesson?.id) {
      const durationMinutes = currentLesson.duration || 1;
      const durationMs = durationMinutes * 60 * 1000;
      driveTimerRef.current = setTimeout(() => {
        markComplete(currentLesson.id);
      }, durationMs);
    }
    return () => {
      if (driveTimerRef.current) clearTimeout(driveTimerRef.current);
    };
  }, [activeLesson, driveId, currentLesson?.id, currentLesson?.duration, markComplete]);

  // Early returns AFTER all hooks
  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;
  if (!course) return <div className="container section"><h2>Course not found</h2><Link to="/courses" className="btn btn-primary">Browse Courses</Link></div>;

  // Only count completed lessons that belong to this specific course
  const courseCompletedLessons = allLessons.filter(l => completed.includes(l.id));
  const progress = allLessons.length > 0 ? Math.round((courseCompletedLessons.length / allLessons.length) * 100) : 0;
  console.log('[VideoLearning Debug]', { allLessonsCount: allLessons.length, completedCount: completed.length, courseCompletedCount: courseCompletedLessons.length, progress, hasAssessment });

  return (
    <div className="vl-page">
      {/* Video Area */}
      <div className="vl-player">
        <div className="vl-player__header">
          <Link to={`/courses/${course.id}`} className="vl-back"><FiChevronLeft /> Back</Link>
          <span className="vl-course-title">{course.title}</span>
        </div>
        <div className="vl-video">
          <div className="vl-video__screen">
            {currentLesson?.video_url ? (
              <div style={{width: '100%', height: '100%', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center'}} key={currentLesson.id}>
                {ytId ? (
                  <ReactPlayer
                    key={`yt-${currentLesson.id}`}
                    url={`https://www.youtube.com/watch?v=${ytId}`}
                    width="100%" height="100%"
                    controls
                    playing
                    onEnded={() => markComplete(currentLesson.id)}
                  />
                ) : driveId ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }} key={`drive-wrap-${currentLesson.id}`}>
                    <iframe 
                      key={`drive-${currentLesson.id}`}
                      width="100%" height="100%" 
                      src={`https://drive.google.com/file/d/${driveId}/preview?rm=minimal`} 
                      frameBorder="0" allow="autoplay" allowFullScreen 
                    />
                    {/* Invisible overlay blocking the top-right Google Drive 'pop-out' button to prevent downloads */}
                    <div 
                      title="Video protected"
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: '70px',
                        height: '70px',
                        background: 'transparent',
                        zIndex: 10,
                        cursor: 'default'
                      }} 
                    />
                  </div>
                ) : (
                  <video 
                    key={`vid-${currentLesson.id}`}
                    src={currentLesson.video_url} 
                    controls 
                    width="100%" height="100%" style={{objectFit: 'contain'}} 
                    onEnded={() => markComplete(currentLesson.id)}
                  />
                )}
              </div>
            ) : (
              <div className="vl-video__placeholder">
                <FiPlay className="vl-play-icon" />
                <h3>{currentLesson?.title || 'Select a lesson'}</h3>
                <p>No video linked to this lesson.</p>
              </div>
            )}
          </div>
        </div>

        {/* Below player tabs */}
        <div className="vl-below">
          <div className="vl-tabs">
            <button className={`vl-tab vl-tab-lessons ${tab === 'lessons' ? 'active' : ''}`} onClick={() => setTab('lessons')}>Lessons</button>
            <button className={`vl-tab ${tab === 'notes' ? 'active' : ''}`} onClick={() => setTab('notes')}>Notes</button>
            <button className={`vl-tab ${tab === 'resources' ? 'active' : ''}`} onClick={() => setTab('resources')}>Resources</button>
          </div>

          {/* Mobile lessons (shown below player on mobile) */}
          {tab === 'lessons' && (
            <div className="vl-lessons-mobile">
              {curriculum.map((section, si) => (
                <div key={si} className="vl-section-mobile">
                  {section.title && section.title !== 'General' && <h4>{section.title}</h4>}
                  {section.lessons.map(lesson => (
                    <button
                      key={lesson.id}
                      className={`vl-lesson-btn ${activeLesson === lesson.id ? 'active' : ''}`}
                      onClick={() => setActiveLesson(lesson.id)}
                    >
                      <span className="vl-lesson-check">
                        {completed.includes(lesson.id) ? <FiCheckCircle className="completed" /> : <FiCircle />}
                      </span>
                      <span className="vl-lesson-title">{lesson.title}</span>
                      <span className="vl-lesson-dur">{lesson.duration ? `${lesson.duration}m` : ''}</span>
                    </button>
                  ))}
                </div>
              ))}
              
              {/* Mobile Assessment Banner */}
              {progress >= 100 && (
                <div style={{ marginTop: '24px' }}>
                  {hasAssessment ? (
                    <Link to={`/assessment/${course.id}`} className="vl-assessment-banner" style={{ margin: '0' }}>
                      <FiAward className="vl-assess-icon" />
                      <div>
                        <strong>Take Assessment</strong>
                        <span>Pass to unlock your certificate</span>
                      </div>
                    </Link>
                  ) : (
                    <Link to={`/dashboard?tab=certificates`} className="vl-assessment-banner vl-complete-banner" style={{ margin: '0' }}>
                      <FiCheckCircle className="vl-assess-icon" />
                      <div>
                        <strong>Course Completed!</strong>
                        <span>View your certificate</span>
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'notes' && (
            <div className="vl-notes">
              {currentLesson?.notes && (
                <div className="instructor-notes" style={{ marginBottom: '24px', padding: '16px', background: '#f8fafc', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Instructor Notes</h4>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{currentLesson.notes}</p>
                </div>
              )}
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Your Personal Notes</h4>
              <textarea
                placeholder="Type your notes here..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
              />
              <button 
                className="btn btn-primary btn-sm" 
                disabled={savingNotes}
                onClick={async () => {
                  if (!user) { await showAlert('You must be logged in to save notes.', 'Login Required', 'warning'); return; }
                  setSavingNotes(true);
                  try {
                    const { error } = await supabase.from('enrollments').update({ notes }).eq('course_id', course.id).eq('user_id', user.id);
                    if (error) throw error;
                    await showAlert('Notes saved successfully!', 'Saved', 'success');
                  } catch (err) {
                    console.error("Save notes error:", err);
                    await showAlert("Error saving notes.", 'Save Error', 'error');
                  } finally {
                    setSavingNotes(false);
                  }
                }}
              >
                {savingNotes ? 'Saving...' : 'Save Notes'}
              </button>
            </div>
          )}

          {tab === 'resources' && (
            <div className="vl-resources">
              {currentLesson?.resources ? (
                <div className="resources-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {String(currentLesson.resources).split('\n').filter(r => r.trim()).map((res, idx) => (
                    <a key={idx} href={res.trim()} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', textDecoration: 'none', color: 'var(--primary)', border: '1px solid #e2e8f0', transition: 'all 0.2s' }}>
                      <FiBookOpen style={{ marginRight: '12px', fontSize: '18px' }} />
                      <span style={{ wordBreak: 'break-all' }}>{res.trim()}</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-muted">No resources available for this lesson.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <aside className="vl-sidebar">
        <div className="vl-sidebar__header">
          <h3>Course Content</h3>
          <div className="vl-progress-info">
            <div className="vl-progress-ring">
              <span>{progress}%</span>
            </div>
            <span>{courseCompletedLessons.length}/{allLessons.length} completed</span>
          </div>
        </div>



        <div className="vl-sidebar__lessons">
          {curriculum.map((section, si) => (
            <div key={si} className="vl-sidebar-section">
              {section.title && section.title !== 'General' && <h4 className="vl-sidebar-section-title">{section.title}</h4>}
              {section.lessons.map(lesson => (
                <button
                  key={lesson.id}
                  className={`vl-sidebar-lesson ${activeLesson === lesson.id ? 'active' : ''} ${completed.includes(lesson.id) ? 'done' : ''}`}
                  onClick={() => setActiveLesson(lesson.id)}
                >
                  <span className="vl-lesson-check">
                    {completed.includes(lesson.id) ? <FiCheckCircle className="completed" /> : <FiCircle />}
                  </span>
                  <div className="vl-sidebar-lesson-info">
                    <span className="vl-sidebar-lesson-name">{lesson.title}</span>
                    <span className="vl-sidebar-lesson-meta"><FiPlay /> {lesson.duration ? `${lesson.duration}m` : ''}</span>
                  </div>
                </button>
              ))}
            </div>
          ))}

          {/* Assessment/Certificate Banner - inside scrollable area */}
          {(progress >= 100) && (
            <div className="vl-sidebar__footer">
              {hasAssessment ? (
                <Link to={`/assessment/${course.id}`} className="vl-assessment-banner">
                  <FiAward className="vl-assess-icon" />
                  <div>
                    <strong>Take Assessment</strong>
                    <span>Pass to unlock your certificate</span>
                  </div>
                </Link>
              ) : (
                <Link to={`/dashboard?tab=certificates`} className="vl-assessment-banner vl-complete-banner">
                  <FiCheckCircle className="vl-assess-icon" />
                  <div>
                    <strong>Course Completed!</strong>
                    <span>View your certificate</span>
                  </div>
                </Link>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
