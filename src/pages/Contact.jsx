import { useState } from 'react';
import { FiPhone, FiMail, FiMapPin, FiSend } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAlert } from '../context/AlertContext';
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

      await showAlert('Your message has been sent successfully. We will get back to you soon!', 'Message Sent', 'success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      console.error('Error sending message:', err);
      await showAlert('Failed to send message. Please try again later.', 'Error', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-page">
      {/* Hero Section */}
      <section className="contact-hero">
        <div className="container">
          <h1 className="animate-slide-up">Get in Touch</h1>
          <p className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            Have questions or need assistance? Our team is here to help you on your learning journey.
          </p>
        </div>
      </section>

      <section className="contact-content section">
        <div className="container contact-grid">
          {/* Contact Info */}
          <div className="contact-info animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h2>Contact Information</h2>
            <p>Reach out to us through any of these channels.</p>

            <div className="info-cards">
              <div className="info-card">
                <div className="info-icon"><FiPhone /></div>
                <div className="info-text">
                  <h4>Phone</h4>
                  <p>+91 81899 89150</p>
                  <p>+91 81243 93132</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon"><FiMail /></div>
                <div className="info-text">
                  <h4>Email</h4>
                  <p>contact@openskools.com</p>
                </div>
              </div>

              <div className="info-card">
                <div className="info-icon"><FiMapPin /></div>
                <div className="info-text">
                  <h4>Address</h4>
                  <p>Admin Office</p>
                  <p>Open Skools</p>
                  <p>Edapalayam, Redhills, Chennai - 600052</p>
                </div>
              </div>
            </div>
            
            <div className="contact-map-placeholder">
               <img src="https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg" alt="Our Office" />
               <div className="map-overlay">
                 <span>Official Learning Hub</span>
               </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="contact-form-container animate-slide-up" style={{ animationDelay: '0.3s' }}>
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input 
                  type="text" 
                  id="name" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  required 
                  placeholder="Enter your name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input 
                  type="email" 
                  id="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  required 
                  placeholder="Enter your email"
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input 
                  type="text" 
                  id="subject" 
                  name="subject" 
                  value={formData.subject} 
                  onChange={handleChange} 
                  required 
                  placeholder="What is this about?"
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea 
                  id="message" 
                  name="message" 
                  value={formData.message} 
                  onChange={handleChange} 
                  required 
                  placeholder="Your message here..."
                  rows="5"
                ></textarea>
              </div>

              <button type="submit" className="btn btn-primary btn-lg submit-btn" disabled={loading}>
                {loading ? 'Sending...' : <><FiSend /> Send Message</>}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
