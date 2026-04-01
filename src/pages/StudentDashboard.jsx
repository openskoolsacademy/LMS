import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiBookOpen, FiAward, FiUser, FiDownload, FiBarChart2, FiPlay, FiPlusCircle, FiFileText } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import GlobalBanner from '../components/ui/GlobalBanner';
import { generateUserCode } from '../utils/userCode';
import Certificate from '../components/ui/Certificate';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { mapCategory } from '../data/categories';
import './StudentDashboard.css';

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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['courses', 'progress', 'certificates', 'profile'].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    if (user) {
      fetchEnrollments();
      fetchCertificates();
      fetchStreak();
      fetchAssessmentStatus();
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

  if (loading) return <div className="container section"><h2>Loading dashboard...</h2></div>;

  const completedCount = enrollments.filter(e => e.status === 'completed').length;
  const overallProgress = enrollments.length 
    ? Math.round(enrollments.reduce((acc, e) => acc + (e.progress || 0), 0) / enrollments.length) 
    : 0;

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
            </div>
          </div>
        </div>

        <GlobalBanner location="Dashboard" />

        {/* Tabs */}
        <div className="sd-tabs">
          <button className={`sd-tab ${tab === 'courses' ? 'active' : ''}`} onClick={() => setTab('courses')}><FiBookOpen /> My Courses</button>
          <button className={`sd-tab ${tab === 'progress' ? 'active' : ''}`} onClick={() => setTab('progress')}><FiBarChart2 /> Progress</button>
          <button className={`sd-tab ${tab === 'certificates' ? 'active' : ''}`} onClick={() => setTab('certificates')}><FiAward /> Certificates</button>
          <button className={`sd-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}><FiUser /> Profile</button>
        </div>

        {/* Courses Tab */}
        {tab === 'courses' && (
          <div className="sd-courses animate-fade-in-up">
            {enrollments.length === 0 && <p>You haven't enrolled in any courses yet. <Link to="/courses">Browse courses</Link></p>}
            {enrollments.map((enr, idx) => (
              <div key={idx} className="sd-course-card">
                <img src={enr.course.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800'} alt={enr.course.title} className="sd-course-img" />
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
            {completedCount === 0 ? (
              <div className="cert-empty">
                <p className="text-muted">Complete more courses to earn certificates!</p>
              </div>
            ) : (
              enrollments.filter(e => e.status === 'completed').map((enr, idx) => {
                const hasCert = certificates.find(c => c.course_id === enr.course.id);
                const hasAssessment = !!courseAssessments[enr.course.id];
                const hasPassed = !!passedAssessments[enr.course.id];
                const canGetCert = hasAssessment ? hasPassed : true;

                return (
                 <div key={idx} className="certificate-card">
                    <div>
                      <h4 style={{ margin: '0 0 5px 0' }}>{enr.course.title}</h4>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Instructor: {enr.course.instructor?.name || 'Unknown'}</p>
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
              })
            )}
          </div>
        )}

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
                    name: profileName,
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

      </div>
      
      {/* Active Certificate Modal */}
      {activeCert && (
        <Certificate certificateData={activeCert} onClose={() => setActiveCert(null)} />
      )}
    </div>
  );
}
