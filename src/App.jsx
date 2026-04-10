import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import CourseList from './pages/CourseList';
import CourseDetail from './pages/CourseDetail';
import VideoLearning from './pages/VideoLearning';
import Assessment from './pages/Assessment';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import CertificateVerification from './pages/CertificateVerification';
import CertificatePublicVerify from './pages/CertificatePublicVerify';
import BecomeInstructor from './pages/BecomeInstructor';
import StudentDashboard from './pages/StudentDashboard';
import InstructorDashboard from './pages/InstructorDashboard';
import AdminPanel from './pages/AdminPanel';
import InstructorProfile from './pages/InstructorProfile';
import AboutUs from './pages/AboutUs';
import Contact from './pages/Contact';
import HelpCenter from './pages/HelpCenter';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import BlogList from './pages/blog/BlogList';
import BlogDetail from './pages/blog/BlogDetail';
import BlogEditor from './pages/blog/BlogEditor';
import CareersHub from './pages/CareersHub';
import JobDetail from './pages/JobDetail';
import SavedJobs from './pages/SavedJobs';
import DailyQuiz from './pages/DailyQuiz';
import Leaderboard from './pages/Leaderboard';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import LiveBootcamps from './pages/LiveBootcamps';
import LiveBootcampDetail from './pages/LiveBootcampDetail';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ScrollToTop from './components/layout/ScrollToTop';
import WhatsAppButton from './components/ui/WhatsAppButton';

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <WhatsAppButton />
      <Routes>
        {/* Pages with Navbar + Footer */}
        <Route element={<Layout />}>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/help-center" element={<HelpCenter />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/courses" element={<CourseList />} />
          <Route path="/careers" element={<CareersHub />} />
          <Route path="/careers/:id" element={<JobDetail />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/instructor/profile/:id" element={<InstructorProfile />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/become-instructor" element={<BecomeInstructor />} />
          <Route path="/verify/:id" element={<CertificateVerification />} />
          <Route path="/verify-certificate/:certId" element={<CertificatePublicVerify />} />
          <Route path="/verify-certificate" element={<CertificatePublicVerify />} />
          <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
          <Route path="/saved-jobs" element={<ProtectedRoute><SavedJobs /></ProtectedRoute>} />
          <Route path="/daily-quiz" element={<DailyQuiz />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/live-bootcamps" element={<LiveBootcamps />} />
          <Route path="/live-bootcamps/:id" element={<LiveBootcampDetail />} />
          <Route path="/instructor" element={<ProtectedRoute allowedRoles={['instructor', 'admin']}><InstructorDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminPanel /></ProtectedRoute>} />
          <Route path="/blog" element={<BlogList />} />
          <Route path="/blog/write" element={<ProtectedRoute allowedRoles={['admin', 'instructor', 'author']}><BlogEditor /></ProtectedRoute>} />
          <Route path="/blog/:slug" element={<BlogDetail />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        {/* Full-screen pages (no footer) */}
        <Route path="/learn/:id" element={<ProtectedRoute><VideoLearning /></ProtectedRoute>} />
        <Route path="/assessment/:courseId" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}
