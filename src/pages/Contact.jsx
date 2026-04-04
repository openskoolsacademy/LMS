import { useState, useEffect } from 'react';
import { FiPhone, FiMail, FiSend, FiMessageCircle, FiChevronDown, FiClock } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAlert } from '../context/AlertContext';
import GlobalBanner from '../components/ui/GlobalBanner';
import './Contact.css';

export default function Contact() {
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    document.title = 'Contact Us — Open Skools';
    window.scrollTo(0, 0);
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from('contact_messages')
        .insert([formData]);

      if (error) throw error;

      await showAlert("Your message has been sent. We'll get back to you soon!", 'Success', 'success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error('Error sending message:', err);
      await showAlert('Failed to send message. Please try again later.', 'Error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const faqs = [
    { q: "How do I enroll in a course?", a: "You can enroll by navigating to the Courses page, selecting your desired course, and clicking 'Enroll Now'." },
    { q: "Are the certificates verified?", a: "Yes, all our certificates come with a unique ID that can be verified on our platform." },
    { q: "Do you offer placement assistance?", a: "We provide dedicated placement support and access to our exclusive Careers Hub." }
  ];

  return (
    <div className="contact-page">
      <GlobalBanner location="Contact" />
      {/* Hero Section */}
      <section className="contact-hero-modern">
        <div className="container contact-hero-content">
          <h1>Need Help? We&apos;re Here for You</h1>
          <p>Contact our support team for quick assistance</p>
        </div>
      </section>

      {/* Main Layout */}
      <section className="contact-main-section">
        <div className="container contact-layout">
          
          {/* Left Column: Quick Actions & FAQs */}
          <div className="contact-left">
            <div className="contact-cards">
              <div className="contact-card">
                <div className="cc-icon whatsapp-icon"><FiMessageCircle /></div>
                <div className="cc-info">
                  <h3>WhatsApp Support</h3>
                  <p>Chat instantly with us</p>
                </div>
                <a href="https://wa.me/918189989150" target="_blank" rel="noreferrer" className="cc-action">Start Chat</a>
              </div>

              <div className="contact-card">
                <div className="cc-icon email-icon"><FiMail /></div>
                <div className="cc-info">
                  <h3>Email Support</h3>
                  <p>contact@openskools.com</p>
                </div>
                <a href="mailto:contact@openskools.com" className="cc-action">Send Email</a>
              </div>

              <div className="contact-card">
                <div className="cc-icon phone-icon"><FiPhone /></div>
                <div className="cc-info">
                  <h3>Phone Support</h3>
                  <p>+91 81899 89150</p>
                </div>
                <a href="tel:+918189989150" className="cc-action">Call Us</a>
              </div>
            </div>

            {/* FAQs Preview */}
            <div className="contact-faqs">
              <h3>Frequently Asked Questions</h3>
              <div className="faq-list">
                {faqs.map((faq, i) => (
                  <div key={i} className="faq-item">
                    <h4>{faq.q}</h4>
                    <p>{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="contact-right">
            <div className="contact-form-wrapper">
              <h2>Send a Message</h2>
              <p className="form-subtext">Fill out the form below and we&apos;ll get back to you shortly.</p>

              <form onSubmit={handleSubmit} className="modern-contact-form">
                <div className="form-group-modern">
                  <label htmlFor="name">Full Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    name="name" 
                    placeholder="e.g. John Doe"
                    value={formData.name} 
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="form-group-modern">
                  <label htmlFor="email">Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    placeholder="e.g. john@example.com"
                    value={formData.email} 
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="form-group-modern form-group-select">
                  <label htmlFor="subject">Subject</label>
                  <div className="select-wrapper">
                    <select 
                      id="subject" 
                      name="subject" 
                      value={formData.subject} 
                      onChange={handleChange} 
                      required
                    >
                      <option value="" disabled>Select a topic...</option>
                      <option value="Course Inquiry">Course Inquiry</option>
                      <option value="Technical Support">Technical Support</option>
                      <option value="Billing Issue">Billing Issue</option>
                      <option value="Partnership">Partnership</option>
                      <option value="Other">Other</option>
                    </select>
                    <FiChevronDown className="select-icon" />
                  </div>
                </div>

                <div className="form-group-modern">
                  <label htmlFor="message">Message</label>
                  <textarea 
                    id="message" 
                    name="message" 
                    placeholder="How can we help you?"
                    value={formData.message} 
                    onChange={handleChange} 
                    required 
                    rows="5"
                  ></textarea>
                </div>

                <button type="submit" className="btn-submit-modern" disabled={loading}>
                  {loading ? 'Sending...' : <><FiSend /> Send Message</>}
                </button>
              </form>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
