import { useState, useEffect, useRef } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiUsers, FiDollarSign, FiBookOpen, FiUpload, FiImage, FiList, FiUser, FiMapPin, FiPhone, FiLinkedin, FiCamera, FiAward, FiBriefcase, FiMail, FiFileText, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { Link, useLocation } from 'react-router-dom';
import ReactPlayer from 'react-player';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { generateUserCode } from '../utils/userCode';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Rating from '../components/ui/Rating';
import { resolveImageUrl } from '../utils/imageUtils';
import './InstructorDashboard.css';
import Loader from '../components/ui/Loader';


export default function InstructorDashboard() {
  const { user, profile, refreshProfile } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const location = useLocation();
  const [tab, setTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [monthlyRevenue, setMonthlyRevenue] = useState(new Array(12).fill(0));
  
  // Form State
  const [editCourseId, setEditCourseId] = useState(null);
  const [formData, setFormData] = useState({ 
    title: '', 
    category: '', 
    regular_price: '', 
    offer_price: '',
    is_coupon_applicable: true,
    is_featured: false,
    level: 'Beginner', 
    description: '', 
    thumbnail_url: '', 
    video_url: '',
    learning_outcomes: '',
    requirements: ''
  });

  // Curriculum State
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);
  const [curriculumCourse, setCurriculumCourse] = useState(null);
  const [curriculumLessons, setCurriculumLessons] = useState([]);
  const [lessonFormData, setLessonFormData] = useState({ title: '', section_title: '', video_url: '', duration: '', notes: '', resources: '' });
  const [detectingDuration, setDetectingDuration] = useState(false);

  // Profile State
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileQualification, setProfileQualification] = useState('');
  const [profileExperience, setProfileExperience] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileContact, setProfileContact] = useState('');
  const [profileLinkedin, setProfileLinkedin] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const profileInitialized = useRef(false);
  const curriculumFormRef = useRef(null);

  // Assessment State
  const [assessments, setAssessments] = useState([]);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);
  const [editAssessment, setEditAssessment] = useState(null);
  const [assessForm, setAssessForm] = useState({ title: 'Course Assessment', pass_percentage: 60, time_limit_minutes: '', max_attempts: 3, shuffle_questions: true, course_id: '' });
  const [assessQuestions, setAssessQuestions] = useState([]);
  const [qForm, setQForm] = useState({ question_text: '', options: ['', '', '', ''], correct_option: 0 });
  const [assessSaving, setAssessSaving] = useState(false);
  const [assessAttempts, setAssessAttempts] = useState([]);

  useEffect(() => {
    if (profile && !profileInitialized.current) {
      setProfileName(profile.name || '');
      setProfileBio(profile.bio || '');
      setProfileQualification(profile.qualification || '');
      setProfileExperience(profile.experience || '');
      setProfileLocation(profile.location || '');
      setProfileContact(profile.contact_number || '');
      setProfileLinkedin(profile.linkedin_url || '');
      setProfileAvatarUrl(profile.avatar_url || '');
      profileInitialized.current = true;
    }
  }, [profile]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['courses', 'earnings', 'assessments', 'profile'].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    if (user) {
      fetchInstructorCourses();
      fetchRevenue();
      fetchAssessments();
    }
  }, [user]);

  const fetchInstructorCourses = async () => {
    try {
      const [coursesRes, statsRes] = await Promise.all([
        supabase
          .from('courses')
          .select('*')
          .eq('instructor_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_all_course_stats')
      ]);

      if (coursesRes.error) throw coursesRes.error;
      
      const statsMap = (statsRes.data || []).reduce((acc, stat) => {
        acc[stat.rpc_course_id] = stat;
        return acc;
      }, {});

      const formatted = (coursesRes.data || []).map(c => {
        const stats = statsMap[c.id] || { student_count: 0, review_count: 0, average_rating: 0 };
        return {
          ...c,
          student_count: Number(stats.student_count) || 0,
          review_count: Number(stats.review_count) || 0,
          average_rating: Number(stats.average_rating) || 0
        };
      });

      setCourses(formatted);

      // Now fetch actual total earnings from payments
      const { data: payData } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'completed')
        .in('course_id', formatted.map(c => c.id));
      
      const total = (payData || []).reduce((sum, p) => sum + Number(p.amount), 0);
      setTotalEarnings(total);
    } catch (error) {
      console.error('Error fetching courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const [totalEarnings, setTotalEarnings] = useState(0);

  const fetchRevenue = async () => {
    try {
      const year = new Date().getFullYear();
      const { data: instructorCourses } = await supabase.from('courses').select('id').eq('instructor_id', user.id);
      const courseIds = (instructorCourses || []).map(c => c.id);

      if (courseIds.length === 0) {
        setMonthlyRevenue(new Array(12).fill(0));
        return;
      }

      const { data, error } = await supabase
        .from('payments')
        .select('amount, created_at')
        .eq('status', 'completed')
        .in('course_id', courseIds)
        .gte('created_at', `${year}-01-01`)
        .lte('created_at', `${year}-12-31`);

      if (error) throw error;

      const monthly = new Array(12).fill(0);
      (data || []).forEach(p => {
        const month = new Date(p.created_at).getMonth();
        monthly[month] += Number(p.amount);
      });
      setMonthlyRevenue(monthly);
    } catch (err) {
      console.error("Revenue Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        instructor_id: user.id,
        title: formData.title,
        category: formData.category,
        price: parseFloat(formData.regular_price) || 0,
        regular_price: parseFloat(formData.regular_price) || 0,
        offer_price: formData.offer_price ? parseFloat(formData.offer_price) : null,
        is_coupon_applicable: formData.is_coupon_applicable,
        is_featured: formData.is_featured,
        level: formData.level,
        description: formData.description,
        thumbnail_url: formData.thumbnail_url || null,
        learning_outcomes: formData.learning_outcomes.split('\n').map(s => s.trim()).filter(s => s !== ''),
        requirements: formData.requirements.split('\n').map(s => s.trim()).filter(s => s !== ''),
      };

      if (editCourseId) {
        const { error } = await supabase.from('courses').update(payload).eq('id', editCourseId);
        if (error) throw error;

        // Handle Promo Video correctly on Update
        if (formData.video_url) {
          const { data: introLesson } = await supabase.from('lessons').select('id').eq('course_id', editCourseId).eq('title', 'Course Introduction').single();
          if (introLesson) {
            await supabase.from('lessons').update({ video_url: formData.video_url }).eq('id', introLesson.id);
          } else {
            await supabase.from('lessons').insert([{ course_id: editCourseId, title: 'Course Introduction', video_url: formData.video_url, order_index: 0, duration: 10 }]);
          }
        }
      } else {
        const { data: newCourse, error } = await supabase.from('courses').insert([payload]).select().single();
        if (error) throw error;
        
        if (formData.video_url) {
          await supabase.from('lessons').insert([{
            course_id: newCourse.id,
            title: 'Course Introduction',
            video_url: formData.video_url,
            order_index: 0,
            duration: 10
          }]);
        }
      }
      
      setShowModal(false);
      fetchInstructorCourses();
    } catch (error) {
      await showAlert("Error saving course: " + error.message, 'Save Failed', 'error');
    }
  };

  const openAdd = () => { 
    setEditCourseId(null); 
    setFormData({ 
      title: '', 
      category: '', 
      regular_price: '', 
      offer_price: '',
      is_coupon_applicable: true,
      is_featured: false,
      level: 'Beginner', 
      description: '', 
      thumbnail_url: '', 
      video_url: '',
      learning_outcomes: '',
      requirements: ''
    });
    setShowModal(true); 
  };
  
  const openEdit = async (c) => { 
    setEditCourseId(c.id); 
    
    // Fetch Promo Video correctly
    const { data: introLesson } = await supabase.from('lessons').select('video_url').eq('course_id', c.id).eq('title', 'Course Introduction').single();
    const vidUrl = introLesson ? introLesson.video_url : '';

    setFormData({ 
      title: c.title, 
      category: c.category, 
      regular_price: c.regular_price || c.price || '', 
      offer_price: c.offer_price || '',
      is_coupon_applicable: c.is_coupon_applicable !== undefined ? c.is_coupon_applicable : true,
      is_featured: c.is_featured || false,
      level: c.level, 
      description: c.description, 
      thumbnail_url: c.thumbnail_url || '', 
      video_url: vidUrl,
      learning_outcomes: Array.isArray(c.learning_outcomes) ? c.learning_outcomes.join('\n') : '',
      requirements: Array.isArray(c.requirements) ? c.requirements.join('\n') : ''
    });
    setShowModal(true); 
  };

  const deleteCourse = async (id) => {
    const confirmed = await showConfirm("Are you sure you want to delete this course?", undefined, "Delete Course", "Delete", "Cancel");
    if (confirmed) {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (!error) fetchInstructorCourses();
    }
  };

  const fetchLessons = async (courseId) => {
    const { data } = await supabase.from('lessons').select('*').eq('course_id', courseId).order('order_index', { ascending: true });
    setCurriculumLessons(data || []);
  };

  const openCurriculum = (course) => {
    setCurriculumCourse(course);
    setLessonFormData({ title: '', section_title: '', video_url: '', duration: '' });
    fetchLessons(course.id);
    setShowCurriculumModal(true);
  };

  // Auto-detect video duration from URL
  const [probeUrl, setProbeUrl] = useState(null);
  const autoDetectDuration = async (url) => {
    if (!url) return;
    setDetectingDuration(true);
    try {
      // Check if YouTube
      const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (ytMatch) {
        // Use hidden ReactPlayer to probe duration
        setProbeUrl(`https://www.youtube.com/watch?v=${ytMatch[1]}`);
        return; // onDuration callback will handle the rest
      }

      // Check if Google Drive (can't probe duration due to CORS)
      const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (driveMatch) {
        setDetectingDuration(false);
        return;
      }

      // Direct video URL - probe with hidden <video>
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = url;
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          const mins = Math.ceil(video.duration / 60);
          setLessonFormData(prev => ({ ...prev, duration: String(mins) }));
          resolve();
        };
        video.onerror = () => resolve();
        setTimeout(resolve, 5000);
      });
      video.remove();
    } catch (err) {
      console.warn('Duration auto-detect failed:', err);
    } finally {
      setDetectingDuration(false);
    }
  };

  const handleProbeDuration = (seconds) => {
    const mins = Math.ceil(seconds / 60);
    setLessonFormData(prev => ({ ...prev, duration: String(mins) }));
    setProbeUrl(null);
    setDetectingDuration(false);
  };

  const handleSaveLesson = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('lessons').insert([{
        course_id: curriculumCourse.id,
        title: lessonFormData.title,
        section_title: lessonFormData.section_title || null,
        video_url: lessonFormData.video_url,
        duration: parseInt(lessonFormData.duration) || 0,
        notes: lessonFormData.notes || null,
        resources: lessonFormData.resources || null,
        order_index: curriculumLessons.length
      }]);
      if (error) throw error;
      // Persist section_title for rapid multi-lesson entry
      setLessonFormData(prev => ({ 
        title: '', 
        section_title: prev.section_title, 
        video_url: '', 
        duration: '', 
        notes: '', 
        resources: '' 
      }));
      fetchLessons(curriculumCourse.id);
    } catch (err) {
      await showAlert("Error adding lesson: " + err.message, 'Save Failed', 'error');
    }
  };

  const deleteLesson = async (id) => {
    const confirmed = await showConfirm("Delete this lesson?", undefined, "Confirm Deletion", "Delete", "Cancel");
    if (confirmed) {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (!error) fetchLessons(curriculumCourse.id);
    }
  };

  const groupedLessons = curriculumLessons.reduce((acc, lesson) => {
    const sec = lesson.section_title || '';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(lesson);
    return acc;
  }, {});

  // ═══ Assessment Functions ═══
  const fetchAssessments = async () => {
    try {
      const courseIds = courses.length > 0 ? courses.map(c => c.id) : [];
      // Fetch all assessments for instructor's courses
      const { data: assessData } = await supabase
        .from('assessments').select('*').eq('is_active', true);
      setAssessments(assessData || []);

      // Fetch all questions for those assessments
      const assessIds = (assessData || []).map(a => a.id);
      if (assessIds.length > 0) {
        const { data: qData } = await supabase
          .from('assessment_questions').select('*').in('assessment_id', assessIds).order('order_index');
        setAssessQuestions(qData || []);
      }
    } catch (err) {
      console.error('Error fetching assessments:', err);
    }
  };

  // Re-fetch assessments when courses change
  useEffect(() => {
    if (courses.length > 0) fetchAssessments();
  }, [courses.length]);

  const openCreateAssessment = (courseId) => {
    setEditAssessment(null);
    setAssessForm({ title: 'Course Assessment', pass_percentage: 60, time_limit_minutes: '', max_attempts: 3, shuffle_questions: true, course_id: courseId });
    setShowAssessmentModal(true);
  };

  const openEditAssessment = (assess) => {
    setEditAssessment(assess);
    setAssessForm({
      title: assess.title,
      pass_percentage: assess.pass_percentage,
      time_limit_minutes: assess.time_limit_minutes || '',
      max_attempts: assess.max_attempts || '',
      shuffle_questions: assess.shuffle_questions,
      course_id: assess.course_id
    });
    setShowAssessmentModal(true);
  };

  const openAssessmentQuestions = async (assess) => {
    setEditAssessment({ ...assess, _showQuestions: true });
    setQForm({ question_text: '', options: ['', '', '', ''], correct_option: 0 });
    // Fetch fresh questions
    const { data } = await supabase
      .from('assessment_questions').select('*').eq('assessment_id', assess.id).order('order_index');
    setAssessQuestions(prev => {
      const filtered = prev.filter(q => q.assessment_id !== assess.id);
      return [...filtered, ...(data || [])];
    });
  };

  const handleSaveAssessment = async (e) => {
    e.preventDefault();
    setAssessSaving(true);
    try {
      const payload = {
        title: assessForm.title,
        pass_percentage: parseInt(assessForm.pass_percentage),
        time_limit_minutes: assessForm.time_limit_minutes ? parseInt(assessForm.time_limit_minutes) : null,
        max_attempts: assessForm.max_attempts ? parseInt(assessForm.max_attempts) : null,
        shuffle_questions: assessForm.shuffle_questions,
        course_id: assessForm.course_id
      };

      if (editAssessment) {
        const { error } = await supabase.from('assessments').update(payload).eq('id', editAssessment.id);
        if (error) throw error;
        await showAlert('Assessment updated successfully.', 'Success', 'success');
      } else {
        const { error } = await supabase.from('assessments').insert([payload]);
        if (error) throw error;
        await showAlert('Assessment created successfully.', 'Success', 'success');
      }
      setShowAssessmentModal(false);
      setEditAssessment(null);
      fetchAssessments();
    } catch (err) {
      await showAlert('Error saving assessment: ' + err.message, 'Error', 'error');
    } finally {
      setAssessSaving(false);
    }
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('assessment_questions').insert([{
        assessment_id: editAssessment.id,
        question_text: qForm.question_text,
        options: qForm.options,
        correct_option: qForm.correct_option,
        order_index: assessQuestions.filter(q => q.assessment_id === editAssessment.id).length
      }]);
      if (error) throw error;
      setQForm({ question_text: '', options: ['', '', '', ''], correct_option: 0 });
      // Refresh questions
      const { data } = await supabase
        .from('assessment_questions').select('*').eq('assessment_id', editAssessment.id).order('order_index');
      setAssessQuestions(prev => {
        const filtered = prev.filter(q => q.assessment_id !== editAssessment.id);
        return [...filtered, ...(data || [])];
      });
    } catch (err) {
      await showAlert('Error adding question: ' + err.message, 'Error', 'error');
    }
  };

  const deleteQuestion = async (qId) => {
    const confirmed = await showConfirm('Delete this question?', undefined, 'Confirm', 'Delete', 'Cancel');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('assessment_questions').delete().eq('id', qId);
      if (error) throw error;
      setAssessQuestions(prev => prev.filter(q => q.id !== qId));
    } catch (err) {
      await showAlert('Error deleting question: ' + err.message, 'Error', 'error');
    }
  };

  const totalStudents = courses.reduce((acc, c) => acc + c.student_count, 0); 
  
  // Overall Avg Rating across all reviews
  const totalStars = courses.reduce((acc, c) => acc + (Number(c.average_rating) * Number(c.review_count)), 0);
  const totalReviews = courses.reduce((acc, c) => acc + Number(c.review_count), 0);
  const avgRatingSummary = totalReviews > 0 ? (totalStars / totalReviews).toFixed(1) : "0.0";

  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;

  return (
    <div className="instructor-dash section">
      <div className="container">
        <div className="id-header animate-fade">
          <div>
            <h1>Instructor Dashboard</h1>
            <p>Welcome back, {profile?.name}</p>
          </div>
          <Button variant="primary" onClick={openAdd}><FiPlus /> New Course</Button>
        </div>

        {/* Stats */}
        <div className="id-stats">
          <div className="id-stat-card"><FiBookOpen className="id-stat-icon" /><div><span>My Courses</span><strong>{courses.length}</strong></div></div>
          <div className="id-stat-card"><FiUsers className="id-stat-icon" /><div><span>Total Students</span><strong>{totalStudents.toLocaleString()}</strong></div></div>
          <div className="id-stat-card"><FiDollarSign className="id-stat-icon" /><div><span>Total Earnings</span><strong>₹{totalEarnings.toLocaleString()}</strong></div></div>
          <div className="id-stat-card"><div className="id-stat-icon">⭐</div><div><span>Avg Rating</span><strong>{avgRatingSummary}</strong></div></div>
        </div>

        {/* Tabs */}
        <div className="id-tabs">
          <button className={`id-tab ${tab === 'courses' ? 'active' : ''}`} onClick={() => setTab('courses')}>My Courses</button>
          <button className={`id-tab ${tab === 'assessments' ? 'active' : ''}`} onClick={() => setTab('assessments')}><FiFileText style={{marginRight: 4}} /> Assessments</button>
          <button className={`id-tab ${tab === 'earnings' ? 'active' : ''}`} onClick={() => setTab('earnings')}>Earnings</button>
          <button className={`id-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}><FiUser /> Profile</button>
        </div>

        {/* Courses Tab */}
        {tab === 'courses' && (
          <div className="id-courses animate-fade">
            <div className="id-table-wrap">
              <table className="id-table">
                <thead>
                  <tr><th>Course</th><th>Price</th><th>Rating</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {courses.length === 0 && <tr><td colSpan="5" className="text-center">No courses published yet.</td></tr>}
                  {courses.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div className="id-course-cell">
                          <img src={resolveImageUrl(c.thumbnail_url) || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800'} alt={c.title} />
                          <div>
                            <strong>{c.title}</strong>
                            <span>{c.category} • {c.level}</span>
                            <span style={{fontSize: '0.75rem', marginTop: 4, color: 'var(--primary)'}}>{c.student_count} Students • {c.review_count} Reviews</span>
                          </div>
                        </div>
                      </td>
                      <td>₹{c.price}</td>
                      <td><Rating value={c.average_rating || 0} showCount={false} size="sm" /></td>
                      <td>
                        {c.status === 'approved' && <span className="badge badge-success">Approved</span>}
                        {c.status === 'pending' && <span className="badge" style={{backgroundColor: '#f59e0b', color: '#fff'}}>Pending Review</span>}
                        {c.status === 'rejected' && <span className="badge badge-danger">Rejected</span>}
                      </td>
                      <td>
                        <div className="id-actions">
                          <button 
                            className="id-action-btn" 
                            onClick={async () => c.status === 'approved' ? await showAlert('This course is Approved and currently live. Please contact an Admin to unlock it for curriculum updates.', 'Course Locked', 'warning') : openCurriculum(c)} 
                            title={c.status === 'approved' ? "Locked: Approved" : "Manage Curriculum"}
                            style={{ opacity: c.status === 'approved' ? 0.5 : 1, cursor: c.status === 'approved' ? 'not-allowed' : 'pointer' }}
                          >
                            <FiList />
                          </button>
                          <button 
                            className="id-action-btn" 
                            onClick={async () => c.status === 'approved' ? await showAlert('This course is Approved and currently live. Please contact an Admin to edit details.', 'Course Locked', 'warning') : openEdit(c)} 
                            title={c.status === 'approved' ? "Locked: Approved" : "Edit"}
                            style={{ opacity: c.status === 'approved' ? 0.5 : 1, cursor: c.status === 'approved' ? 'not-allowed' : 'pointer' }}
                          >
                            <FiEdit2 />
                          </button>
                          <button 
                            className="id-action-btn danger" 
                            onClick={async () => c.status === 'approved' ? await showAlert('You cannot delete an Approved course that may have active student enrollments. Please contact an Admin.', 'Course Locked', 'error') : deleteCourse(c.id)} 
                            title={c.status === 'approved' ? "Locked: Approved" : "Delete"}
                            style={{ opacity: c.status === 'approved' ? 0.5 : 1, cursor: c.status === 'approved' ? 'not-allowed' : 'pointer' }}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Earnings Tab */}
        {tab === 'earnings' && (
          <div className="id-earnings animate-fade">
            <div className="id-earnings-chart">
              <h3>Monthly Revenue ({new Date().getFullYear()})</h3>
              <div className="chart-placeholder">
                <div className="chart-bars">
                  {monthlyRevenue.map((val, i) => {
                    const max = Math.max(...monthlyRevenue, 1);
                    const h = (val / max) * 100;
                    return (
                      <div key={i} className="chart-bar-col">
                        <div className="chart-bar-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                          {val > 0 && <span className="chart-bar-value">₹{val}</span>}
                          <div className="chart-bar" style={{ height: `${Math.max(h, 2)}%` }} title={`₹${val}`} />
                        </div>
                        <span>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profile Tab */}
        {tab === 'profile' && (
          <div className="ip-profile animate-fade">
            {/* Profile Hero Card */}
            <div className="ip-hero">
              <div className="ip-hero-bg" />
              <div className="ip-hero-content">
                <div className="ip-avatar-wrap">
                  <div className="ip-avatar">
                    {profileAvatarUrl ? (
                      <img src={profileAvatarUrl} alt={profileName} />
                    ) : (
                      <span>{profileName?.charAt(0)?.toUpperCase() || 'I'}</span>
                    )}
                  </div>
                  <div className="ip-avatar-badge">
                    <FiCamera size={12} />
                  </div>
                </div>
                <div className="ip-hero-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <h2 style={{ marginBottom: 0, color: '#fff' }}>{profile?.name || 'Instructor'}</h2>
                    <span className="ap-user-code" style={{ 
                      fontSize: '.875rem', 
                      background: 'rgba(255,255,255,0.15)', 
                      backdropFilter: 'blur(10px)',
                      color: '#fff', 
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontWeight: 700,
                      fontFamily: "'Courier New', monospace"
                    }}>
                      ID: {generateUserCode(user?.id)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <p className="ip-hero-role"><FiAward /> Verified Instructor</p>
                  </div>
                  <div className="ip-hero-meta">
                    {profile?.location && <span><FiMapPin /> {profile.location}</span>}
                    {profile?.email && <span><FiMail /> {profile.email}</span>}
                    {profile?.linkedin_url && <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer"><FiLinkedin /> LinkedIn</a>}
                  </div>
                </div>
                <div className="ip-hero-stats">
                  <div className="ip-hero-stat"><strong>{courses.length}</strong><span>Courses</span></div>
                  <div className="ip-hero-stat"><strong>{totalStudents}</strong><span>Students</span></div>
                  <div className="ip-hero-stat"><strong>{avgRatingSummary}</strong><span>Rating</span></div>
                </div>
              </div>
            </div>

            {/* Editable Profile Form */}
            <form className="ip-form" onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                const { error } = await supabase
                  .from('users')
                  .update({
                    name: profileName.trim().replace(/\b\w/g, c => c.toUpperCase()),
                    bio: profileBio,
                    qualification: profileQualification || null,
                    experience: profileExperience || null,
                    location: profileLocation || null,
                    contact_number: profileContact || null,
                    linkedin_url: profileLinkedin || null,
                    avatar_url: profileAvatarUrl || null,
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
              <div className="ip-form-section">
                <h3><FiUser /> Personal Information</h3>
                <div className="ip-form-grid">
                  <div className="ip-field">
                    <label>Full Name</label>
                    <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your full name" />
                  </div>
                  <div className="ip-field">
                    <label>Email</label>
                    <input type="email" value={profile?.email || ''} disabled />
                  </div>
                  <div className="ip-field">
                    <label>Profile Image URL</label>
                    <input type="url" value={profileAvatarUrl} onChange={e => setProfileAvatarUrl(e.target.value)} placeholder="https://example.com/your-photo.jpg" />
                  </div>
                  <div className="ip-field">
                    <label><FiMapPin /> Location</label>
                    <input type="text" value={profileLocation} onChange={e => setProfileLocation(e.target.value)} placeholder="City, Country" />
                  </div>
                </div>
                <div className="ip-field full">
                  <label>About Me</label>
                  <textarea rows={4} value={profileBio} onChange={e => setProfileBio(e.target.value)} placeholder="Tell students about yourself, your teaching philosophy, and what drives you..." />
                </div>
              </div>

              <div className="ip-form-section">
                <h3><FiBriefcase /> Professional Details</h3>
                <div className="ip-form-grid">
                  <div className="ip-field">
                    <label><FiAward /> Qualification</label>
                    <input type="text" value={profileQualification} onChange={e => setProfileQualification(e.target.value)} placeholder="e.g. M.Tech in Computer Science" />
                  </div>
                  <div className="ip-field">
                    <label><FiBriefcase /> Experience</label>
                    <input type="text" value={profileExperience} onChange={e => setProfileExperience(e.target.value)} placeholder="e.g. 5+ years in AI & ML" />
                  </div>
                  <div className="ip-field">
                    <label><FiPhone /> Contact Number</label>
                    <input type="tel" value={profileContact} onChange={e => setProfileContact(e.target.value)} placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div className="ip-field">
                    <label><FiLinkedin /> LinkedIn URL</label>
                    <input type="url" value={profileLinkedin} onChange={e => setProfileLinkedin(e.target.value)} placeholder="https://linkedin.com/in/yourname" />
                  </div>
                </div>
              </div>

              <div className="ip-form-actions">
                <Button variant="primary" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Add/Edit Course Modal */}
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editCourseId ? 'Edit Course' : 'Create New Course'} size="lg">
          <form className="course-form" onSubmit={handleSaveCourse}>
            <div className="form-group">
              <label>Course Title</label>
              <input type="text" placeholder="Enter course title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} required>
                  <option value="">Select category</option>
                  <option value="Programming & Development">Programming & Development</option>
                  <option value="Artificial Intelligence & Automation">Artificial Intelligence & Automation</option>
                  <option value="AI Productivity & Prompting">AI Productivity & Prompting</option>
                  <option value="Design & Creativity">Design & Creativity</option>
                </select>
              </div>
              <div className="form-group">
                <label>Regular Price (₹)</label>
                <input type="number" placeholder="Original price" value={formData.regular_price} onChange={e => setFormData({...formData, regular_price: e.target.value})} required min="0" />
              </div>
              <div className="form-group">
                <label>Offer Price (₹) <small>(Optional)</small></label>
                <input type="number" placeholder="Discounted price" value={formData.offer_price} onChange={e => setFormData({...formData, offer_price: e.target.value})} min="0" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Level</label>
                <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} required>
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingTop: '25px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={formData.is_coupon_applicable} onChange={e => setFormData({...formData, is_coupon_applicable: e.target.checked})} />
                  Allow Coupons
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={formData.is_featured} onChange={e => setFormData({...formData, is_featured: e.target.checked})} />
                  Featured Course
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea rows={4} placeholder="Write a detailed course description..." value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>What you'll learn (one per line)</label>
                <textarea rows={4} placeholder="e.g. Build real-world apps&#10;Master standard industry tools" value={formData.learning_outcomes} onChange={e => setFormData({...formData, learning_outcomes: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Requirements (one per line)</label>
                <textarea rows={4} placeholder="e.g. A computer with internet&#10;Basic understanding of computers" value={formData.requirements} onChange={e => setFormData({...formData, requirements: e.target.value})} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Thumbnail URL</label>
                <input type="url" placeholder="Enter thumbnail image URL" value={formData.thumbnail_url} onChange={e => setFormData({...formData, thumbnail_url: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Intro Video URL</label>
                <input type="url" placeholder="Enter promo video URL" value={formData.video_url} onChange={e => setFormData({...formData, video_url: e.target.value})} />
              </div>
            </div>
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setShowModal(false)} type="button">Cancel</Button>
              <Button variant="primary" type="submit">{editCourseId ? 'Save Changes' : 'Create Course'}</Button>
            </div>
          </form>
        </Modal>

        {/* Curriculum Modal */}
        <Modal isOpen={showCurriculumModal} onClose={() => setShowCurriculumModal(false)} title={`Curriculum: ${curriculumCourse?.title}`} size="lg">
          <div className="curriculum-manager">
            <form className="course-form" onSubmit={handleSaveLesson} style={{ marginBottom: '32px', background: 'var(--gray-50)', padding: '24px', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '16px' }}>Add New Lesson</h4>
              <div className="form-row">
                <div className="form-group" ref={curriculumFormRef}>
                  <label>Section Title</label>
                  <input 
                    type="text" 
                    list="section-list"
                    placeholder="Enter section title" 
                    value={lessonFormData.section_title} 
                    onChange={e => setLessonFormData({...lessonFormData, section_title: e.target.value})} 
                    required 
                  />
                  <datalist id="section-list">
                    {Object.keys(groupedLessons).map(s => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Lesson Title</label>
                  <input type="text" placeholder="Enter lesson title" value={lessonFormData.title} onChange={e => setLessonFormData({...lessonFormData, title: e.target.value})} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Video URL (Embed)</label>
                  <input type="url" placeholder="Enter video lesson URL" value={lessonFormData.video_url} onChange={e => setLessonFormData({...lessonFormData, video_url: e.target.value})} onBlur={e => autoDetectDuration(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label>Duration (mins) {detectingDuration && <span style={{fontSize: '0.75rem', color: 'var(--primary)'}}>⏳ Detecting...</span>}</label>
                  <input type="number" placeholder="Auto-detected" value={lessonFormData.duration} onChange={e => setLessonFormData({...lessonFormData, duration: e.target.value})} required min="1" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Lesson Notes (visible to students)</label>
                  <textarea rows={3} placeholder="Add lesson notes and key takeaways..." value={lessonFormData.notes} onChange={e => setLessonFormData({...lessonFormData, notes: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Resources (links, one per line)</label>
                  <textarea rows={3} placeholder="Add resource links (one per line)..." value={lessonFormData.resources} onChange={e => setLessonFormData({...lessonFormData, resources: e.target.value})} />
                </div>
              </div>
              <Button variant="primary" type="submit">Add Lesson</Button>
            </form>

            {/* Hidden ReactPlayer for YouTube duration probing */}
            {probeUrl && (
              <div style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <ReactPlayer
                  url={probeUrl}
                  onDuration={handleProbeDuration}
                  onError={() => { setProbeUrl(null); setDetectingDuration(false); }}
                  width={1} height={1}
                  muted
                />
              </div>
            )}

            <div className="curriculum-list">
              {Object.keys(groupedLessons).length === 0 ? <p className="text-center text-muted">No lessons added yet.</p> : null}
              {Object.entries(groupedLessons).map(([section, lessons]) => (
                <div key={section} style={{ marginBottom: '24px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--gray-200)', paddingBottom: '8px', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0 }}>{section}</h4>
                    <button 
                      className="btn-icon" 
                      onClick={() => {
                        setLessonFormData(prev => ({ ...prev, section_title: section }));
                        curriculumFormRef.current?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      title="Add lesson to this section"
                      style={{ height: 28, width: 28, fontSize: '0.9rem' }}
                    >
                      <FiPlus />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {lessons.map(l => (
                      <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '12px 16px', border: '1px solid var(--gray-200)', borderRadius: '6px' }}>
                        <div>
                          <strong>{l.title}</strong>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--gray-500)' }}>{l.duration} mins • {l.video_url}</span>
                          {l.notes && <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px' }}>📝 Notes added</span>}
                          {l.resources && <span style={{ display: 'block', fontSize: '0.75rem', color: '#059669', marginTop: '2px' }}>📎 Resources attached</span>}
                        </div>
                        <button className="id-action-btn danger" onClick={() => deleteLesson(l.id)}><FiTrash2 /></button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>

        {/* ═══ Assessments Tab ═══ */}
        {tab === 'assessments' && (
          <div className="id-courses animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0 }}>Course Assessments</h3>
            </div>

            {courses.length === 0 ? (
              <p className="text-muted">Create courses first, then add assessments to them.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {courses.map(c => {
                  const assess = assessments.find(a => a.course_id === c.id);
                  return (
                    <div key={c.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '12px', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div>
                        <strong style={{ fontSize: '1rem' }}>{c.title}</strong>
                        {assess ? (
                          <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
                            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}><FiCheckCircle style={{marginRight: 4}} /> Assessment Active</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>Pass: {assess.pass_percentage}% • {assess.time_limit_minutes ? assess.time_limit_minutes + ' mins' : 'No limit'} • {assess.max_attempts || '∞'} attempts</span>
                          </div>
                        ) : (
                          <p style={{ margin: '6px 0 0', color: 'var(--gray-400)', fontSize: '0.85rem' }}>No assessment created yet</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {assess ? (
                          <>
                            <button className="btn btn-outline btn-sm" onClick={() => openEditAssessment(assess)}><FiEdit2 /> Edit</button>
                            <button className="btn btn-primary btn-sm" onClick={() => openAssessmentQuestions(assess)}><FiList /> Questions ({assessQuestions.filter(q => q.assessment_id === assess.id).length > 0 ? assessQuestions.filter(q => q.assessment_id === assess.id).length : '0'})</button>
                          </>
                        ) : (
                          <button className="btn btn-primary btn-sm" onClick={() => openCreateAssessment(c.id)}><FiPlus /> Create Assessment</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Assessment Settings Modal */}
        <Modal isOpen={showAssessmentModal && !editAssessment?._showQuestions} onClose={() => setShowAssessmentModal(false)} title={editAssessment ? 'Edit Assessment Settings' : 'Create Assessment'} size="md">
          <form className="course-form" onSubmit={handleSaveAssessment}>
            <div className="form-group">
              <label>Assessment Title</label>
              <input type="text" value={assessForm.title} onChange={e => setAssessForm({...assessForm, title: e.target.value})} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Pass Percentage (%)</label>
                <input type="number" value={assessForm.pass_percentage} onChange={e => setAssessForm({...assessForm, pass_percentage: e.target.value})} required min="1" max="100" />
              </div>
              <div className="form-group">
                <label>Time Limit (minutes) <small>(leave empty for no limit)</small></label>
                <input type="number" value={assessForm.time_limit_minutes} onChange={e => setAssessForm({...assessForm, time_limit_minutes: e.target.value})} min="1" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Max Attempts <small>(leave empty for unlimited)</small></label>
                <input type="number" value={assessForm.max_attempts} onChange={e => setAssessForm({...assessForm, max_attempts: e.target.value})} min="1" />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', paddingTop: '25px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={assessForm.shuffle_questions} onChange={e => setAssessForm({...assessForm, shuffle_questions: e.target.checked})} />
                  Shuffle Questions
                </label>
              </div>
            </div>
            <div className="form-actions">
              <Button variant="ghost" onClick={() => setShowAssessmentModal(false)} type="button">Cancel</Button>
              <Button variant="primary" type="submit" disabled={assessSaving}>{assessSaving ? 'Saving...' : (editAssessment ? 'Save Changes' : 'Create Assessment')}</Button>
            </div>
          </form>
        </Modal>

        {/* Assessment Questions Modal */}
        <Modal isOpen={!!editAssessment?._showQuestions} onClose={() => { setEditAssessment(null); setShowAssessmentModal(false); }} title={`Questions: ${editAssessment?.title || ''}`} size="lg">
          <div className="curriculum-manager">
            <form className="course-form" onSubmit={handleAddQuestion} style={{ marginBottom: '24px', background: 'var(--gray-50)', padding: '24px', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '16px' }}>Add New Question</h4>
              <div className="form-group">
                <label>Question</label>
                <textarea rows={2} value={qForm.question_text} onChange={e => setQForm({...qForm, question_text: e.target.value})} placeholder="Enter the question..." required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                {qForm.options.map((opt, idx) => (
                  <div className="form-group" key={idx} style={{ position: 'relative', margin: 0 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <input type="radio" name="correct" checked={qForm.correct_option === idx} onChange={() => setQForm({...qForm, correct_option: idx})} style={{ margin: 0 }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray-600)' }}>Option {String.fromCharCode(65 + idx)}</span>
                      {qForm.correct_option === idx && <span style={{color: '#10b981', fontSize: '0.75rem', fontWeight: 700}}>(Correct)</span>}
                    </label>
                    <input type="text" value={opt} onChange={e => {
                      const newOpts = [...qForm.options];
                      newOpts[idx] = e.target.value;
                      setQForm({...qForm, options: newOpts});
                    }} placeholder={`Enter option ${String.fromCharCode(65 + idx)}...`} required style={{ width: '100%' }} />
                  </div>
                ))}
              </div>
              <Button variant="primary" type="submit">Add Question</Button>
            </form>

            <div className="curriculum-list">
              {assessQuestions.filter(q => q.assessment_id === editAssessment?.id).length === 0 ? (
                <p className="text-center text-muted">No questions added yet.</p>
              ) : (
                assessQuestions.filter(q => q.assessment_id === editAssessment?.id).map((q, idx) => (
                  <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#fff', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: '0.9rem' }}>Q{idx + 1}. {q.question_text}</strong>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                        {(q.options || []).map((opt, oi) => (
                          <span key={oi} style={{ fontSize: '0.85rem', color: oi === q.correct_option ? '#10b981' : 'var(--gray-600)', fontWeight: oi === q.correct_option ? 600 : 400 }}>
                            {String.fromCharCode(65 + oi)}. {opt} {oi === q.correct_option && '✓'}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="id-action-btn danger" onClick={() => deleteQuestion(q.id)}><FiTrash2 /></button>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>

      </div>
    </div>
  );
}
