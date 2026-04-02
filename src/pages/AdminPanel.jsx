import { useState, useEffect, useRef } from 'react';
import { FiUsers, FiBookOpen, FiDollarSign, FiCheckCircle, FiSearch, FiMoreVertical, FiShield, FiTrendingUp, FiTrash2, FiEye, FiMapPin, FiPhone, FiLinkedin, FiAward, FiBriefcase, FiMail, FiCalendar, FiHash, FiClock, FiPercent, FiPlayCircle, FiInfo, FiMessageSquare, FiTag, FiFileText, FiLink, FiUser, FiImage, FiStar } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import Skeleton from '../components/ui/Skeleton';
import Modal from '../components/ui/Modal';
import RevenueAnalytics from '../components/admin/RevenueAnalytics';
import MarketingBanners from '../components/admin/MarketingBanners';
import CertificateGenerator from '../components/admin/CertificateGenerator';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import { mapCategory } from '../data/categories';
import { generateUserCode } from '../utils/userCode';
import './AdminPanel.css';

export default function AdminPanel() {
  const { user, profile } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const [tab, setTab] = useState('dashboard');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [searchUsers, setSearchUsers] = useState('');
  const [searchCourses, setSearchCourses] = useState('');
  
  // New Filters
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [courseStatusFilter, setCourseStatusFilter] = useState('all');
  const [courseCategoryFilter, setCourseCategoryFilter] = useState('all');
  
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [courseReviews, setCourseReviews] = useState([]);
  const [searchReviews, setSearchReviews] = useState('');
  const [showJobModal, setShowJobModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [couponForm, setCouponForm] = useState({ code: '', discount_type: 'percentage', discount_value: '', course_id: '', expiry_date: '', usage_limit: '' });
  const [couponSubmitting, setCouponSubmitting] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobForm, setJobForm] = useState({ company_name: '', role: '', category: 'Freshers', salary: '', location: '', job_type: 'Full-time', qualification: '', vacancies: '', description: '', venue: '', contact_details: '', date_time: '', apply_link: '', expiry_date: '', is_urgent: false, job_mode: 'apply_link' });
  const [jobSubmitting, setJobSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeMenu, setActiveMenu] = useState(null); // { id, type, rect }
  const [revenue, setRevenue] = useState(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState(new Array(12).fill(0));
  const [profileUser, setProfileUser] = useState(null);
  const [profileExtras, setProfileExtras] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  
  // Review Mode State
  const [reviewCourse, setReviewCourse] = useState(null);
  const [reviewLessons, setReviewLessons] = useState([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [activeReviewTitle, setActiveReviewTitle] = useState(null);
  const [activeReviewVideo, setActiveReviewVideo] = useState(null);
  const [reviewAssessment, setReviewAssessment] = useState(null);
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [approvalSubTab, setApprovalSubTab] = useState('courses'); // 'courses', 'instructors', 'blogs'
  
  const dropdownRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const openUserProfile = async (u) => {
    setActiveMenu(null);
    setProfileUser(u);
    setProfileExtras(null);
    setProfileLoading(true);
    try {
      if (u.role === 'student') {
        // Fetch enrollments with course info
        const { data: enrollments } = await supabase
          .from('enrollments')
          .select('*, course:courses(id, title, category, thumbnail_url, price)')
          .eq('user_id', u.id);
        // Fetch certificates
        const { data: certs } = await supabase
          .from('certificates')
          .select('*, course:courses(title)')
          .eq('user_id', u.id);
        setProfileExtras({
          enrollments: enrollments || [],
          certificates: certs || [],
        });
      } else if (u.role === 'instructor') {
        // Fetch all courses (any status)
        const { data: instrCourses } = await supabase
          .from('courses')
          .select('id, title, category, status, price, student_count, created_at')
          .eq('instructor_id', u.id);
        // Fetch payments for instructor's courses
        const courseIds = (instrCourses || []).map(c => c.id);
        let totalRevenue = 0;
        if (courseIds.length > 0) {
          const { data: payments } = await supabase
            .from('payments')
            .select('amount')
            .in('course_id', courseIds)
            .eq('status', 'completed');
          totalRevenue = (payments || []).reduce((acc, p) => acc + (p.amount || 0), 0);
        }
        setProfileExtras({
          courses: instrCourses || [],
          revenue: totalRevenue,
        });
      } else if (u.role === 'author') {
        // Fetch all blogs by this author
        const { data: authorBlogs } = await supabase
          .from('blogs')
          .select('id, title, slug, excerpt, cover_image, status, created_at')
          .eq('author_id', u.id)
          .order('created_at', { ascending: false });
        setProfileExtras({
          blogs: authorBlogs || [],
        });
      }
    } catch (err) {
      console.error('Error fetching profile extras:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleMenuToggle = (e, id, type) => {
    e.stopPropagation();
    if (activeMenu?.id === id && activeMenu?.type === type) {
      setActiveMenu(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setActiveMenu({ id, type, rect });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  const [recentActivities, setRecentActivities] = useState([]);
  const [activityFilter, setActivityFilter] = useState('all');

  useEffect(() => {
    async function fetchAdminData() {
      setLoading(true);
      const year = new Date().getFullYear();
      const [usersRes, coursesRes, requestsRes, paymentsRes, enrollRes, blogsRes, jobsRes, messagesRes, couponsRes, reviewsRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('courses').select('*, instructor:users(name)').order('created_at', { ascending: false }),
        supabase.from('instructor_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('payments').select('*, user:users(name), course:courses(title)')
          .order('created_at', { ascending: false }),
        supabase.from('enrollments').select('*, user:users(name), course:courses(title)')
          .order('enrolled_at', { ascending: false })
          .limit(50),
        supabase.from('blogs').select('*, author:users(name)').order('created_at', { ascending: false }),
        supabase.from('jobs').select('*').order('created_at', { ascending: false }),
        supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
        supabase.from('coupons').select('*, course:courses(title)').order('created_at', { ascending: false }),
        supabase.from('course_reviews').select('*, user:users(name, avatar_url), course:courses(title)').order('created_at', { ascending: false })
      ]);
      
      if (!usersRes.error) setUsers(usersRes.data || []);
      if (!coursesRes.error) setCourses(coursesRes.data || []);
      if (!requestsRes.error) setRequests(requestsRes.data || []);
      if (!blogsRes.error) setBlogs(blogsRes.data || []);
      if (!jobsRes.error) setJobs(jobsRes.data || []);
      if (!messagesRes.error) setMessages(messagesRes.data || []);
      if (!paymentsRes.error) setPayments(paymentsRes.data || []);
      if (!couponsRes.error) setCoupons(couponsRes.data || []);
      if (!reviewsRes.error) setCourseReviews(reviewsRes.data || []);
      
      if (!paymentsRes.error && paymentsRes.data) {
        const total = paymentsRes.data.reduce((acc, p) => acc + Number(p.amount), 0);
        setRevenue(total);
        
        const monthly = new Array(12).fill(0);
        paymentsRes.data.forEach(p => {
          const month = new Date(p.created_at).getMonth();
          monthly[month] += Number(p.amount);
        });
        setMonthlyRevenue(monthly);
      }

      // Aggregate all activities for the "Activities" tab
      const activities = [
        ...(usersRes.data || []).map(u => ({ id: `u-${u.id}`, type: 'user', title: 'New User Registered', message: `<strong>${u.name}</strong> (${u.email}) joined the platform.`, time: u.created_at })),
        ...(coursesRes.data || []).map(c => ({ id: `c-${c.id}`, type: 'course', title: 'New Course Published', message: `<strong>"${c.title}"</strong> was created by ${c.instructor?.name || 'an instructor'}.`, time: c.created_at })),
        ...(enrollRes.data || []).map(e => ({ id: `e-${e.id}`, type: 'enroll', title: 'New Student Enrolled', message: `<strong>${e.user?.name}</strong> enrolled in <strong>"${e.course?.title}"</strong>.`, time: e.enrolled_at })),
        ...(paymentsRes.data || []).map(p => ({ id: `p-${p.id}`, type: 'payment', title: 'Course Sale', message: `<strong>${p.user?.name}</strong> purchased <strong>"${p.course?.title}"</strong> for ₹${p.amount}.`, time: p.created_at }))
      ].sort((a, b) => new Date(b.time) - new Date(a.time));

      setRecentActivities(activities);
      setLoading(false);
    }
    fetchAdminData();
  }, []);

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'recently';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const sendNotification = async (userId, title, message, type = 'system') => {
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        title,
        message,
        type
      });
    } catch (err) {
      console.error('Error sending notification:', err);
    }
  };
  
  const openCourseReview = async (c) => {
    setReviewCourse(c);
    setReviewLessons([]);
    setReviewLoading(true);
    setActiveReviewVideo(null);
    setActiveReviewTitle(null);
    setReviewAssessment(null);
    setReviewQuestions([]);
    try {
      // Fetch lessons
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('course_id', c.id)
        .order('order_index', { ascending: true });
      if (error) throw error;
      setReviewLessons(data || []);

      // Fetch assessment + questions
      const { data: assessData } = await supabase
        .from('assessments').select('*').eq('course_id', c.id).single();
      if (assessData) {
        setReviewAssessment(assessData);
        const { data: qData } = await supabase
          .from('assessment_questions').select('*').eq('assessment_id', assessData.id).order('order_index');
        setReviewQuestions(qData || []);
      }
    } catch (err) {
      console.error('Error fetching review data:', err);
    } finally {
      setReviewLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchUsers.toLowerCase();
    const matchesSearch = (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || generateUserCode(u.id).toLowerCase().includes(q);
    const matchesFilter = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredCourses = courses.filter(c => {
    const q = searchCourses.toLowerCase();
    const matchesSearch = c.title.toLowerCase().includes(q);
    const matchesStatus = courseStatusFilter === 'all' || c.status === courseStatusFilter;
    const matchesCategory = courseCategoryFilter === 'all' || mapCategory(c.category) === courseCategoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  // In a real app, revenue would come from a payments table. Using a placeholder calculation based on courses.
  const stats = {
    users: users.length,
    courses: courses.length,
    revenue: `₹${revenue.toLocaleString('en-IN')}`,
    pending: courses.filter(c => c.status === 'pending').length,
    requests: requests.filter(r => r.status === 'pending').length,
    pendingBlogs: blogs.filter(b => b.status === 'pending').length,
    unreadMessages: messages.filter(m => m.status === 'unread').length,
    totalPending: courses.filter(c => c.status === 'pending').length + 
                  requests.filter(r => r.status === 'pending').length + 
                  blogs.filter(b => b.status === 'pending').length
  };

  const handleApproval = async (courseId, newStatus) => {
    setActiveMenu(null);
    const confirmed = await showConfirm(`Are you sure you want to change this course's status to ${newStatus}?`, undefined, 'Confirm Status', 'Yes, change it');
    if (!confirmed) return;
    
    try {
      const { data, error } = await supabase.from('courses').update({ status: newStatus }).eq('id', courseId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Permission denied by database (Check RLS policies).");
      setCourses(courses.map(c => c.id === courseId ? { ...c, status: newStatus } : c));
    } catch (error) {
      await showAlert("Error updating course status: " + error.message, 'Update Failed', 'error');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setActiveMenu(null);
    const confirmed = await showConfirm(`Are you sure you want to change this user's role to ${newRole}?`, undefined, 'Confirm Role Change');
    if (!confirmed) return;

    try {
      const { data, error } = await supabase.from('users').update({ role: newRole }).eq('id', userId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Permission denied by database (Check RLS policies).");
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
      
      await sendNotification(userId, 'Account Updated', `Your role has been updated to <strong>${newRole.toUpperCase()}</strong> by the administrator.`, 'system');
    } catch (error) {
      await showAlert("Error updating user role: " + error.message, 'Update Failed', 'error');
    }
  };

  const handleBlogStatus = async (blogId, newStatus) => {
    try {
      const { error } = await supabase.from('blogs').update({ status: newStatus }).eq('id', blogId);
      if (error) throw error;
      setBlogs(blogs.map(b => b.id === blogId ? { ...b, status: newStatus } : b));
    } catch (error) {
      await showAlert("Error updating blog status: " + error.message, 'Update Failed', 'error');
    }
  };

  const handleDeleteBlog = async (blogId) => {
    const confirmed = await showConfirm("Are you sure you want to delete this blog? This action cannot be undone.", undefined, 'Delete Blog', 'Delete', 'Cancel');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('blogs').delete().eq('id', blogId);
      if (error) throw error;
      setBlogs(blogs.filter(b => b.id !== blogId));
    } catch (error) {
      await showAlert("Error deleting blog: " + error.message, 'Delete Failed', 'error');
    }
  };

  const handleDeleteUser = async (userId) => {
    setActiveMenu(null);
    const confirmed = await showConfirm("Are you sure you want to delete this user? This action cannot be undone.", undefined, 'Delete User', 'Delete', 'Cancel');
    if (!confirmed) return;

    try {
      const { data, error } = await supabase.from('users').delete().eq('id', userId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Permission denied by database (Check RLS policies).");
      setUsers(users.filter(u => u.id !== userId));
    } catch (error) {
      await showAlert("Error deleting user: " + error.message, 'Delete Failed', 'error');
    }
  };

  const handleDeleteCourse = async (courseId) => {
    setActiveMenu(null);
    const confirmed = await showConfirm("Are you sure you want to delete this course? This will also remove all payments, enrollments, lessons, reviews, and certificates linked to it. This action cannot be undone.", undefined, 'Delete Course', 'Delete', 'Cancel');
    if (!confirmed) return;

    try {
      // Delete all dependent records first to avoid foreign key constraint errors
      const dependentTables = ['assessment_attempts', 'payments', 'enrollments', 'lessons', 'course_reviews', 'certificates', 'assessments'];
      for (const table of dependentTables) {
        const { error } = await supabase.from(table).delete().eq('course_id', courseId);
        if (error) {
          console.warn(`Warning: Could not clean ${table}:`, error.message);
          // Continue even if a table doesn't exist or has no matching rows
        }
      }

      // Now delete the course itself
      const { data, error } = await supabase.from('courses').delete().eq('id', courseId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Permission denied by database (Check RLS policies).");
      setCourses(courses.filter(c => c.id !== courseId));
      await showAlert("Course and all related data deleted successfully.", 'Deleted', 'success');
    } catch (error) {
      await showAlert("Error deleting course: " + error.message, 'Delete Failed', 'error');
    }
  };

  const handleRequestAction = async (requestId, newStatus, userId) => {
    try {
      const { data, error } = await supabase.from('instructor_requests').update({ status: newStatus }).eq('id', requestId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Permission denied by database (Check RLS).");
      
      if (newStatus === 'approved' && userId) {
        await supabase.from('users').update({ role: 'instructor' }).eq('id', userId);
        setUsers(users.map(u => u.id === userId ? { ...u, role: 'instructor' } : u));
        
        await sendNotification(userId, 'Instructor Request Approved', 'Congratulations! You are now an instructor. You can now publish your own courses.', 'achievement');
      } else if (newStatus === 'rejected' && userId) {
        await sendNotification(userId, 'Instructor Request Rejected', 'Your request to become an instructor was not approved at this time.', 'system');
      }
      
      setRequests(requests.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
      await showAlert(`Request ${newStatus}.`, 'Success', 'success');
    } catch (error) {
      await showAlert("Error updating request: " + error.message, 'Update Failed', 'error');
    }
  };

  const handleEditJob = (job) => {
    setActiveMenu(null);
    setEditingJob(job);
    // Infer job_mode from existing data
    const hasApplyLink = job.apply_link && job.apply_link.trim();
    const hasWalkinDetails = (job.venue && job.venue.trim()) || (job.date_time && job.date_time.trim());
    let inferredMode = 'apply_link';
    if (job.job_mode) {
      inferredMode = job.job_mode;
    } else if (hasApplyLink && hasWalkinDetails) {
      inferredMode = 'both';
    } else if (hasWalkinDetails) {
      inferredMode = 'walkin';
    }
    setJobForm({ ...job, job_mode: inferredMode });
    setShowJobModal(true);
  };

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    setJobSubmitting(true);
    try {
      const payload = { ...jobForm };
      // Clean up optional fields
      if (!payload.expiry_date) delete payload.expiry_date;
      if (!payload.vacancies) payload.vacancies = null;
      // Clean fields based on job_mode
      if (payload.job_mode === 'walkin') {
        if (!payload.apply_link) delete payload.apply_link;
      } else if (payload.job_mode === 'apply_link') {
        if (!payload.venue) delete payload.venue;
        if (!payload.date_time) delete payload.date_time;
      }
      // Validation: at least one method
      const hasApplyLink = payload.apply_link && payload.apply_link.trim();
      const hasWalkinDetails = (payload.venue && payload.venue.trim()) || (payload.date_time && payload.date_time.trim());
      if (!hasApplyLink && !hasWalkinDetails) {
        await showAlert('Please provide either an Apply Link or Walk-in details (Venue/Date & Time).', 'Validation Error', 'warning');
        setJobSubmitting(false);
        return;
      }

      if (editingJob) {
        const { data, error } = await supabase.from('jobs').update(payload).eq('id', editingJob.id).select();
        if (error) throw error;
        setJobs(jobs.map(j => j.id === editingJob.id ? data[0] : j));
        await showAlert("Job updated successfully.", "Success", "success");
      } else {
        const { data, error } = await supabase.from('jobs').insert([payload]).select();
        if (error) throw error;
        setJobs([data[0], ...jobs]);
        await showAlert("Job posted successfully.", "Success", "success");
      }
      setShowJobModal(false);
      setEditingJob(null);
    } catch (err) {
      await showAlert("Error saving job: " + err.message, "Save Failed", "error");
    } finally {
      setJobSubmitting(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    setActiveMenu(null);
    const confirmed = await showConfirm("Are you sure you want to delete this job?", undefined, "Delete Job", "Delete", "Cancel");
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', jobId);
      if (error) throw error;
      setJobs(jobs.filter(j => j.id !== jobId));
    } catch (err) {
      await showAlert("Error deleting job: " + err.message, "Delete Failed", "error");
    }
  };

  const handleMessageStatus = async (messageId, newStatus) => {
    try {
      const { error } = await supabase.from('contact_messages').update({ status: newStatus }).eq('id', messageId);
      if (error) throw error;
      setMessages(messages.map(m => m.id === messageId ? { ...m, status: newStatus } : m));
    } catch (error) {
      await showAlert("Error updating message status: " + error.message, 'Update Failed', 'error');
    }
  };

  const handleDeleteMessage = async (messageId) => {
    const confirmed = await showConfirm("Are you sure you want to delete this message?", undefined, 'Delete Message', 'Delete', 'Cancel');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('contact_messages').delete().eq('id', messageId);
      if (error) throw error;
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (error) {
      await showAlert("Error deleting message: " + error.message, 'Delete Failed', 'error');
    }
  };

  const handleCouponSubmit = async (e) => {
    e.preventDefault();
    setCouponSubmitting(true);
    try {
      const payload = {
        code: couponForm.code.toUpperCase(),
        discount_type: couponForm.discount_type,
        discount_value: parseFloat(couponForm.discount_value),
        course_id: couponForm.course_id || null,
        expiry_date: couponForm.expiry_date || null,
        usage_limit: couponForm.usage_limit ? parseInt(couponForm.usage_limit) : null
      };

      if (editingCoupon) {
        const { data, error } = await supabase.from('coupons').update(payload).eq('id', editingCoupon.id).select('*, course:courses(title)');
        if (error) throw error;
        setCoupons(coupons.map(c => c.id === editingCoupon.id ? data[0] : c));
        await showAlert("Coupon updated successfully.", "Success", "success");
      } else {
        const { data, error } = await supabase.from('coupons').insert([payload]).select('*, course:courses(title)');
        if (error) throw error;
        setCoupons([data[0], ...coupons]);
        await showAlert("Coupon created successfully.", "Success", "success");
      }
      setShowCouponModal(false);
      setEditingCoupon(null);
    } catch (err) {
      await showAlert("Error saving coupon: " + err.message, "Save Failed", "error");
    } finally {
      setCouponSubmitting(false);
    }
  };

  const handleCouponStatusToggle = async (couponId, currentStatus) => {
    try {
      const { error } = await supabase.from('coupons').update({ is_active: !currentStatus }).eq('id', couponId);
      if (error) throw error;
      setCoupons(coupons.map(c => c.id === couponId ? { ...c, is_active: !currentStatus } : c));
    } catch (err) {
      await showAlert("Error toggling status: " + err.message, "Update Failed", "error");
    }
  };

  const handleDeleteCoupon = async (couponId) => {
    const confirmed = await showConfirm("Delete this coupon code permanently?", undefined, "Delete Coupon", "Delete", "Cancel");
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('coupons').delete().eq('id', couponId);
      if (error) throw error;
      setCoupons(coupons.filter(c => c.id !== couponId));
    } catch (err) {
      await showAlert("Error deleting coupon: " + err.message, "Delete Failed", "error");
    }
  };

  const handleDeleteReview = async (reviewId) => {
    const confirmed = await showConfirm("Are you sure you want to delete this review? This action cannot be undone.", undefined, 'Delete Review', 'Delete', 'Cancel');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('course_reviews').delete().eq('id', reviewId);
      if (error) throw error;
      setCourseReviews(courseReviews.filter(r => r.id !== reviewId));
      await showAlert("Review deleted successfully.", "Deleted", "success");
    } catch (err) {
      await showAlert("Error deleting review: " + err.message, 'Delete Failed', 'error');
    }
  };

  return (
    <div className="admin-panel section">
      <div className="container">
        <div className="ap-hero animate-fade">
          <div className="ap-hero-main">
            <div className="ap-hero-welcome">
              <span className="hero-time-badge">
                <FiClock style={{marginRight: 6}} /> {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <h1>Good {currentTime.getHours() < 12 ? 'Morning' : currentTime.getHours() < 17 ? 'Afternoon' : 'Evening'}, {profile?.name?.split(' ')[0] || 'Admin'}</h1>
              <p>Welcome back! Here's what's happening on <strong>Open Skools</strong> today.</p>
              
              <div className="ap-hero-quick-actions">
                <button className="action-pill" onClick={() => { setTab('jobs'); setShowJobModal(true); setEditingJob(null); }}>
                   <FiBriefcase /> Post Job
                </button>
                <button className="action-pill" onClick={() => { setTab('approvals'); setApprovalSubTab('blogs'); }}>
                   <FiBookOpen /> Moderate Blogs
                </button>
                <button className="action-pill" onClick={() => setTab('messages')}>
                   <FiMail /> Check Messages
                </button>
              </div>
            </div>
            <div className="ap-hero-status">
              <div className="status-date">
                <FiCalendar style={{marginRight: 8}} />
                <span>{currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</span>
              </div>
              <div className="status-badge-wrap">
                 <span className="badge badge-primary"><FiShield /> Admin Access Verified</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="ap-tabs">
          <button className={`ap-tab ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>Dashboard</button>
          <button className={`ap-tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Users</button>
          <button className={`ap-tab ${tab === 'courses' ? 'active' : ''}`} onClick={() => setTab('courses')}>Courses</button>
          <button className={`ap-tab ${tab === 'revenue' ? 'active' : ''}`} onClick={() => setTab('revenue')}>Revenue</button>
          <button className={`ap-tab ${tab === 'activities' ? 'active' : ''}`} onClick={() => setTab('activities')}>Activities</button>
          <button className={`ap-tab ${tab === 'approvals' ? 'active' : ''}`} onClick={() => setTab('approvals')}>Requests <span className="ap-badge-count">{stats.totalPending || 0}</span></button>
          <button className={`ap-tab ${tab === 'marketing' ? 'active' : ''}`} onClick={() => setTab('marketing')}><FiImage style={{marginRight: 4}} /> Marketing</button>
          <button className={`ap-tab ${tab === 'coupons' ? 'active' : ''}`} onClick={() => setTab('coupons')}>Coupons</button>
          <button className={`ap-tab ${tab === 'messages' ? 'active' : ''}`} onClick={() => setTab('messages')}>Messages <span className="ap-badge-count">{stats.unreadMessages || 0}</span></button>
          <button className={`ap-tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}><FiStar style={{marginRight: 4}} /> Reviews <span className="ap-badge-count">{courseReviews.length || 0}</span></button>
          <button className={`ap-tab ${tab === 'certificates' ? 'active' : ''}`} onClick={() => setTab('certificates')}><FiAward style={{marginRight: 4}} /> Certificates</button>
        </div>

        {loading ? (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
             <Skeleton height={100} />
             <Skeleton height={300} />
          </div>
        ) : (
          <>
            {/* Dashboard Tab */}
            {tab === 'dashboard' && (
              <div className="ap-dashboard animate-fade">
                <div className="ap-stats">
                  <div className="ap-stat-card">
                    <div className="stat-icon-wrap blue"><FiUsers /></div>
                    <div className="ap-stat-info">
                      <span>Total Users</span>
                      <strong>{stats.users}</strong>
                      <div className="stat-trend positive"><FiTrendingUp /> +{users.filter(u => new Date(u.created_at) > new Date(Date.now() - 7*24*60*60*1000)).length} this week</div>
                    </div>
                  </div>
                  <div className="ap-stat-card">
                    <div className="stat-icon-wrap purple"><FiBookOpen /></div>
                    <div className="ap-stat-info">
                      <span>Total Courses</span>
                      <strong>{stats.courses}</strong>
                      <div className="stat-trend"><FiCheckCircle /> {courses.filter(c => c.status === 'approved').length} Active</div>
                    </div>
                  </div>
                  <div className="ap-stat-card">
                    <div className="stat-icon-wrap green"><FiDollarSign /></div>
                    <div className="ap-stat-info">
                      <span>Total Revenue</span>
                      <strong>{stats.revenue}</strong>
                      <div className="stat-trend positive"><FiTrendingUp /> ₹{monthlyRevenue[new Date().getMonth()].toLocaleString()} this month</div>
                    </div>
                  </div>
                  <div className="ap-stat-card">
                    <div className="stat-icon-wrap orange"><FiHash /></div>
                    <div className="ap-stat-info">
                      <span>Pending Actions</span>
                      <strong>{stats.pending + stats.requests + stats.unreadMessages}</strong>
                      <div className="stat-trend alert">{stats.pending} Courses • {stats.requests} Requests</div>
                    </div>
                  </div>
                </div>

                <div className="ap-dashboard-grid">
                  <div className="ap-card">
                    <div className="ap-card-header">
                      <h3><FiTrendingUp /> Recent Site Activity</h3>
                      <button className="btn-text" onClick={() => setTab('activities')}>Full Log</button>
                    </div>
                    <div className="ap-activity-list mini">
                      {recentActivities.slice(0, 5).map((act, i) => (
                        <div key={act.id} className="ap-activity-item">
                          <span className={`ap-activity-dot ${act.type}`} />
                          <div className="ap-activity-text">
                            <span className="ap-activity-desc" dangerouslySetInnerHTML={{ __html: act.message }} />
                            <span className="ap-activity-time">{formatTimeAgo(act.time)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="ap-card">
                    <div className="ap-card-header">
                      <h3>Platform Overview</h3>
                    </div>
                    <div className="ap-overview-items">
                      <div className="ap-overview-item">
                        <div className="overview-label">Students</div>
                        <strong>{users.filter(u => u.role === 'student').length}</strong>
                      </div>
                      <div className="ap-overview-item">
                        <div className="overview-label">Instructors</div>
                        <strong>{users.filter(u => u.role === 'instructor').length}</strong>
                      </div>
                      <div className="ap-overview-item">
                        <div className="overview-label">Admins</div>
                        <strong>{users.filter(u => u.role === 'admin').length}</strong>
                      </div>
                      <div className="ap-overview-item">
                        <div className="overview-label">Jobs Posted</div>
                        <strong>{jobs.length}</strong>
                      </div>
                      <div className="progress-separator" />
                      <div className="ap-overview-item">
                        <div className="overview-label">Blog Posts</div>
                        <strong>{blogs.length}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Marketing Tab */}
            {tab === 'marketing' && (
              <MarketingBanners />
            )}

            {/* Users Tab */}
            {tab === 'users' && (
              <div className="ap-users animate-fade">
                <div className="ap-search-row">
                  <div className="ap-search"><FiSearch /><input placeholder="Search by name, email or User ID (OS-XXXX)..." value={searchUsers} onChange={e => setSearchUsers(e.target.value)} /></div>
                  <div className="ap-activity-filters" style={{ marginTop: '16px' }}>
                    {['all', 'student', 'instructor', 'admin', 'author'].map(role => (
                      <button 
                        key={role} 
                        className={`ap-filter-pill ${userRoleFilter === role ? 'active' : ''}`}
                        onClick={() => setUserRoleFilter(role)}
                      >
                        {role === 'all' ? 'All Roles' : role.charAt(0).toUpperCase() + role.slice(1)} ({users.filter(u => role === 'all' || u.role === role).length})
                      </button>
                    ))}
                  </div>
                </div>
                <div className="id-table-wrap" ref={dropdownRef}>
                  <table className="id-table">
                    <thead><tr><th>ID</th><th>User</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredUsers.length > 0 ? filteredUsers.map(u => (
                        <tr key={u.id}>
                          <td><span className="ap-user-code">{generateUserCode(u.id)}</span></td>
                          <td><div className="id-user-cell"><div className="avatar-circle" style={{width:32,height:32,borderRadius:'50%',backgroundColor:'#e0e0e0',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold',color:'#666'}}>{u.name?.charAt(0) || 'U'}</div><span>{u.name || 'Unknown'}</span></div></td>
                          <td>{u.email}</td>
                          <td><span className={`badge badge-${u.role === 'admin' ? 'danger' : u.role === 'instructor' ? 'primary' : u.role === 'author' ? 'info' : 'success'}`}>{u.role}</span></td>
                          <td>{new Date(u.created_at).toLocaleDateString()}</td>
                          <td style={{ position: 'relative' }}>
                            <button 
                              className={`id-action-btn ${activeMenu?.id === u.id ? 'active' : ''}`} 
                              onClick={(e) => handleMenuToggle(e, u.id, 'user')}
                            >
                              <FiMoreVertical />
                            </button>
                            {activeMenu?.id === u.id && activeMenu.type === 'user' && (
                              <div 
                                className="ap-dropdown-menu animate-scale fixed-menu"
                                style={{ 
                                  top: `${activeMenu.rect.bottom + 5}px`, 
                                  left: `${activeMenu.rect.right - 180}px` 
                                }}
                              >
                                <div className="dropdown-label">Change Role</div>
                                <button className={u.role === 'student' ? 'active' : ''} onClick={() => handleRoleChange(u.id, 'student')}>Student</button>
                                <button className={u.role === 'instructor' ? 'active' : ''} onClick={() => handleRoleChange(u.id, 'instructor')}>Instructor</button>
                                <button className={u.role === 'admin' ? 'active' : ''} onClick={() => handleRoleChange(u.id, 'admin')}>Admin</button>
                                <button className={u.role === 'author' ? 'active' : ''} onClick={() => handleRoleChange(u.id, 'author')}>Author</button>
                                <div className="dropdown-divider" />
                                <button onClick={() => openUserProfile(u)}><FiEye style={{marginRight: 8}} /> View Profile</button>
                                <button className="danger" onClick={() => handleDeleteUser(u.id)}><FiTrash2 style={{marginRight: 8}} /> Delete User</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )) : <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>No users found.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="ap-table-footer" style={{ marginTop: '16px', padding: '12px 20px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', borderRadius: '0 0 8px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <div style={{ color: 'var(--gray-500)' }}>
                    Showing <strong>{filteredUsers.length}</strong> users
                  </div>
                  {userRoleFilter !== 'all' && (
                    <div className="badge badge-primary" style={{ fontSize: '0.75rem' }}>
                      Role: {userRoleFilter.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Courses Tab */}
            {tab === 'courses' && (
              <div className="ap-courses animate-fade">
                <div className="ap-search-row">
                  <div className="ap-search"><FiSearch /><input placeholder="Search courses..." value={searchCourses} onChange={e => setSearchCourses(e.target.value)} /></div>
                  
                  <div className="ap-filters-grid" style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                    <div className="ap-activity-filters">
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--gray-400)', marginRight: '10px' }}>STATUS:</span>
                      {['all', 'pending', 'approved', 'rejected'].map(status => (
                        <button 
                          key={status} 
                          className={`ap-filter-pill ${courseStatusFilter === status ? 'active' : ''}`}
                          onClick={() => setCourseStatusFilter(status)}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div className="ap-activity-filters">
                      <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--gray-400)', marginRight: '10px' }}>CATEGORY:</span>
                      {['all', 'Programming & Development', 'Artificial Intelligence & Automation', 'AI Productivity & Prompting', 'Design & Creativity'].map(cat => (
                        <button 
                          key={cat} 
                          className={`ap-filter-pill ${courseCategoryFilter === cat ? 'active' : ''}`}
                          onClick={() => setCourseCategoryFilter(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="id-table-wrap" ref={dropdownRef}>
                  <table className="id-table">
                    <thead><tr><th>Course</th><th>Instructor</th><th>Price</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredCourses.length > 0 ? filteredCourses.map(c => (
                        <tr key={c.id}>
                          <td><div className="id-course-cell"><div style={{width:40,height:40,borderRadius:4,backgroundColor:'#ddd',flexShrink:0}} /><div><strong>{c.title}</strong></div></div></td>
                          <td>{c.instructor?.name || 'Unknown'}</td>
                          <td>₹{c.price || 0}</td>
                          <td>{new Date(c.created_at).toLocaleDateString()}</td>
                          <td>
                            {c.status === 'approved' && <span className="badge badge-success" style={{padding: '4px 8px'}}>Approved</span>}
                            {c.status === 'pending' && <span className="badge" style={{backgroundColor: '#f59e0b', color: '#fff', padding: '4px 8px'}}>Pending</span>}
                            {c.status === 'rejected' && <span className="badge badge-danger" style={{padding: '4px 8px'}}>Rejected</span>}
                          </td>
                          <td style={{ position: 'relative' }}>
                            <button 
                              className={`id-action-btn ${activeMenu?.id === c.id ? 'active' : ''}`} 
                              onClick={(e) => handleMenuToggle(e, c.id, 'course')}
                            >
                              <FiMoreVertical />
                            </button>
                            {activeMenu?.id === c.id && activeMenu.type === 'course' && (
                              <div 
                                className="ap-dropdown-menu animate-scale fixed-menu"
                                style={{ 
                                  top: `${activeMenu.rect.bottom + 5}px`, 
                                  left: `${activeMenu.rect.right - 180}px` 
                                }}
                              >
                                <div className="dropdown-label">Set Status</div>
                                <button className={c.status === 'pending' ? 'active' : ''} onClick={() => handleApproval(c.id, 'pending')}>Pending</button>
                                <button className={c.status === 'approved' ? 'active' : ''} onClick={() => handleApproval(c.id, 'approved')}>Approved</button>
                                <button className={c.status === 'rejected' ? 'active' : ''} onClick={() => handleApproval(c.id, 'rejected')}>Rejected</button>
                                <div className="dropdown-divider" />
                                <button className="danger" onClick={() => handleDeleteCourse(c.id)}><FiTrash2 style={{marginRight: 8}} /> Delete Course</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )) : <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>No courses found.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="ap-table-footer" style={{ marginTop: '16px', padding: '12px 20px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', borderRadius: '0 0 8px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <div style={{ color: 'var(--gray-500)' }}>
                    Showing <strong>{filteredCourses.length}</strong> courses
                  </div>
                  {(courseStatusFilter !== 'all' || courseCategoryFilter !== 'all') && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {courseStatusFilter !== 'all' && <div className="badge badge-primary" style={{ fontSize: '0.75rem' }}>Status: {courseStatusFilter.toUpperCase()}</div>}
                      {courseCategoryFilter !== 'all' && <div className="badge badge-info" style={{ fontSize: '0.75rem' }}>Category: {courseCategoryFilter}</div>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Revenue Analytics */}
            {tab === 'revenue' && (
              <RevenueAnalytics 
                payments={payments} 
                courses={courses} 
                users={users} 
              />
            )}

            {/* Activities Tab */}
            {tab === 'activities' && (
              <div className="ap-activities animate-fade">
                <div className="ap-search-row">
                  <div>
                    <h3><FiTrendingUp style={{marginRight: 8, color: 'var(--primary)'}} /> Full Site Activities</h3>
                    <p style={{fontSize: '.875rem', color: 'var(--gray-500)'}}>Chronological log of all major actions on the platform</p>
                  </div>
                  
                  <div className="ap-activity-filters">
                    {['all', 'user', 'course', 'enroll', 'payment'].map(f => (
                      <button 
                        key={f} 
                        className={`ap-filter-pill ${activityFilter === f ? 'active' : ''}`}
                        onClick={() => setActivityFilter(f)}
                      >
                        {f.charAt(0).toUpperCase() + f.slice(1)}s
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="ap-activity-timeline">
                  {recentActivities
                    .filter(a => activityFilter === 'all' || a.type === activityFilter)
                    .length > 0 ? (
                    recentActivities
                      .filter(a => activityFilter === 'all' || a.type === activityFilter)
                      .map(act => (
                        <div key={act.id} className="ap-timeline-item">
                          <div className={`ap-timeline-dot ${act.type}`}>
                            {act.type === 'user' && <FiUsers />}
                            {act.type === 'course' && <FiBookOpen />}
                            {act.type === 'enroll' && <FiCheckCircle />}
                            {act.type === 'payment' && <FiDollarSign />}
                          </div>
                          <div className="ap-timeline-content">
                            <div className="ap-timeline-header">
                              <span className="ap-timeline-title">{act.title}</span>
                              <span className="ap-timeline-time">{formatTimeAgo(act.time)}</span>
                            </div>
                            <p className="ap-timeline-msg" dangerouslySetInnerHTML={{ __html: act.message }} />
                            <span className="ap-timeline-date">{new Date(act.time).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                    <div className="ap-activity-empty">
                      No activities recorded for this filter.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Approvals Tab */}
            {tab === 'approvals' && (
              <div className="ap-approvals-center animate-fade">
                <div className="ap-sub-tabs">
                  <button className={`ap-sub-tab ${approvalSubTab === 'courses' ? 'active' : ''}`} onClick={() => setApprovalSubTab('courses')}>
                    Course Requests {stats.pending > 0 && <span className="sub-badge">{stats.pending}</span>}
                  </button>
                  <button className={`ap-sub-tab ${approvalSubTab === 'instructors' ? 'active' : ''}`} onClick={() => setApprovalSubTab('instructors')}>
                    Instructor Requests {stats.requests > 0 && <span className="sub-badge">{stats.requests}</span>}
                  </button>
                  <button className={`ap-sub-tab ${approvalSubTab === 'blogs' ? 'active' : ''}`} onClick={() => setApprovalSubTab('blogs')}>
                    Blog Requests {stats.pendingBlogs > 0 && <span className="sub-badge">{stats.pendingBlogs}</span>}
                  </button>
                </div>

                <div className="ap-approval-content">
                  {/* Sub-tab 1: Courses */}
                  {approvalSubTab === 'courses' && (
                    <div className="animate-fade">
                      {courses.filter(c => c.status === 'pending').length > 0 ? (
                        <div className="id-table-wrap">
                          <table className="id-table">
                            <thead><tr><th>Course</th><th>Instructor</th><th>Submitted</th><th>Actions</th></tr></thead>
                            <tbody>
                              {courses.filter(c => c.status === 'pending').map(c => (
                                <tr key={c.id}>
                                  <td><strong>{c.title}</strong></td>
                                  <td>{c.instructor?.name || 'Unknown'}</td>
                                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                                  <td>
                                    <div style={{display: 'flex', gap: '8px'}}>
                                      <button className="btn btn-outline btn-sm" onClick={() => openCourseReview(c)}><FiEye /> Review</button>
                                      <button className="btn btn-primary btn-sm" onClick={() => handleApproval(c.id, 'approved')}>Approve</button>
                                      <button className="btn btn-outline btn-sm danger" onClick={() => handleApproval(c.id, 'rejected')}>Reject</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-state">
                          <FiCheckCircle size={48} color="var(--success)" />
                          <h3>All Courses Reviewed</h3>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-tab 2: Instructors */}
                  {approvalSubTab === 'instructors' && (
                    <div className="animate-fade">
                      {requests.filter(r => r.status === 'pending').length > 0 ? (
                        <div className="id-table-wrap">
                          <table className="id-table">
                            <thead><tr><th>Name</th><th>Email</th><th>Expertise</th><th>Submitted</th><th>Actions</th></tr></thead>
                            <tbody>
                              {requests.filter(r => r.status === 'pending').map(r => (
                                <tr key={r.id}>
                                  <td><strong>{r.name}</strong></td>
                                  <td>{r.email}</td>
                                  <td>{r.expertise}</td>
                                  <td>{new Date(r.created_at).toLocaleDateString()}</td>
                                  <td>
                                    <div style={{display: 'flex', gap: '8px'}}>
                                      <button className="btn btn-primary btn-sm" onClick={() => handleRequestAction(r.id, 'approved', r.user_id)}>Approve</button>
                                      <button className="btn btn-outline btn-sm danger" onClick={() => handleRequestAction(r.id, 'rejected', null)}>Reject</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="empty-state">
                          <FiUsers size={48} color="var(--gray-300)" />
                          <h3>No Pending Applications</h3>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sub-tab 3: Blogs */}
                  {approvalSubTab === 'blogs' && (
                    <div className="animate-fade">
                      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <h4 style={{ margin: 0 }}>Blog Moderation & Management</h4>
                      </div>
                      <div className="id-table-wrap">
                        <table className="id-table">
                          <thead><tr><th>Blog Title</th><th>Author</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
                          <tbody>
                            {blogs.length > 0 ? blogs.map(b => (
                              <tr key={b.id}>
                                <td><strong>{b.title}</strong></td>
                                <td>{b.author?.name || 'Unknown'}</td>
                                <td>
                                  <span className={`badge badge-${b.status === 'published' ? 'success' : b.status === 'pending' ? 'warning' : 'default'}`}>
                                    {b.status}
                                  </span>
                                </td>
                                <td>{new Date(b.created_at).toLocaleDateString()}</td>
                                <td>
                                  <div style={{display: 'flex', gap: '8px'}}>
                                    {b.status !== 'published' ? (
                                      <button className="btn btn-primary btn-sm" onClick={() => handleBlogStatus(b.id, 'published')}>Publish</button>
                                    ) : (
                                      <button className="btn btn-outline btn-sm" onClick={() => handleBlogStatus(b.id, 'pending')}>Unpublish</button>
                                    )}
                                    <button className="btn btn-outline btn-sm danger" onClick={() => handleDeleteBlog(b.id)}>Delete</button>
                                  </div>
                                </td>
                              </tr>
                            )) : (
                              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'var(--gray-400)' }}>No blogs found.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instructor Requests Tab */}
            {tab === 'requests' && (
              <div className="ap-requests animate-fade">
                {stats.requests > 0 || requests.length > 0 ? (
                  <>
                    <div className="id-table-wrap">
                    <table className="id-table">
                      <thead><tr><th>Name</th><th>Contact info</th><th>ID Proof</th><th>Expertise</th><th>Experience</th><th>Status</th><th>Submitted</th><th>Actions</th></tr></thead>
                      <tbody>
                        {requests.map(r => (
                          <tr key={r.id}>
                            <td><strong>{r.name}</strong></td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.875rem' }}>{r.email}</span>
                                <span style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>{r.phone || 'N/A'}</span>
                              </div>
                            </td>
                            <td><span style={{ fontSize: '0.875rem' }}>{r.id_proof || 'N/A'}</span></td>
                            <td>{r.expertise}</td>
                            <td><div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.experience}>{r.experience}</div></td>
                            <td>
                              {r.status === 'approved' && <span className="badge badge-success">Approved</span>}
                              {r.status === 'pending' && <span className="badge" style={{backgroundColor: '#f59e0b', color: '#fff'}}>Pending</span>}
                              {r.status === 'rejected' && <span className="badge badge-danger">Rejected</span>}
                            </td>
                            <td>{new Date(r.created_at).toLocaleDateString()}</td>
                            <td>
                              {r.status === 'pending' && (
                                <div style={{display: 'flex', gap: '8px'}}>
                                  <button className="btn btn-primary btn-sm" onClick={() => handleRequestAction(r.id, 'approved', r.user_id)}>Approve</button>
                                  <button className="btn btn-outline btn-sm" style={{borderColor: 'var(--danger)', color: 'var(--danger)'}} onClick={() => handleRequestAction(r.id, 'rejected', null)}>Reject</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="ap-table-footer" style={{ marginTop: '16px', padding: '12px 20px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', borderRadius: '0 0 8px 8px', display: 'flex', justifyContent: 'flex-end', fontSize: '0.875rem', color: 'var(--gray-500)', fontWeight: 600 }}>
                    Total Requests: {requests.length}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <FiUsers size={48} color="var(--gray-400)" style={{marginBottom: '1rem'}} />
                  <h3>No Requests Yet</h3>
                  <p>There are no pending instructor applications right now.</p>
                </div>
              )}
            </div>
          )}


            {/* Jobs Tab */}
            {tab === 'jobs' && (
              <div className="ap-approvals animate-fade">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3>Manage Jobs</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => { setEditingJob(null); setJobForm({ company_name: '', role: '', category: 'Freshers', salary: '', location: '', job_type: 'Full-time', qualification: '', vacancies: '', description: '', venue: '', contact_details: '', date_time: '', apply_link: '', expiry_date: '', is_urgent: false, job_mode: 'apply_link' }); setShowJobModal(true); }}>
                    + Add Job
                  </button>
                </div>
                <div className="id-table-wrap" ref={dropdownRef}>
                  <table className="id-table">
                    <thead><tr><th>Company</th><th>Role</th><th>Category</th><th>Expiry</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {jobs.length > 0 ? jobs.map(j => (
                        <tr key={j.id}>
                          <td><strong>{j.company_name}</strong></td>
                          <td>{j.role}</td>
                          <td><span className="badge badge-info">{j.category}</span></td>
                          <td>{j.expiry_date ? new Date(j.expiry_date).toLocaleDateString() : 'N/A'}</td>
                          <td>
                            {j.is_urgent && <span className="badge badge-danger" style={{marginRight: 4}}>Urgent</span>}
                            {j.expiry_date && new Date(j.expiry_date) < new Date() ? <span className="badge badge-default">Expired</span> : <span className="badge badge-success">Active</span>}
                          </td>
                          <td style={{ position: 'relative' }}>
                            <button className={`id-action-btn ${activeMenu?.id === j.id ? 'active' : ''}`} onClick={(e) => handleMenuToggle(e, j.id, 'job')}>
                              <FiMoreVertical />
                            </button>
                            {activeMenu?.id === j.id && activeMenu.type === 'job' && (
                              <div className="ap-dropdown-menu animate-scale fixed-menu" style={{ top: `${activeMenu.rect.bottom + 5}px`, left: `${activeMenu.rect.right - 180}px` }}>
                                <button onClick={() => handleEditJob(j)}>Edit Job</button>
                                <button className="danger" onClick={() => handleDeleteJob(j.id)}>Delete Job</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )) : <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>No jobs found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Coupons Tab */}
            {tab === 'coupons' && (
              <div className="ap-approvals animate-fade">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3>Coupon Management</h3>
                  <button className="btn btn-primary btn-sm" onClick={() => { setEditingCoupon(null); setCouponForm({ code: '', discount_type: 'percentage', discount_value: '', course_id: '', expiry_date: '', usage_limit: '' }); setShowCouponModal(true); }}>
                    + Create Coupon
                  </button>
                </div>
                <div className="id-table-wrap" ref={dropdownRef}>
                  <table className="id-table">
                    <thead><tr><th>Code</th><th>Discount</th><th>Applies To</th><th>Expiry</th><th>Usage</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {coupons.length > 0 ? coupons.map(c => (
                        <tr key={c.id}>
                          <td><strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', letterSpacing: '1px' }}>{c.code}</strong></td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong>{c.discount_type === 'percentage' ? `${c.discount_value}%` : `₹${c.discount_value}`}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{c.discount_type === 'percentage' ? 'Percentage' : 'Flat Discount'}</span>
                            </div>
                          </td>
                          <td>
                            <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.course?.title || 'Global'}>
                              {c.course?.title ? <span className="badge badge-info">{c.course.title}</span> : <span className="badge badge-primary">All Courses</span>}
                            </div>
                          </td>
                          <td>{c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : 'Never'}</td>
                          <td>{c.used_count} / {c.usage_limit || '∞'}</td>
                          <td>
                            <span className={`badge badge-${c.is_active ? 'success' : 'default'}`}>{c.is_active ? 'Active' : 'Disabled'}</span>
                          </td>
                          <td style={{ position: 'relative' }}>
                            <button className={`id-action-btn ${activeMenu?.id === c.id ? 'active' : ''}`} onClick={(e) => handleMenuToggle(e, c.id, 'coupon')}>
                              <FiMoreVertical />
                            </button>
                            {activeMenu?.id === c.id && activeMenu.type === 'coupon' && (
                              <div className="ap-dropdown-menu animate-scale fixed-menu" style={{ top: `${activeMenu.rect.bottom + 5}px`, left: `${activeMenu.rect.right - 180}px` }}>
                                <button onClick={() => { setEditingCoupon(c); setCouponForm({ ...c, expiry_date: c.expiry_date ? c.expiry_date.split('T')[0] : '' }); setShowCouponModal(true); setActiveMenu(null); }}>Edit Coupon</button>
                                <button onClick={() => { handleCouponStatusToggle(c.id, c.is_active); setActiveMenu(null); }}>{c.is_active ? 'Disable' : 'Enable'}</button>
                                <div className="dropdown-divider" />
                                <button className="danger" onClick={() => { handleDeleteCoupon(c.id); setActiveMenu(null); }}>Delete Coupon</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )) : <tr><td colSpan="7" style={{textAlign: 'center', padding: '20px'}}>No coupons found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Messages Tab */}
            {tab === 'messages' && (
              <div className="ap-messages animate-fade">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3>Contact Messages</h3>
                </div>
                <div className="id-table-wrap" ref={dropdownRef}>
                  <table className="id-table">
                    <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {messages.length > 0 ? messages.map(m => (
                        <tr key={m.id} style={{ fontWeight: m.status === 'unread' ? '600' : 'normal', backgroundColor: m.status === 'unread' ? 'var(--primary-50)' : 'transparent' }}>
                          <td><strong>{m.name}</strong></td>
                          <td>{m.email}</td>
                          <td>
                            <div style={{ maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {m.subject}
                            </div>
                          </td>
                          <td>{new Date(m.created_at).toLocaleDateString()}</td>
                          <td>
                            {m.status === 'unread' ? <span className="badge badge-warning" style={{ backgroundColor: '#f59e0b', color: 'white' }}>Unread</span> : <span className="badge badge-default">Read</span>}
                          </td>
                          <td style={{ position: 'relative' }}>
                            <button className={`id-action-btn ${activeMenu?.id === m.id ? 'active' : ''}`} onClick={(e) => handleMenuToggle(e, m.id, 'message')}>
                              <FiMoreVertical />
                            </button>
                            {activeMenu?.id === m.id && activeMenu.type === 'message' && (
                              <div className="ap-dropdown-menu animate-scale fixed-menu" style={{ top: `${activeMenu.rect.bottom + 5}px`, left: `${activeMenu.rect.right - 180}px`, zIndex: 100 }}>
                                <button onClick={() => { 
                                  setSelectedMessage(m); 
                                  if(m.status === 'unread') handleMessageStatus(m.id, 'read');
                                  setActiveMenu(null); 
                                }}>
                                  <FiEye style={{marginRight: 8}} /> Read Message
                                </button>
                                {m.status === 'read' && (
                                  <button onClick={() => { handleMessageStatus(m.id, 'unread'); setActiveMenu(null); }}>
                                    <FiMail style={{marginRight: 8}} /> Mark as Unread
                                  </button>
                                )}
                                <div className="dropdown-divider" />
                                <button className="danger" onClick={() => { handleDeleteMessage(m.id); setActiveMenu(null); }}>
                                  <FiTrash2 style={{marginRight: 8}} /> Delete Message
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )) : <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>No messages found.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Course Reviews Tab */}
            {tab === 'reviews' && (
              <div className="ap-approvals animate-fade">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3><FiStar style={{ marginRight: 8 }} /> Course Reviews ({courseReviews.length})</h3>
                </div>
                <div className="ap-search-row" style={{ marginBottom: 16 }}>
                  <div className="ap-search"><FiSearch /><input placeholder="Search by course, student, or comment..." value={searchReviews} onChange={e => setSearchReviews(e.target.value)} /></div>
                </div>
                <div className="id-table-wrap" ref={dropdownRef}>
                  <table className="id-table">
                    <thead><tr><th>Student</th><th>Course</th><th>Rating</th><th>Comment</th><th>Date</th><th>Actions</th></tr></thead>
                    <tbody>
                      {(() => {
                        const q = searchReviews.toLowerCase();
                        const filtered = courseReviews.filter(r => 
                          (r.user?.name || '').toLowerCase().includes(q) ||
                          (r.course?.title || '').toLowerCase().includes(q) ||
                          (r.comment || '').toLowerCase().includes(q)
                        );
                        return filtered.length > 0 ? filtered.map(r => (
                          <tr key={r.id}>
                            <td>
                              <div className="id-user-cell">
                                <div className="avatar-circle" style={{width:32,height:32,borderRadius:'50%',backgroundColor:'#e0e0e0',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:'bold',color:'#666'}}>{r.user?.name?.charAt(0) || 'U'}</div>
                                <span>{r.user?.name || 'Unknown'}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.course?.title}>
                                {r.course?.title || 'Unknown Course'}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {[1,2,3,4,5].map(star => (
                                  <FiStar key={star} style={{ color: star <= r.rating ? '#f59e0b' : '#d1d5db', fill: star <= r.rating ? '#f59e0b' : 'none', fontSize: '0.875rem' }} />
                                ))}
                                <span style={{ marginLeft: '4px', fontWeight: 600, fontSize: '0.875rem' }}>{r.rating}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.comment}>
                                {r.comment || '—'}
                              </div>
                            </td>
                            <td>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td>
                              <button
                                className="id-action-btn"
                                style={{ color: 'var(--danger)' }}
                                title="Delete Review"
                                onClick={() => handleDeleteReview(r.id)}
                              >
                                <FiTrash2 />
                              </button>
                            </td>
                          </tr>
                        )) : <tr><td colSpan="6" style={{textAlign: 'center', padding: '20px'}}>No reviews found.</td></tr>;
                      })()}
                    </tbody>
                  </table>
                </div>
                <div className="ap-table-footer" style={{ marginTop: '16px', padding: '12px 20px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-200)', borderRadius: '0 0 8px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <div style={{ color: 'var(--gray-500)' }}>
                    Showing <strong>{courseReviews.filter(r => {
                      const q = searchReviews.toLowerCase();
                      return (r.user?.name || '').toLowerCase().includes(q) || (r.course?.title || '').toLowerCase().includes(q) || (r.comment || '').toLowerCase().includes(q);
                    }).length}</strong> of <strong>{courseReviews.length}</strong> reviews
                  </div>
                </div>
              </div>
            )}

            {/* Certificates Tab */}
            {tab === 'certificates' && (
              <CertificateGenerator />
            )}
          </>
        )}
        {/* User Profile Modal */}
        <Modal isOpen={!!profileUser} onClose={() => setProfileUser(null)} title="User Profile" size="lg">
          {profileUser && (
            <div className="ap-profile-modal">
              <div className="ap-profile-hero">
                <div className="ap-profile-avatar">
                  {profileUser.avatar_url ? (
                    <img src={profileUser.avatar_url} alt={profileUser.name} />
                  ) : (
                    <span>{profileUser.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                  )}
                </div>
                <div className="ap-profile-hero-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    <h2 style={{ marginBottom: 0 }}>{profileUser.name || 'Unknown'}</h2>
                    <span className="ap-user-code" style={{ fontSize: '.875rem', padding: '4px 12px' }}>
                      ID: {generateUserCode(profileUser.id)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`badge badge-${profileUser.role === 'admin' ? 'danger' : profileUser.role === 'instructor' ? 'primary' : 'success'}`} style={{ fontSize: '.75rem', padding: '4px 12px' }}>
                      {profileUser.role?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="ap-profile-grid">
                <div className="ap-profile-field">
                  <div className="ap-profile-field-icon"><FiMail /></div>
                  <div>
                    <span className="ap-profile-label">Email</span>
                    <p>{profileUser.email}</p>
                  </div>
                </div>

                <div className="ap-profile-field">
                  <div className="ap-profile-field-icon"><FiCalendar /></div>
                  <div>
                    <span className="ap-profile-label">Joined</span>
                    <p>{new Date(profileUser.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>

                {profileUser.location && (
                  <div className="ap-profile-field">
                    <div className="ap-profile-field-icon"><FiMapPin /></div>
                    <div>
                      <span className="ap-profile-label">Location</span>
                      <p>{profileUser.location}</p>
                    </div>
                  </div>
                )}

                {profileUser.contact_number && (
                  <div className="ap-profile-field">
                    <div className="ap-profile-field-icon"><FiPhone /></div>
                    <div>
                      <span className="ap-profile-label">Contact</span>
                      <p>{profileUser.contact_number}</p>
                    </div>
                  </div>
                )}

                {profileUser.qualification && (
                  <div className="ap-profile-field">
                    <div className="ap-profile-field-icon"><FiAward /></div>
                    <div>
                      <span className="ap-profile-label">Qualification</span>
                      <p>{profileUser.qualification}</p>
                    </div>
                  </div>
                )}

                {profileUser.experience && (
                  <div className="ap-profile-field">
                    <div className="ap-profile-field-icon"><FiBriefcase /></div>
                    <div>
                      <span className="ap-profile-label">Experience</span>
                      <p>{profileUser.experience}</p>
                    </div>
                  </div>
                )}

                {profileUser.gender && (
                  <div className="ap-profile-field">
                    <div className="ap-profile-field-icon"><FiUsers /></div>
                    <div>
                      <span className="ap-profile-label">Gender</span>
                      <p>{profileUser.gender}</p>
                    </div>
                  </div>
                )}

                {profileUser.dob && (
                  <div className="ap-profile-field">
                    <div className="ap-profile-field-icon"><FiCalendar /></div>
                    <div>
                      <span className="ap-profile-label">Date of Birth</span>
                      <p>{new Date(profileUser.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                  </div>
                )}

                {profileUser.linkedin_url && (
                  <div className="ap-profile-field">
                    <div className="ap-profile-field-icon"><FiLinkedin /></div>
                    <div>
                      <span className="ap-profile-label">LinkedIn</span>
                      <a href={profileUser.linkedin_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600, fontSize: '.875rem' }}>View Profile →</a>
                    </div>
                  </div>
                )}
              </div>

              {profileUser.bio && (
                <div className="ap-profile-bio">
                  <h4>About</h4>
                  <p>{profileUser.bio}</p>
                </div>
              )}

              {/* Role-specific data */}
              {profileLoading && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--gray-400)' }}>
                  Loading activity data...
                </div>
              )}

              {/* STUDENT: Enrolled courses + certificates */}
              {!profileLoading && profileUser.role === 'student' && profileExtras && (
                <div className="ap-profile-section">
                  <h4><FiBookOpen /> Enrolled Courses ({profileExtras.enrollments.length})</h4>
                  {profileExtras.enrollments.length === 0 ? (
                    <p className="ap-profile-empty">No courses enrolled yet.</p>
                  ) : (
                    <div className="ap-profile-table-wrap">
                      <table className="ap-profile-table">
                        <thead><tr><th>Course</th><th>Category</th><th>Progress</th><th>Certificate</th></tr></thead>
                        <tbody>
                          {profileExtras.enrollments.map((enr, i) => {
                            const hasCert = profileExtras.certificates.some(c => c.course_id === enr.course?.id);
                            return (
                              <tr key={i}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <img src={enr.course?.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=60'} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                                    <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{enr.course?.title || 'Unknown'}</span>
                                  </div>
                                </td>
                                <td><span style={{ fontSize: '.75rem', color: 'var(--gray-500)' }}>{enr.course?.category}</span></td>
                                <td>
                                  <div className="ap-mini-progress">
                                    <div className="ap-mini-bar"><div className="ap-mini-fill" style={{ width: `${enr.progress || 0}%` }} /></div>
                                    <span>{enr.progress || 0}%</span>
                                  </div>
                                </td>
                                <td>
                                  {hasCert ? (
                                    <span className="badge badge-success" style={{ fontSize: '.688rem' }}>✓ Earned</span>
                                  ) : enr.progress === 100 ? (
                                    <span className="badge badge-warning" style={{ fontSize: '.688rem' }}>Unclaimed</span>
                                  ) : (
                                    <span style={{ fontSize: '.75rem', color: 'var(--gray-400)' }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* INSTRUCTOR: Published courses + revenue */}
              {!profileLoading && profileUser.role === 'instructor' && profileExtras && (
                <div className="ap-profile-section">
                  {/* Revenue + Stats summary */}
                  <div className="ap-instr-stats">
                    <div className="ap-instr-stat">
                      <FiDollarSign />
                      <div><span>Total Revenue</span><strong>₹{profileExtras.revenue.toLocaleString('en-IN')}</strong></div>
                    </div>
                    <div className="ap-instr-stat">
                      <FiBookOpen />
                      <div><span>Published</span><strong>{profileExtras.courses.filter(c => c.status === 'approved').length}</strong></div>
                    </div>
                    <div className="ap-instr-stat">
                      <FiClock />
                      <div><span>Pending Approval ({profileExtras.courses.filter(c => c.status === 'pending').length})</span><strong>{profileExtras.courses.filter(c => c.status === 'pending').length}</strong></div>
                    </div>
                    <div className="ap-instr-stat">
                      <FiUsers />
                      <div><span>Total Students</span><strong>{profileExtras.courses.reduce((a, c) => a + (c.student_count || 0), 0)}</strong></div>
                    </div>
                  </div>

                  <h4><FiBookOpen /> Courses ({profileExtras.courses.length})</h4>
                  {profileExtras.courses.length === 0 ? (
                    <p className="ap-profile-empty">No courses created yet.</p>
                  ) : (
                    <div className="ap-profile-table-wrap">
                      <table className="ap-profile-table">
                        <thead><tr><th>Course</th><th>Category</th><th>Price</th><th>Students</th><th>Status</th></tr></thead>
                        <tbody>
                          {profileExtras.courses.map((c, i) => (
                            <tr key={i}>
                              <td><span style={{ fontWeight: 600, fontSize: '.875rem' }}>{c.title}</span></td>
                              <td><span style={{ fontSize: '.75rem', color: 'var(--gray-500)' }}>{c.category}</span></td>
                              <td><strong style={{ fontSize: '.875rem' }}>₹{c.price}</strong></td>
                              <td><span style={{ fontSize: '.875rem' }}>{c.student_count || 0}</span></td>
                              <td>
                                <span className={`badge badge-${c.status === 'approved' ? 'success' : c.status === 'pending' ? 'warning' : 'danger'}`} style={{ fontSize: '.688rem' }}>
                                  {c.status?.toUpperCase()}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* AUTHOR: Blog posts */}
              {!profileLoading && profileUser.role === 'author' && profileExtras && (
                <div className="ap-profile-section">
                  {/* Blog Stats summary */}
                  <div className="ap-instr-stats">
                    <div className="ap-instr-stat">
                      <FiFileText />
                      <div><span>Total Blogs</span><strong>{profileExtras.blogs.length}</strong></div>
                    </div>
                    <div className="ap-instr-stat">
                      <FiCheckCircle />
                      <div><span>Published</span><strong>{profileExtras.blogs.filter(b => b.status === 'published').length}</strong></div>
                    </div>
                    <div className="ap-instr-stat">
                      <FiClock />
                      <div><span>Pending Review</span><strong>{profileExtras.blogs.filter(b => b.status === 'pending').length}</strong></div>
                    </div>
                    <div className="ap-instr-stat">
                      <FiEye />
                      <div><span>Drafts</span><strong>{profileExtras.blogs.filter(b => b.status === 'draft').length}</strong></div>
                    </div>
                  </div>

                  <h4><FiFileText /> Blog Posts ({profileExtras.blogs.length})</h4>
                  {profileExtras.blogs.length === 0 ? (
                    <p className="ap-profile-empty">No blog posts created yet.</p>
                  ) : (
                    <div className="ap-profile-table-wrap">
                      <table className="ap-profile-table">
                        <thead><tr><th>Blog Title</th><th>Excerpt</th><th>Status</th><th>Published</th></tr></thead>
                        <tbody>
                          {profileExtras.blogs.map((b, i) => (
                            <tr key={i}>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <img src={b.cover_image || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=60'} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                                  <span style={{ fontWeight: 600, fontSize: '.875rem' }}>{b.title}</span>
                                </div>
                              </td>
                              <td><span style={{ fontSize: '.75rem', color: 'var(--gray-500)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.excerpt || '—'}</span></td>
                              <td>
                                <span className={`badge badge-${b.status === 'published' ? 'success' : b.status === 'pending' ? 'warning' : 'secondary'}`} style={{ fontSize: '.688rem' }}>
                                  {b.status?.toUpperCase()}
                                </span>
                              </td>
                              <td><span style={{ fontSize: '.75rem', color: 'var(--gray-500)' }}>{new Date(b.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* Course Review Modal - FULL SCREEN */}
        <Modal isOpen={!!reviewCourse} onClose={() => setReviewCourse(null)} title="Course Review" size="fullscreen">
          {reviewCourse && (
            <div className="ap-review-modal">
              {/* Header */}
              <div className="ap-review-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <div className="ap-review-badge">{(reviewCourse.status || 'pending').toUpperCase()} REVIEW</div>
                    <h2>{reviewCourse.title}</h2>
                    <div className="ap-review-meta">
                      <span className="badge badge-primary">{reviewCourse.category}</span>
                      <span><FiClock /> {new Date(reviewCourse.created_at).toLocaleDateString()}</span>
                      <span><FiUser /> {reviewCourse.instructor?.name || 'Unknown'}</span>
                    </div>
                  </div>
                  {/* Price Card */}
                  <div className="ap-review-price-card">
                    <div className="ap-price-main">
                      <span className="ap-price-label">Course Price</span>
                      <span className="ap-price-value">₹{reviewCourse.price || 0}</span>
                    </div>
                    {reviewCourse.offer_price && (
                      <div className="ap-price-offer">
                        <span>Offer Price</span>
                        <strong>₹{reviewCourse.offer_price}</strong>
                        <span className="ap-discount-badge">{Math.round(((reviewCourse.price - reviewCourse.offer_price) / reviewCourse.price) * 100)}% OFF</span>
                      </div>
                    )}
                    <div className="ap-price-meta">
                      <span><FiUsers /> {reviewCourse.student_count || 0} students</span>
                      {reviewCourse.coupon_applicable && <span className="badge badge-success" style={{fontSize: '0.65rem'}}>Coupon Eligible</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="ap-review-grid-xl">
                {/* LEFT COLUMN - Video + Details */}
                <div className="ap-review-main">
                  {/* Video Preview */}
                  <div className="ap-video-container">
                    {(activeReviewVideo || reviewCourse.video_url) ? (
                       <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                         <iframe 
                           src={(activeReviewVideo || reviewCourse.video_url).replace('watch?v=', 'embed/').replace('/view?usp=sharing', '/preview').replace('/view', '/preview')}
                           title="Course Preview"
                           allowFullScreen
                           style={{ width: '100%', height: '100%', border: 'none', borderRadius: 'var(--radius)' }}
                         />
                         <div style={{ position: 'absolute', top: 0, right: 0, width: '60px', height: '60px', background: 'transparent', zIndex: 10, cursor: 'default' }} title="Pop-out disabled" />
                       </div>
                    ) : (
                      <div className="ap-no-video">
                        <img src={reviewCourse.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800'} alt="Course Thumbnail" />
                        <p>No preview video provided</p>
                      </div>
                    )}
                  </div>
                  {activeReviewTitle && (
                    <div style={{ marginTop: '12px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FiPlayCircle /> Playing Lesson: {activeReviewTitle}
                    </div>
                  )}

                  <div className="ap-review-section">
                    <h3>Description</h3>
                    <p className="ap-review-text">{reviewCourse.description}</p>
                  </div>

                  <div className="ap-review-section">
                    <h3>What students will learn</h3>
                    <ul className="ap-review-list">
                      {reviewCourse.learning_outcomes && reviewCourse.learning_outcomes.length > 0 ? (
                        reviewCourse.learning_outcomes.map((item, i) => <li key={i}>{item}</li>)
                      ) : (
                        <li className="empty-li">No outcomes specified</li>
                      )}
                    </ul>
                  </div>
                  
                  <div className="ap-review-section">
                    <h3>Requirements</h3>
                    <ul className="ap-review-list">
                      {reviewCourse.requirements && reviewCourse.requirements.length > 0 ? (
                        reviewCourse.requirements.map((req, i) => <li key={i}>{req}</li>)
                      ) : (
                        <li className="empty-li">No requirements specified</li>
                      )}
                    </ul>
                  </div>

                  {/* Notes & Resources from lessons */}
                  <div className="ap-review-section">
                    <h3>Lesson Notes & Resources</h3>
                    {reviewLessons.filter(l => l.notes || l.resources).length > 0 ? (
                      <div className="ap-notes-grid">
                        {reviewLessons.filter(l => l.notes || l.resources).map((l, i) => (
                          <div key={l.id} className="ap-note-card">
                            <span className="ap-note-lesson-tag">Lesson {i + 1}: {l.title}</span>
                            {l.notes && (
                              <div className="ap-note-block">
                                <span className="ap-note-type"><FiBookOpen /> Notes</span>
                                <p>{l.notes}</p>
                              </div>
                            )}
                            {l.resources && (
                              <div className="ap-note-block">
                                <span className="ap-note-type"><FiLink /> Resources</span>
                                <p>{typeof l.resources === 'string' ? l.resources : JSON.stringify(l.resources)}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-msg" style={{textAlign:'center', color:'var(--gray-400)', fontStyle:'italic', padding:'20px'}}>No notes or resources in any lesson.</p>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN - Curriculum + Assessment + Actions */}
                <div className="ap-review-sidebar">
                  {/* Curriculum */}
                  <div className="ap-curriculum-box">
                    <h3><FiBookOpen /> Full Curriculum ({reviewLessons.length} lessons)</h3>
                    {reviewLoading ? (
                      <div style={{padding: 20}}><Skeleton height={40} count={5} /></div>
                    ) : reviewLessons.length > 0 ? (
                      <div className="ap-lesson-list">
                        {reviewLessons.map((l, i) => (
                          <div 
                            key={l.id} 
                            className={`ap-lesson-review-item ${activeReviewVideo === l.video_url && activeReviewVideo ? 'playing' : ''}`}
                            onClick={() => {
                              if (l.video_url) {
                                setActiveReviewVideo(l.video_url);
                                setActiveReviewTitle(l.title);
                              }
                            }}
                            style={{ 
                              cursor: l.video_url ? 'pointer' : 'default', 
                              opacity: l.video_url ? 1 : 0.6,
                              backgroundColor: activeReviewVideo === l.video_url && activeReviewVideo ? 'var(--primary-50)' : '',
                              borderColor: activeReviewVideo === l.video_url && activeReviewVideo ? 'var(--primary)' : ''
                            }}
                            title={l.video_url ? "Click to play lesson video" : "No video available"}
                          >
                            <span className="lesson-num">{i + 1}</span>
                            <div className="lesson-info">
                              <strong>{l.title}</strong>
                              <span>{l.section_title} • {l.duration} mins</span>
                            </div>
                            {l.video_url && <FiCheckCircle color="var(--success)" title="Video attached" />}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="empty-msg">No lessons added yet.</p>
                    )}
                  </div>

                  {/* Assessment Section */}
                  <div className="ap-assessment-review-box">
                    <h3><FiFileText /> Assessment</h3>
                    {reviewAssessment ? (
                      <div>
                        <div className="ap-assess-info-grid">
                          <div className="ap-assess-info-item">
                            <span>Title</span>
                            <strong>{reviewAssessment.title}</strong>
                          </div>
                          <div className="ap-assess-info-item">
                            <span>Pass %</span>
                            <strong>{reviewAssessment.pass_percentage}%</strong>
                          </div>
                          <div className="ap-assess-info-item">
                            <span>Time</span>
                            <strong>{reviewAssessment.time_limit_minutes ? reviewAssessment.time_limit_minutes + ' min' : 'No limit'}</strong>
                          </div>
                          <div className="ap-assess-info-item">
                            <span>Attempts</span>
                            <strong>{reviewAssessment.max_attempts || '∞'}</strong>
                          </div>
                        </div>
                        <div className="ap-assess-questions-list">
                          <h4>{reviewQuestions.length} Question{reviewQuestions.length !== 1 ? 's' : ''}</h4>
                          {reviewQuestions.map((q, qi) => (
                            <div key={q.id} className="ap-assess-q-item">
                              <span className="ap-q-num">Q{qi + 1}</span>
                              <div className="ap-q-content">
                                <p className="ap-q-text">{q.question_text}</p>
                                <div className="ap-q-options">
                                  {(q.options || []).map((opt, oi) => (
                                    <span key={oi} className={`ap-q-opt ${oi === q.correct_option ? 'correct' : ''}`}>
                                      {String.fromCharCode(65 + oi)}. {opt} {oi === q.correct_option && '✓'}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="empty-msg" style={{textAlign:'center', color:'var(--gray-400)', fontStyle:'italic', padding:'20px'}}>No assessment configured for this course.</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="ap-review-actions-sticky">
                    <button className="btn btn-primary btn-lg" onClick={() => { handleApproval(reviewCourse.id, 'approved'); setReviewCourse(null); }}>
                      <FiCheckCircle style={{marginRight: 8}} /> Approve Course
                    </button>
                    <button className="btn btn-outline btn-lg danger" onClick={() => { handleApproval(reviewCourse.id, 'rejected'); setReviewCourse(null); }}>
                      Reject Course
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Contact Message Modal */}
        <Modal isOpen={!!selectedMessage} onClose={() => setSelectedMessage(null)} title="Contact Message Review" size="md">
          {selectedMessage && (
            <div className="ap-message-detail animate-fade">
              <div className="msg-header">
                <div className="msg-sender-info">
                  <div className="msg-avatar">
                    {selectedMessage.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="msg-from">
                    <strong>{selectedMessage.name}</strong>
                    <span>{selectedMessage.email}</span>
                  </div>
                </div>
                <span className="msg-date">{new Date(selectedMessage.created_at).toLocaleDateString()}</span>
              </div>
              
              <div className="msg-section">
                <label><FiInfo /> Subject</label>
                <div className="msg-subject-text">{selectedMessage.subject}</div>
              </div>

              <div className="msg-section">
                <label><FiMessageSquare /> Message Body</label>
                <div className="msg-body-text">{selectedMessage.message}</div>
              </div>

              <div className="ap-message-modal-footer">
                <button 
                  className="btn btn-outline danger" 
                  onClick={() => {
                    handleDeleteMessage(selectedMessage.id);
                    setSelectedMessage(null);
                  }}
                >
                  <FiTrash2 style={{ marginRight: 8 }} /> Delete Message
                </button>
                <button className="btn btn-primary" onClick={() => setSelectedMessage(null)}>
                  Close
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Job Form Modal */}
        <Modal isOpen={showJobModal} onClose={() => setShowJobModal(false)} title={editingJob ? 'Edit Job' : 'Add New Job'} size="lg">
          <form className="admin-job-form" onSubmit={handleJobSubmit}>
            {/* Row 1: Core Info */}
            <div className="form-group">
              <label>Company Name *</label>
              <input type="text" className="form-control" required value={jobForm.company_name} onChange={e => setJobForm({...jobForm, company_name: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Job Role *</label>
              <input type="text" className="form-control" required value={jobForm.role} onChange={e => setJobForm({...jobForm, role: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select className="form-control" required value={jobForm.category} onChange={e => setJobForm({...jobForm, category: e.target.value})}>
                <option value="Walkin">Walkin</option>
                <option value="Online">Online</option>
                <option value="Work From Home">Work From Home</option>
                <option value="Freshers">Freshers</option>
              </select>
            </div>
            <div className="form-group">
              <label>Job Type</label>
              <select className="form-control" value={jobForm.job_type} onChange={e => setJobForm({...jobForm, job_type: e.target.value})}>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Internship">Internship</option>
              </select>
            </div>
            <div className="form-group">
              <label>Salary <span style={{color:'var(--gray-400)', fontWeight:400}}>(optional — leave empty for "Not Disclosed")</span></label>
              <input type="text" className="form-control" placeholder="e.g. ₹15,000 - ₹25,000/month" value={jobForm.salary} onChange={e => setJobForm({...jobForm, salary: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input type="text" className="form-control" value={jobForm.location} onChange={e => setJobForm({...jobForm, location: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Qualification Requirements</label>
              <input type="text" className="form-control" value={jobForm.qualification} onChange={e => setJobForm({...jobForm, qualification: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Number of Vacancies</label>
              <input type="number" min="1" className="form-control" value={jobForm.vacancies} onChange={e => setJobForm({...jobForm, vacancies: e.target.value})} />
            </div>
            <div className="form-group full-width-field">
              <label>Job Description</label>
              <textarea className="form-control" rows="4" value={jobForm.description} onChange={e => setJobForm({...jobForm, description: e.target.value})} />
            </div>

            {/* Job Mode Toggle */}
            <div className="form-group full-width-field">
              <label>Application Method *</label>
              <div className="job-mode-toggle">
                <button type="button" className={`toggle-btn ${jobForm.job_mode === 'walkin' ? 'active walkin' : ''}`} onClick={() => setJobForm({...jobForm, job_mode: 'walkin'})}>
                  Walk-in Interview
                </button>
                <button type="button" className={`toggle-btn ${jobForm.job_mode === 'apply_link' ? 'active apply' : ''}`} onClick={() => setJobForm({...jobForm, job_mode: 'apply_link'})}>
                  Apply via Link
                </button>
                <button type="button" className={`toggle-btn ${jobForm.job_mode === 'both' ? 'active both' : ''}`} onClick={() => setJobForm({...jobForm, job_mode: 'both'})}>
                  Both
                </button>
              </div>
            </div>

            {/* Walk-in Fields (visible for walkin / both) */}
            {(jobForm.job_mode === 'walkin' || jobForm.job_mode === 'both') && (
              <>
                <div className="form-group">
                  <label>Venue {jobForm.job_mode === 'walkin' ? '*' : ''}</label>
                  <input type="text" className="form-control" placeholder="e.g. Company HQ, 2nd Floor, Chennai" value={jobForm.venue} onChange={e => setJobForm({...jobForm, venue: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Date & Time {jobForm.job_mode === 'walkin' ? '*' : ''}</label>
                  <input type="text" className="form-control" placeholder="e.g. Oct 15, 10:00 AM - 4:00 PM" value={jobForm.date_time} onChange={e => setJobForm({...jobForm, date_time: e.target.value})} />
                </div>
              </>
            )}

            {/* Apply Link (visible for apply_link / both) */}
            {(jobForm.job_mode === 'apply_link' || jobForm.job_mode === 'both') && (
              <div className="form-group full-width-field">
                <label>External Apply Link {jobForm.job_mode === 'apply_link' ? '*' : ''}</label>
                <input type="url" className="form-control" placeholder="https://careers.example.com/apply" value={jobForm.apply_link} onChange={e => setJobForm({...jobForm, apply_link: e.target.value})} />
              </div>
            )}

            <div className="form-group">
              <label>Contact Details</label>
              <input type="text" className="form-control" value={jobForm.contact_details} onChange={e => setJobForm({...jobForm, contact_details: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Expiry Date</label>
              <input type="date" className="form-control" value={jobForm.expiry_date} onChange={e => setJobForm({...jobForm, expiry_date: e.target.value})} />
            </div>
            <div className="form-group form-checkbox full-width-field">
              <input type="checkbox" id="urgentJob" checked={jobForm.is_urgent} onChange={e => setJobForm({...jobForm, is_urgent: e.target.checked})} />
              <label htmlFor="urgentJob">Mark as Urgent/Hiring Fast</label>
            </div>
            
            <div className="form-actions full-width-field">
              <button type="button" className="btn btn-outline" onClick={() => setShowJobModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={jobSubmitting}>
                {jobSubmitting ? 'Saving...' : editingJob ? 'Update Job' : 'Add Job'}
              </button>
            </div>
          </form>
        </Modal>
        {/* Coupon Form Modal */}
        <Modal isOpen={showCouponModal} onClose={() => setShowCouponModal(false)} title={editingCoupon ? 'Edit Coupon' : 'Create New Coupon'} size="md">
          <form className="modal-form-modern" onSubmit={handleCouponSubmit}>
            {/* Row 1: Code */}
            <div className="form-group-modern">
              <label>Coupon Code *</label>
              <div className="code-input-wrapper">
                <div className="input-with-icon" style={{ flex: 1 }}>
                  <FiTag />
                  <input 
                    type="text" 
                    className="form-control-modern" 
                    style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: '800' }} 
                    required 
                    value={couponForm.code} 
                    onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})} 
                    placeholder="E.G. SAVE50" 
                  />
                </div>
                <button 
                  type="button" 
                  className="btn-generate"
                  onClick={() => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                    let code = '';
                    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
                    setCouponForm({...couponForm, code});
                  }}
                >
                  Generate
                </button>
              </div>
            </div>

            {/* Row 2: Type & Value */}
            <div className="form-row-modern">
              <div className="form-group-modern">
                <label>Discount Type *</label>
                <div className="input-with-icon">
                  <FiInfo />
                  <select 
                    className="form-control-modern" 
                    required 
                    value={couponForm.discount_type} 
                    onChange={e => setCouponForm({...couponForm, discount_type: e.target.value})}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
              </div>
              <div className="form-group-modern">
                <label>Discount Value *</label>
                <div className="input-with-icon">
                  <FiPercent />
                  <input 
                    type="number" 
                    className="form-control-modern" 
                    required 
                    value={couponForm.discount_value} 
                    onChange={e => setCouponForm({...couponForm, discount_value: e.target.value})} 
                    placeholder={couponForm.discount_type === 'percentage' ? 'e.g. 50' : 'e.g. 500'} 
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Applies To */}
            <div className="form-group-modern">
              <label>Applies To (Course)</label>
              <div className="input-with-icon">
                <FiBookOpen />
                <select 
                  className="form-control-modern" 
                  value={couponForm.course_id} 
                  onChange={e => setCouponForm({...couponForm, course_id: e.target.value})}
                >
                  <option value="">All Courses (Global)</option>
                  {courses.filter(c => c.status === 'approved').map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Expiry & Limit */}
            <div className="form-row-modern">
              <div className="form-group-modern">
                <label>Expiry Date</label>
                <div className="input-with-icon">
                  <FiCalendar />
                  <input 
                    type="date" 
                    className="form-control-modern" 
                    value={couponForm.expiry_date} 
                    onChange={e => setCouponForm({...couponForm, expiry_date: e.target.value})} 
                  />
                </div>
              </div>
              <div className="form-group-modern">
                <label>Usage Limit</label>
                <div className="input-with-icon">
                  <FiUsers />
                  <input 
                    type="number" 
                    className="form-control-modern" 
                    value={couponForm.usage_limit} 
                    onChange={e => setCouponForm({...couponForm, usage_limit: e.target.value})} 
                    placeholder="Unlimited" 
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer-modern">
              <button type="button" className="btn-modern outline" onClick={() => setShowCouponModal(false)}>Cancel</button>
              <button type="submit" className="btn-modern primary" disabled={couponSubmitting}>
                {couponSubmitting ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    </div>
  );
}
