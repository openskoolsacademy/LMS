import { Link } from 'react-router-dom';
import { FiInstagram, FiFacebook, FiLinkedin } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__grid">
          <div className="footer__brand">
            <Link to="/" className="footer__logo">
              <img src="/logo.svg" alt="Open Skools Academy Logo" className="brand-logo" />
            </Link>
            <p>Empowering learners worldwide with high quality, accessible education. Join millions of students building the future.</p>
            <div className="footer__socials">
              <a href="https://www.instagram.com/openskoolsacademy" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><FiInstagram /></a>
              <a href="https://www.facebook.com/people/Open-Skools-Academy/61584820124627/#" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FiFacebook /></a>
              <a href="https://www.linkedin.com/company/open-skools/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FiLinkedin /></a>
              <a href="https://wa.me/message/E5OKPXTRFRD5E1" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><FaWhatsapp /></a>
            </div>
          </div>
          <div className="footer__col">
            <h4>Quick Links</h4>
            <Link to="/about">About Us</Link>
            <Link to="/courses">All Courses</Link>
            <Link to="/careers">Careers Hub</Link>
            <Link to="/dashboard">My Dashboard</Link>
            <Link to="/become-instructor">Become an Instructor</Link>
            <Link to="/signup">Create Account</Link>
          </div>
          <div className="footer__col">
            <h4>Categories</h4>
            <Link to="/courses">Programming & Development</Link>
            <Link to="/courses">Artificial Intelligence & Automation</Link>
            <Link to="/courses">AI Productivity & Prompting</Link>
            <Link to="/courses">Design & Creativity</Link>
          </div>
          <div className="footer__col">
            <h4>Support</h4>
            <a href="#">Help Center</a>
            <Link to="/verify-certificate">Verify Certificate</Link>
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
            <Link to="/contact">Contact Us</Link>
          </div>
        </div>
        <div className="footer__bottom">
          <p>&copy; {new Date().getFullYear()} Open Skools. All rights reserved.</p>
          <p>Built to support learners everywhere</p>
        </div>
      </div>
    </footer>
  );
}
