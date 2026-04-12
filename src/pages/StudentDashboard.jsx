import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiBookOpen, FiAward, FiUser, FiDownload, FiBarChart2, FiPlay, FiPlusCircle, FiFileText, FiZap, FiTrendingUp, FiDatabase, FiCheckCircle, FiTarget, FiLock, FiStar, FiVideo, FiCalendar, FiClock, FiExternalLink } from 'react-icons/fi';
import { FaFire, FaTrophy, FaCrown, FaSeedling } from 'react-icons/fa';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import GlobalBanner from '../components/ui/GlobalBanner';
import { generateUserCode } from '../utils/userCode';
import Certificate from '../components/ui/Certificate';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { mapCategory } from '../data/categories';
import { resolveImageUrl } from '../utils/imageUtils';
import './StudentDashboard.css';
import Loader from '../components/ui/Loader';


export default function StudentDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const { showAlert } = useAlert();
  const location = useLocation();
  const [tab, setTab] = useState('courses');
  const [enrollments, setEnrollments] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCert, setActiveCert] = useState(null);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileDob, setProfileDob] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileQualification, setProfileQualification] = useState('');
  const [profileExperience, setProfileExperience] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileContact, setProfileContact] = useState('');
  const [profileLinkedin, setProfileLinkedin] = useState('');
  const [saving, setSaving] = useState(false);
  const [streakDays, setStreakDays] = useState([false, false, false, false, false, false, false]); // M-S indicators
  const [streakCount, setStreakCount] = useState(0);
  const [courseAssessments, setCourseAssessments] = useState({}); // { courseId: assessmentData }
  const [passedAssessments, setPassedAssessments] = useState({}); // { courseId: true }
  // Gamification state
  const [userPoints, setUserPoints] = useState(0);
  const [userStreak, setUserStreak] = useState(0);
  const [todayAttempt, setTodayAttempt] = useState(null);
  const [topLeaders, setTopLeaders] = useState([]);
  const [userRewards, setUserRewards] = useState([]);
  // Events state
  const [userEvents, setUserEvents] = useState([]);
  const [userEventAttendance, setUserEventAttendance] = useState({});
  // Bootcamp state
  const [userBootcamps, setUserBootcamps] = useState([]);
  const [userBootcampEnrollments, setUserBootcampEnrollments] = useState({});
  const [activeCertEvent, setActiveCertEvent] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['courses', 'progress', 'certificates', 'events', 'bootcamps', 'quiz', 'profile'].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    if (user) {
      fetchEnrollments();
      fetchCertificates();
      fetchStreak();
      fetchAssessmentStatus();
      fetchGamificationData();
      fetchUserEvents();
      fetchUserBootcamps();
    }
  }, [user]);

  // Fetch assessment existence and passed status for all enrolled courses
  const fetchAssessmentStatus = async () => {
    try {
      // Get all active assessments
      const { data: assessments } = await supabase
        .from('assessments').select('id, course_id').eq('is_active', true);
      
      const assessMap = {};
      (assessments || []).forEach(a => { assessMap[a.course_id] = a; });
      setCourseAssessments(assessMap);

      // Get passed attempts for this user
      const { data: passedAttempts } = await supabase
        .from('assessment_attempts').select('course_id').eq('user_id', user.id).eq('passed', true);
      
      const passedMap = {};
      (passedAttempts || []).forEach(a => { passedMap[a.course_id] = true; });
      setPassedAssessments(passedMap);
    } catch (err) {
      console.error('Error fetching assessment status:', err);
    }
  };

  const fetchGamificationData = async () => {
    try {
      // Use local date (not UTC)
      const _n = new Date();
      const todayStr = `${_n.getFullYear()}-${String(_n.getMonth() + 1).padStart(2, '0')}-${String(_n.getDate()).padStart(2, '0')}`;
      const [pts, streak, attempt, leaders, rewards] = await Promise.all([
        supabase.from('user_points').select('total_points').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_streaks').select('current_streak').eq('user_id', user.id).maybeSingle(),
        supabase.from('daily_quiz_attempts').select('*').eq('user_id', user.id).eq('quiz_date', todayStr).maybeSingle(),
        supabase.from('user_points').select('user_id, total_points').order('total_points', { ascending: false }).limit(5),
        supabase.from('user_rewards').select('*').eq('user_id', user.id)
      ]);
      setUserPoints(pts.data?.total_points || 0);
      setUserStreak(streak.data?.current_streak || 0);
      setTodayAttempt(attempt.data || null);
      setUserRewards(rewards.data || []);
      // Enrich leaders with names
      if (leaders.data?.length) {
        const ids = leaders.data.map(l => l.user_id);
        const { data: users } = await supabase.from('users').select('id, name').in('id', ids);
        const uMap = Object.fromEntries((users || []).map(u => [u.id, u.name]));
        setTopLeaders(leaders.data.map(l => ({ ...l, name: uMap[l.user_id] || 'Unknown' })));
      }
    } catch { /* gamification tables may not exist yet */ }
  };

  const fetchUserEvents = async () => {
    try {
      const { data: eventsData } = await supabase.from('events').select('*').order('event_date', { ascending: false });
      setUserEvents(eventsData || []);
      const { data: attData } = await supabase.from('event_attendance').select('*').eq('user_id', user.id);
      const attMap = {};
      (attData || []).forEach(a => { attMap[a.event_id] = a; });
      setUserEventAttendance(attMap);
    } catch { /* events table may not exist yet */ }
  };

  const fetchUserBootcamps = async () => {
    try {
      const { data: bootcampData } = await supabase.from('live_bootcamps').select('*').order('start_date', { ascending: false });
      setUserBootcamps(bootcampData || []);
      const { data: enrollData } = await supabase.from('live_bootcamp_enrollments').select('*').eq('user_id', user.id);
      const enrollMap = {};
      (enrollData || []).forEach(e => { enrollMap[e.live_bootcamp_id] = e; });
      setUserBootcampEnrollments(enrollMap);
    } catch { /* live_bootcamps table may not exist yet */ }
  };

  const formInitialized = useRef(false);

  useEffect(() => {
    if (profile && !formInitialized.current) {
      setProfileName(profile.name || '');
      setProfileBio(profile.bio || '');
      setProfileDob(profile.dob || '');
      setProfileGender(profile.gender || '');
      setProfileQualification(profile.qualification || '');
      setProfileExperience(profile.experience || '');
      setProfileLocation(profile.location || '');
      setProfileContact(profile.contact_number || '');
      setProfileLinkedin(profile.linkedin_url || '');
      formInitialized.current = true;
    }
  }, [profile]);

  const fetchEnrollments = async () => {
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(`
          progress,
          status,
          course:courses(
            id, title, category, thumbnail_url,
            instructor:users(name)
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      setEnrollments(data || []);
    } catch (error) {
      console.error('Error fetching enrollments:', error);
    } finally {
      if (certificates) setLoading(false);
    }
  };

  const fetchCertificates = async () => {
    const { data } = await supabase.from('certificate_logs').select('*').eq('user_id', user?.id || '');
    setCertificates(data || []);
  };

  const fetchStreak = async () => {
    try {
      const today = new Date();
      const lastWeek = new Date(today);
      lastWeek.setDate(today.getDate() - 7);

      const { data, error } = await supabase
        .from('activity_log')
        .select('activity_date')
        .eq('user_id', user.id)
        .gte('activity_date', lastWeek.toISOString().split('T')[0]);

      if (error) throw error;

      // Calculate indicators for Mon-Sun (mapped to current week)
      const currentDay = today.getDay(); // 0 (Sun) to 6 (Sat)
      const monday = new Date(today);
      monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));

      const indicators = [0, 1, 2, 3, 4, 5, 6].map(offset => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + offset);
        const dateStr = d.toISOString().split('T')[0];
        return data.some(a => a.activity_date === dateStr);
      });
      setStreakDays(indicators);

      // Calculate streak count (backward from today)
      let count = 0;
      let checkDate = new Date(today);
      while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (data.some(a => a.activity_date === dateStr)) {
          count++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
      setStreakCount(count);
    } catch (err) {
      console.error("Streak Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateCertificate = async (course) => {
    try {
      const { createStudentCertificate } = await import('../utils/certificateLogUtils');
      const certRecord = await createStudentCertificate(user, course.id, course.title, profile?.name);
      
      // Update state if newly created
      if (!certificates.find(c => c.course_id === course.id)) {
        setCertificates([...certificates, certRecord]);
      }

      // Open Modal
      setActiveCert({
        id: certRecord.certificate_id,
        studentName: profile?.name || user.email,
        courseTitle: course.title,
        issuedAt: certRecord.issued_at
      });

    } catch (err) {
      console.error("Certificate Generation Error:", err);
      await showAlert("Error generating certificate.", "Verification Failed", "error");
    }
  };

  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;

  const completedCount = enrollments.filter(e => e.status === 'completed').length;
  const overallProgress = enrollments.length 
    ? Math.round(enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / enrollments.length) 
    : 0;

  const eventCerts = certificates.filter(c => c.certificate_type === 'live');
  const bootcampCerts = certificates.filter(c => c.certificate_type === 'live_bootcamp');

  return (
    <div className="student-dash section">
      <div className="container">
        {/* Profile Banner */}
        <div className="sd-banner animate-fade">
          <div className="sd-banner-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <h2 style={{ marginBottom: 0, color: 'white' }}>{profile?.name}</h2>
              <span style={{ 
                fontFamily: "'Courier New', monospace", 
                fontSize: '.875rem', 
                fontWeight: 700, 
                color: 'rgba(255,255,255,0.95)', 
                background: 'rgba(255,255,255,0.2)', 
                padding: '4px 12px', 
                borderRadius: '6px', 
                letterSpacing: '.05em',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                ID: {generateUserCode(user?.id)}
              </span>
            </div>
            <p style={{ marginTop: 0, color: 'white', opacity: 0.85 }}>
              {profile?.bio 
                ? (profile.bio.length > 140 ? profile.bio.substring(0, 140) + '...' : profile.bio) 
                : 'Passionate learner.'}
            </p>
            <div className="sd-stats">
              <div className="sd-stat-card">
                <strong>{enrollments.length}</strong>
                <span>Enrolled</span>
              </div>
              <div className="sd-stat-card">
                <strong>{completedCount}</strong>
                <span>Completed</span>
              </div>
              <div className="sd-stat-card">
                <strong>{certificates.length}</strong>
                <span>Certificates</span>
              </div>
              <div className="sd-stat-card">
                <strong>{Object.values(userEventAttendance).filter(a => a.registered || a.attended).length}</strong>
                <span>Events</span>
              </div>
            </div>
          </div>
        </div>

        <GlobalBanner location="Dashboard" />

        {/* Tabs */}
        <div className="sd-tabs">
          <button className={`sd-tab ${tab === 'courses' ? 'active' : ''}`} onClick={() => setTab('courses')}><FiBookOpen /> My Courses</button>
          <button className={`sd-tab ${tab === 'progress' ? 'active' : ''}`} onClick={() => setTab('progress')}><FiBarChart2 /> Progress</button>
          <button className={`sd-tab ${tab === 'certificates' ? 'active' : ''}`} onClick={() => setTab('certificates')}><FiAward /> Certificates</button>
          <button className={`sd-tab ${tab === 'events' ? 'active' : ''}`} onClick={() => setTab('events')}><FiVideo /> Events</button>
          <button className={`sd-tab ${tab === 'bootcamps' ? 'active' : ''}`} onClick={() => setTab('bootcamps')}><FiBookOpen /> Bootcamps</button>
          <button className={`sd-tab ${tab === 'quiz' ? 'active' : ''}`} onClick={() => setTab('quiz')}><FiZap /> Quiz & Rewards</button>
          <button className={`sd-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}><FiUser /> Profile</button>
        </div>

        {/* Courses Tab */}
        {tab === 'courses' && (
          <div className="sd-courses animate-fade-in-up">
            {enrollments.length === 0 && <p>You haven't enrolled in any courses yet. <Link to="/courses">Browse courses</Link></p>}
            {enrollments.map((enr, idx) => (
              <div key={idx} className="sd-course-card">
                <img 
                  src={resolveImageUrl(enr.course?.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800'} 
                  alt={enr.course?.title}
                  className="sd-course-img"
                  onError={(e) => { e.target.onerror = null; e.target.src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800'; }}
                />
                <div className="sd-course-info">
                  <span className="sd-course-cat">{mapCategory(enr.course.category)}</span>
                  <h4>{enr.course.title}</h4>
                  <p>{enr.course.instructor?.name || 'Unknown Instructor'}</p>
                  <div className="sd-progress-row">
                    <div className="sd-progress-bar"><div className="sd-progress-fill" style={{ width: `${enr.progress}%` }} /></div>
                    <span>{enr.progress}% complete</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
                  <Link to={`/learn/${enr.course.id}`} className="btn btn-primary btn-sm"><FiPlay /> Continue</Link>
                  {enr.progress === 100 && (() => {
                    const hasAssessment = !!courseAssessments[enr.course.id];
                    const hasPassed = !!passedAssessments[enr.course.id];
                    
                    if (hasAssessment && hasPassed) {
                      return <button className="btn btn-outline btn-sm" onClick={() => generateCertificate(enr.course)}><FiAward /> View Certificate</button>;
                    } else if (hasAssessment && !hasPassed) {
                      return <Link to={`/assessment/${enr.course.id}`} className="btn btn-outline btn-sm" style={{borderColor: '#f59e0b', color: '#f59e0b'}}><FiFileText /> Take Assessment</Link>;
                    } else {
                      return <button className="btn btn-outline btn-sm" onClick={() => generateCertificate(enr.course)}><FiAward /> View Certificate</button>;
                    }
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Progress Tab */}
        {tab === 'progress' && (
          <div className="sd-progress animate-fade-in-up">
            <div className="sd-progress-overview">
              <div className="sd-progress-card">
                <h3>Overall Progress</h3>
                <div className="sd-big-ring">
                  <svg viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--gray-200)" strokeWidth="10" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="var(--primary)" strokeWidth="10"
                      strokeDasharray={`${Math.PI * 104 * (overallProgress / 100)} ${Math.PI * 104}`}
                      strokeLinecap="round" transform="rotate(-90 60 60)" />
                  </svg>
                  <span className="ring-value">{overallProgress}%</span>
                </div>
                <p>Keep going! You're making great progress.</p>
              </div>
              <div className="sd-progress-card">
                <h3>Learning Streak</h3>
                <div className="streak-days">
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <div key={i} className={`streak-day ${streakDays[i] ? 'active' : ''}`}>{d}</div>
                  ))}
                </div>
                <p><strong>{streakCount} day</strong> streak!</p>
              </div>
            </div>
            {enrollments.map((enr, idx) => (
              <div key={idx} className="sd-progress-item">
                <h4>{enr.course.title}</h4>
                <div className="sd-progress-row">
                  <div className="sd-progress-bar lg"><div className="sd-progress-fill" style={{ width: `${enr.progress}%` }} /></div>
                  <span>{enr.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Certificates Tab */}
        {tab === 'certificates' && (
          <div className="sd-certs animate-fade-in-up">
            {(() => {
              const completedEnrollments = enrollments.filter(e => e.status === 'completed');
              const hasAnyCert = completedEnrollments.length > 0 || eventCerts.length > 0 || bootcampCerts.length > 0;

              if (!hasAnyCert) {
                return (
                  <div className="cert-empty">
                    <p className="text-muted">Complete courses or attend live events to earn certificates!</p>
                  </div>
                );
              }

              return (
                <>
                  {/* Course Certificates */}
                  {completedEnrollments.map((enr, idx) => {
                    const hasCert = certificates.find(c => c.course_id === enr.course.id);
                    const hasAssessment = !!courseAssessments[enr.course.id];
                    const hasPassed = !!passedAssessments[enr.course.id];
                    const canGetCert = hasAssessment ? hasPassed : true;

                    return (
                     <div key={`course-${idx}`} className="certificate-card">
                        <div>
                          <h4 style={{ margin: '0 0 5px 0' }}>{enr.course.title}</h4>
                          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Instructor: {enr.course.instructor?.name || 'Unknown'}</p>
                          <span style={{ display: 'inline-block', marginTop: 6, fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 100, background: '#e0f2fe', color: '#008ad1' }}>Recorded Course</span>
                          {hasAssessment && !hasPassed && (
                            <p style={{ margin: '6px 0 0', color: '#f59e0b', fontSize: '13px', fontWeight: 600 }}>
                              <FiFileText style={{marginRight: 4}} /> Assessment required to unlock certificate
                            </p>
                          )}
                        </div>
                        <div>
                          {canGetCert ? (
                            hasCert ? (
                              <button className="btn btn-primary" onClick={() => generateCertificate(enr.course)}><FiDownload /> View & Download</button>
                            ) : (
                              <button className="btn btn-outline" onClick={() => generateCertificate(enr.course)}><FiPlusCircle /> Claim Certificate</button>
                            )
                          ) : (
                            <Link to={`/assessment/${enr.course.id}`} className="btn btn-primary"><FiFileText /> Take Assessment</Link>
                          )}
                        </div>
                     </div>
                    );
                  })}

                  {/* Event / Live Session Certificates */}
                  {eventCerts.map((cert, idx) => (
                    <div key={`event-${idx}`} className="certificate-card">
                      <div>
                        <h4 style={{ margin: '0 0 5px 0' }}>{cert.course_name}</h4>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                          Instructor: {cert.issued_by || 'Open Skools'}
                          {cert.issued_at && <> &middot; {new Date(cert.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                        </p>
                        <span style={{ display: 'inline-block', marginTop: 6, fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 100, background: '#e0f2fe', color: '#008ad1' }}>Live Event</span>
                      </div>
                      <div>
                        <button className="btn btn-primary" onClick={() => {
                          setActiveCert({
                            id: cert.certificate_id,
                            studentName: cert.student_name,
                            courseTitle: cert.course_name,
                            issuedAt: cert.issued_at,
                            certificateType: 'live'
                          });
                        }}><FiDownload /> View & Download</button>
                      </div>
                    </div>
                  ))}

                  {/* Bootcamp Certificates */}
                  {bootcampCerts.map((cert, idx) => (
                    <div key={`bootcamp-${idx}`} className="certificate-card">
                      <div>
                        <h4 style={{ margin: '0 0 5px 0' }}>{cert.course_name}</h4>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                          Instructor: {cert.issued_by || 'Open Skools'}
                          {cert.issued_at && <> &middot; {new Date(cert.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>}
                        </p>
                        <span style={{ display: 'inline-block', marginTop: 6, fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px', borderRadius: 100, background: '#f5f3ff', color: '#7c3aed' }}>Bootcamp</span>
                        {cert.start_date && cert.end_date && (
                          <p style={{ margin: '6px 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
                            Duration: {new Date(cert.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(cert.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                      <div>
                        <button className="btn btn-primary" onClick={() => {
                          setActiveCert({
                            id: cert.certificate_id,
                            studentName: cert.student_name,
                            courseTitle: cert.course_name,
                            issuedAt: cert.issued_at,
                            certificateType: 'live_bootcamp',
                            startDate: cert.start_date,
                            endDate: cert.end_date
                          });
                        }}><FiDownload /> View & Download</button>
                      </div>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        )}
        {/* Quiz & Rewards Tab */}
        {tab === 'quiz' && (() => {
          const REWARD_TIERS = [
            { type: 'newcomer', emoji: <FaSeedling style={{color: '#10b981'}} />, label: 'Seed', pts: 0 },
            { type: 'bronze', emoji: <FiAward style={{color: '#cd7f32'}} />, label: 'Iron', pts: 100 },
            { type: 'silver', emoji: <FiAward style={{color: '#c0c0c0'}} />, label: 'Steel', pts: 300 },
            { type: 'gold', emoji: <FiAward style={{color: '#f59e0b'}} />, label: 'Gold', pts: 700 },
            { type: 'platinum', emoji: <FiStar style={{color: '#005f9e'}} />, label: 'Elite', pts: 1500 },
            { type: 'legend', emoji: <FaCrown style={{color: '#008ad1'}} />, label: 'Crown', pts: 3000 },
          ];
          const unlockedTypes = new Set(userRewards.map(r => r.reward_type));
          const nextTier = REWARD_TIERS.find(t => t.pts > userPoints) || REWARD_TIERS[REWARD_TIERS.length - 1];
          const prevTier = REWARD_TIERS.filter(t => t.pts <= userPoints).pop() || REWARD_TIERS[0];
          const tierProgress = nextTier.pts > 0 ? Math.min(100, Math.round(((userPoints - prevTier.pts) / (nextTier.pts - prevTier.pts)) * 100)) : 100;

          return (
            <div className="sd-quiz animate-fade-in-up">
              {/* Hero card */}
              <div className="sdq-hero">
                <div className="sdq-hero-left">
                  <div className="sdq-hero-badge"><FiZap /> Daily Challenge</div>
                  <h3>Quiz & Gamification</h3>
                  <p>Earn points, build streaks, unlock rewards!</p>
                  <div className="sdq-stats-row">
                    <div className="sdq-stat">
                      <span style={{color: '#f59e0b'}}><FiDatabase /></span>
                      <strong>{userPoints}</strong>
                      <small>Points</small>
                    </div>
                    <div className="sdq-stat">
                      <span style={{color: '#f97316'}}><FaFire /></span>
                      <strong>{userStreak}</strong>
                      <small>Streak</small>
                    </div>
                    <div className="sdq-stat">
                      <span>{prevTier.emoji}</span>
                      <strong>{prevTier.label}</strong>
                      <small>Rank</small>
                    </div>
                  </div>
                </div>
                <div className="sdq-hero-right">
                  {todayAttempt ? (
                    <div className="sdq-today-done">
                      <div style={{ fontSize: '2.5rem', color: '#10b981' }}><FiCheckCircle /></div>
                      <p><strong>Today's Quiz Done!</strong></p>
                      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>You scored {todayAttempt.score}% • +{todayAttempt.points_earned} pts</p>
                      <Link to="/daily-quiz" className="sdq-btn-white">View Result</Link>
                    </div>
                  ) : (
                    <div className="sdq-today-cta">
                      <div style={{ fontSize: '2.5rem', color: '#f59e0b' }}><FiTarget /></div>
                      <p><strong>Today's Challenge Ready!</strong></p>
                      <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Complete it to earn up to 100+ pts</p>
                      <Link to="/daily-quiz" className="sdq-btn-white"><FiZap /> Start Quiz</Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress to next tier */}
              <div className="sdq-tier-card">
                <div className="sdq-tier-info">
                  <span>Progress to {nextTier.emoji} {nextTier.label}</span>
                  <span>{userPoints} / {nextTier.pts} pts</span>
                </div>
                <div className="sdq-tier-bar"><div className="sdq-tier-fill" style={{ width: `${tierProgress}%` }} /></div>
              </div>

              <div className="sdq-grid">
                {/* Reward badges */}
                <div className="sdq-card">
                  <div className="sdq-card-header">
                    <h4><FiAward style={{color: '#f59e0b', marginRight: 4}} /> Reward Badges</h4>
                  </div>
                  <div className="sdq-rewards-grid">
                    {REWARD_TIERS.map(tier => {
                      const unlocked = tier.pts === 0 || userPoints >= tier.pts || unlockedTypes.has(tier.type);
                      return (
                        <div key={tier.type} className={`sdq-badge ${unlocked ? 'unlocked' : 'locked'}`}>
                          <span className="sdq-badge-emoji">{tier.emoji}</span>
                          <span className="sdq-badge-label">{tier.label}</span>
                          <span className="sdq-badge-pts">{tier.pts > 0 ? `${tier.pts} pts` : 'Free'}</span>
                          {!unlocked && <div className="sdq-lock"><FiLock style={{color: '#9ca3af'}} /></div>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Mini leaderboard */}
                <div className="sdq-card">
                  <div className="sdq-card-header">
                    <h4><FaTrophy style={{color: '#f59e0b', marginRight: 4}} /> Top Learners</h4>
                    <Link to="/leaderboard" className="sdq-link"><FiTrendingUp /> Full Board</Link>
                  </div>
                  {topLeaders.length === 0 ? (
                    <p style={{ color: 'var(--gray-400)', fontSize: '0.875rem', textAlign: 'center', padding: '24px 0' }}>No data yet. Be the first!</p>
                  ) : (
                    <div className="sdq-mini-lb">
                      {topLeaders.map((l, i) => (
                        <div key={l.user_id} className={`sdq-lb-row ${l.user_id === user?.id ? 'me' : ''}`}>
                          <span className="sdq-lb-rank">
                            {i === 0 ? <FiAward style={{color: '#f59e0b'}} /> : 
                             i === 1 ? <FiAward style={{color: '#c0c0c0'}} /> : 
                             i === 2 ? <FiAward style={{color: '#cd7f32'}} /> : `#${i + 1}`}
                          </span>
                          <span className="sdq-lb-name">{l.user_id === user?.id ? <><FiStar style={{color:'#f59e0b', marginRight:4, verticalAlign: 'text-bottom'}} /> You</> : l.name}</span>
                          <span className="sdq-lb-pts">{l.total_points} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Streak rules */}
              <div className="sdq-streak-card">
                <h4><FaFire style={{color: '#f97316', marginRight: 4}} /> Streak Bonuses</h4>
                <div className="sdq-streak-grid">
                  <div className={`sdq-streak-item ${userStreak >= 3 ? 'earned' : ''}`}><span>3 Days</span><strong>+20 pts</strong></div>
                  <div className={`sdq-streak-item ${userStreak >= 7 ? 'earned' : ''}`}><span>7 Days</span><strong>+50 pts</strong></div>
                  <div className={`sdq-streak-item ${userStreak >= 30 ? 'earned' : ''}`}><span>30 Days</span><strong>+200 pts</strong></div>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--gray-400)', marginTop: 12 }}>Complete the daily quiz every day to keep your streak!</p>
              </div>
            </div>
          );
        })()}

        {/* Profile Tab */}
        {tab === 'profile' && (

          <div className="sd-profile animate-fade">
            <form className="profile-form" onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                const { error } = await supabase
                  .from('users')
                  .update({
                    name: profileName.trim().replace(/\b\w/g, c => c.toUpperCase()),
                    bio: profileBio,
                    dob: profileDob || null,
                    gender: profileGender || null,
                    qualification: profileQualification || null,
                    experience: profileExperience || null,
                    location: profileLocation || null,
                    contact_number: profileContact || null,
                    linkedin_url: profileLinkedin || null,
                  })
                  .eq('id', user.id);
                if (error) throw error;
                await refreshProfile();
                await showAlert('Profile updated successfully!', 'Success', 'success');
              } catch (err) {
                console.error('Profile update error:', err);
                await showAlert('Failed to update profile: ' + err.message, 'Update Failed', 'error');
              } finally {
                setSaving(false);
              }
            }}>
              <h3 style={{marginBottom: '20px', color: 'var(--gray-800)'}}>Personal Information</h3>
              <div className="form-row">
                <div className="form-group"><label>Full Name</label><input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} /></div>
                <div className="form-group"><label>Email</label><input type="email" value={profile?.email || ''} disabled /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date of Birth</label>
                  <DatePicker 
                    selected={profileDob ? new Date(profileDob) : null} 
                    onChange={date => setProfileDob(date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '')}
                    dateFormat="MM/dd/yyyy"
                    placeholderText="mm/dd/yyyy"
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                  />
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select value={profileGender} onChange={e => setProfileGender(e.target.value)}>
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Contact Number</label><input type="tel" placeholder="Enter phone number" value={profileContact} onChange={e => setProfileContact(e.target.value)} /></div>
                <div className="form-group"><label>Location</label><input type="text" placeholder="Enter location (City, State)" value={profileLocation} onChange={e => setProfileLocation(e.target.value)} /></div>
              </div>

              <h3 style={{marginBottom: '20px', marginTop: '30px', color: 'var(--gray-800)'}}>Professional Details</h3>
              <div className="form-row">
                <div className="form-group"><label>Highest Qualification</label><input type="text" placeholder="Enter highest qualification" value={profileQualification} onChange={e => setProfileQualification(e.target.value)} /></div>
                <div className="form-group"><label>Experience</label><input type="text" placeholder="Enter total experience" value={profileExperience} onChange={e => setProfileExperience(e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>LinkedIn Profile</label><input type="url" placeholder="Enter LinkedIn profile URL" value={profileLinkedin} onChange={e => setProfileLinkedin(e.target.value)} /></div>
                <div className="form-group"><label>Bio</label><textarea rows={3} value={profileBio} onChange={e => setProfileBio(e.target.value)} placeholder="Write a brief bio about yourself..." /></div>
              </div>
              <button type="submit" className="btn btn-primary btn-md" disabled={saving} style={{marginTop: '16px'}}>{saving ? 'Saving...' : 'Save Changes'}</button>
            </form>
          </div>
        )}

        {/* Events Tab */}
        {tab === 'events' && (
          <div className="sd-courses animate-fade-in-up">
            {(() => {
              const attendedEvents = userEvents.filter(e => userEventAttendance[e.id]?.status === 'JOINED' || userEventAttendance[e.id]?.attended);
              const registeredEvents = userEvents.filter(e => userEventAttendance[e.id]?.registered && !(userEventAttendance[e.id]?.status === 'JOINED' || userEventAttendance[e.id]?.attended));

              if (attendedEvents.length === 0 && registeredEvents.length === 0) {
                return (
                  <div className="cert-empty">
                    <p className="text-muted">No events yet. <a href="/events" style={{ color: 'var(--primary)' }}>Browse live events</a></p>
                  </div>
                );
              }

              return (
                <div className="sd-events-list">
                  {attendedEvents.map(ev => {
                    return (
                      <div key={ev.id} className="sd-event-item">
                        <div className="sd-event-item-info">
                          <h4>{ev.title}</h4>
                          <p>
                            <FiCalendar style={{ marginRight: 4 }} />
                            {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' '} | <FiClock style={{ marginRight: 4, marginLeft: 4 }} /> {ev.duration_minutes} min
                            {' '} | {ev.instructor_name}
                          </p>
                        </div>
                        <div className="sd-event-item-actions">
                          <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Attended</span>
                          {userEventAttendance[ev.id]?.attended && ev.enable_certificate && (
                            (() => {
                              const cert = eventCerts.find(c => c.course_name === ev.title);
                              if (cert) {
                                return (
                                  <button className="btn btn-primary btn-sm" onClick={() => {
                                    setActiveCert({
                                      id: cert.certificate_id,
                                      studentName: profile?.name || user.email,
                                      courseTitle: ev.title,
                                      issuedAt: cert.issued_at,
                                      certificateType: 'live'
                                    });
                                  }}>
                                    <FiDownload style={{ marginRight: 4 }} /> View Certificate
                                  </button>
                                );
                              }
                              return <span className="text-muted" style={{ fontSize: '0.75rem' }}>Certificate Pending...</span>;
                            })()
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {registeredEvents.map(ev => {
                    const eventDate = new Date(ev.event_date);
                    const endDate = new Date(eventDate.getTime() + (ev.duration_minutes || 60) * 60000);
                    const joinWindowStart = new Date(eventDate.getTime() - 10 * 60000);
                    const currentNow = new Date();
                    const isLive = ev.status === 'live' || (currentNow >= eventDate && currentNow <= endDate);
                    const isUpcoming = !isLive && currentNow < eventDate;
                    const isCompleted = ev.status === 'completed' || currentNow > endDate;
                    const canJoinNow = currentNow >= joinWindowStart && currentNow <= endDate;

                    return (
                      <div key={ev.id} className="sd-event-item">
                        <div className="sd-event-item-info">
                          <h4><Link to={`/events/${ev.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{ev.title}</Link></h4>
                          <p>
                            <FiCalendar style={{ marginRight: 4 }} />
                            {new Date(ev.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' '} | {ev.instructor_name}
                          </p>
                        </div>
                        <div className="sd-event-item-actions">
                          {isCompleted && (
                            <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>Ended</span>
                          )}
                          {isUpcoming && (
                            <span className="badge badge-primary" style={{ fontSize: '0.75rem' }}>Upcoming</span>
                          )}
                          {(isLive || isUpcoming) && canJoinNow && (
                            <button className="btn btn-primary btn-sm" onClick={async () => {
                              try {
                                // Use server-side RPC for validation
                                const { data: result, error: rpcError } = await supabase.rpc('join_event', {
                                  p_event_id: ev.id
                                });

                                if (rpcError) throw rpcError;

                                if (result && !result.success) {
                                  await showAlert(result.error || 'Could not join event.', 'Cannot Join', 'info');
                                  if (result.code === 'ALREADY_ATTENDED' || result.code === 'ALREADY_ATTENDED_MASTER') {
                                    setUserEventAttendance(prev => ({
                                      [ev.id]: { ...prev[ev.id], status: 'JOINED' }
                                    }));
                                  }
                                  return;
                                }

                                const enteredAt = result?.entered_at || new Date().toISOString();
                                setUserEventAttendance(prev => ({
                                  ...prev,
                                  [ev.id]: { 
                                    ...prev[ev.id], 
                                    status: prev[ev.id]?.status === 'JOINED' ? 'JOINED' : 'ENTERED', 
                                    entered_at: enteredAt 
                                  }
                                }));
                                if (ev.live_link) window.open(ev.live_link, '_blank');
                                else await showAlert('Live link not available yet. Please check back later.', 'Info', 'info');
                              } catch (err) {
                                console.error('Join error:', err);
                                await showAlert(err.message || 'Failed to join event.', 'Error', 'error');
                              }
                            }}>
                              <FiExternalLink style={{ marginRight: 4 }} /> { (userEventAttendance[ev.id]?.status === 'ENTERED' || userEventAttendance[ev.id]?.status === 'JOINED') ? 'Re-enter Live' : 'Join Now' }
                            </button>
                          )}
                          {(isLive || isUpcoming) && !canJoinNow && (
                            <span style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: 600 }}>Opens 10 min before</span>
                          )}
                          <Link to={`/events/${ev.id}`} className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}>
                            View Event
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Bootcamps Tab */}
        {tab === 'bootcamps' && (
          <div className="sd-courses animate-fade-in-up">
            {(() => {
              const enrolledBootcamps = userBootcamps.filter(bc => userBootcampEnrollments[bc.id]?.registered);

              if (enrolledBootcamps.length === 0) {
                return (
                  <div className="cert-empty">
                    <p className="text-muted">No bootcamp enrollments yet. <a href="/live-bootcamps" style={{ color: '#008ad1' }}>Browse live bootcamps</a></p>
                  </div>
                );
              }

              return (
                <div className="sd-events-list">
                  {enrolledBootcamps.map(bc => {
                    const enrollment = userBootcampEnrollments[bc.id];
                    const now = new Date();
                    const startDate = new Date(bc.start_date);
                    const endDate = new Date(bc.end_date);
                    const isActive = bc.status === 'active' || (now >= startDate && now <= endDate);
                    const isUpcoming = !isActive && now < startDate;
                    const isCompleted = enrollment?.status === 'JOINED' || enrollment?.completed;
                    const isEnded = bc.status === 'completed' || now > endDate;

                    return (
                      <div key={bc.id} className="sd-event-item">
                        <div className="sd-event-item-info">
                          <h4><Link to={`/live-bootcamps/${bc.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{bc.title}</Link></h4>
                          <p>
                            <FiCalendar style={{ marginRight: 4 }} />
                            {new Date(bc.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - {new Date(bc.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' '} | <FiClock style={{ marginRight: 4, marginLeft: 4 }} /> {bc.total_sessions} Sessions
                            {' '} | {bc.instructor_name}
                          </p>
                        </div>
                        <div className="sd-event-item-actions">
                          {isCompleted && (
                            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>Completed</span>
                          )}
                          {!isCompleted && isEnded && (
                            <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>Ended</span>
                          )}
                          {isUpcoming && (
                            <span className="badge" style={{ fontSize: '0.75rem', background: '#dbeafe', color: '#1d4ed8' }}>Upcoming</span>
                          )}
                          {isActive && (
                            <span className="badge badge-success" style={{ fontSize: '0.75rem', animation: 'pulse-badge 2s infinite' }}>Active</span>
                          )}
                          {(isActive || isUpcoming) && bc.live_link && (
                            <button className="btn btn-primary btn-sm" style={{ background: '#008ad1', borderColor: '#008ad1' }} onClick={async () => {
                              try {
                                const { data: result, error: rpcError } = await supabase.rpc('join_bootcamp', {
                                  p_live_bootcamp_id: bc.id
                                });
                                if (rpcError) throw rpcError;

                                if (result && !result.success) {
                                  await showAlert(result.error || 'Could not join bootcamp.', 'Cannot Join', 'info');
                                  if (result.code === 'ALREADY_ATTENDED_MASTER') {
                                    setUserBootcampEnrollments(prev => ({
                                      ...prev, [bc.id]: { ...prev[bc.id], status: 'JOINED' }
                                    }));
                                  }
                                  return;
                                }

                                const enteredAt = result?.entered_at || new Date().toISOString();
                                setUserBootcampEnrollments(prev => ({
                                  ...prev,
                                  [bc.id]: {
                                    ...prev[bc.id],
                                    status: prev[bc.id]?.status === 'JOINED' ? 'JOINED' : 'ENTERED',
                                    entered_at: enteredAt
                                  }
                                }));

                                if (bc.live_link) window.open(bc.live_link, '_blank');
                                else await showAlert('Live link not available yet. Please check back later.', 'Info', 'info');
                              } catch (err) {
                                console.error('Join error:', err);
                                await showAlert(err.message || 'Failed to join bootcamp.', 'Error', 'error');
                              }
                            }}>
                              <FiExternalLink style={{ marginRight: 4 }} /> { (enrollment?.status === 'ENTERED' || enrollment?.status === 'JOINED') ? 'Re-enter Live' : 'Join Now' }
                            </button>
                          )}
                          {isCompleted && bc.enable_certificate && (
                            (() => {
                              const cert = bootcampCerts.find(c => c.course_name === bc.title);
                              if (cert) {
                                return (
                                  <button className="btn btn-primary btn-sm" style={{ background: '#008ad1', borderColor: '#008ad1' }} onClick={() => {
                                    setActiveCert({
                                      id: cert.certificate_id,
                                      studentName: profile?.name || user.email,
                                      courseTitle: bc.title,
                                      issuedAt: cert.issued_at,
                                      certificateType: 'live_bootcamp',
                                      startDate: bc.start_date,
                                      endDate: bc.end_date
                                    });
                                  }}>
                                    <FiDownload style={{ marginRight: 4 }} /> View Certificate
                                  </button>
                                );
                              }
                              return <span className="text-muted" style={{ fontSize: '0.75rem' }}>Certificate Pending...</span>;
                            })()
                          )}
                          <Link to={`/live-bootcamps/${bc.id}`} className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}>
                            View Bootcamp
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

      </div>
      
      {/* Active Certificate Modal */}
      {activeCert && (
        <Certificate certificateData={activeCert} onClose={() => setActiveCert(null)} />
      )}
    </div>
  );
}
