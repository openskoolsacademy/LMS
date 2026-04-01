import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiMail, FiBookOpen, FiAward } from 'react-icons/fi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import './Auth.css';

export default function BecomeInstructor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showAlert } = useAlert();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    expertise: '',
    experience: '',
    phone: '',
    idProof: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data: requestData, error } = await supabase.from('instructor_requests').insert([{
        user_id: user ? user.id : null,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        id_proof: formData.idProof,
        expertise: formData.expertise,
        experience: formData.experience,
        status: 'pending'
      }]).select();
      
      if (error) throw error;
      
      // Send Notifications
      if (user) {
        // 1. Notify the User
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: 'Instructor Request Received',
          message: 'Your request to become an instructor has been received and is being reviewed by our team.',
          type: 'system'
        });

        // 2. Notify all Admins
        const { data: admins } = await supabase.from('users').select('id').eq('role', 'admin');
        if (admins && admins.length > 0) {
          const adminNotifs = admins.map(admin => ({
            user_id: admin.id,
            title: 'New Instructor Request',
            message: `<strong>${formData.name}</strong> has applied to become an instructor for <strong>${formData.expertise}</strong>.`,
            type: 'system'
          }));
          await supabase.from('notifications').insert(adminNotifs);
        }
      }
      
      await showAlert('Your request has been submitted successfully! Our admin team will review it and get back to you shortly.', 'Request Submitted', 'success');
      navigate('/');
    } catch (err) {
      await showAlert("Failed to submit request: " + err.message, 'Error', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
      <div className="auth-card animate-scale" style={{ maxWidth: '600px' }}>
        <div className="auth-header">
          <h2>Become an Instructor</h2>
          <p>Share your knowledge and reach millions of students.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Full Name *</label>
            <div className="input-icon">
              <FiUser />
              <input type="text" placeholder="Enter full name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
            </div>
          </div>
          
          <div className="form-group">
            <label>Email Address *</label>
            <div className="input-icon">
              <FiMail />
              <input type="email" placeholder="Enter email address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
            </div>
          </div>

          <div className="form-group">
            <label>Phone Number *</label>
            <div className="input-icon">
              <FiUser />
              <input type="tel" placeholder="Enter phone number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} required />
            </div>
          </div>
          
          <div className="form-group">
            <label>Government ID Proof URL / Number *</label>
            <div className="input-icon">
              <FiBookOpen />
              <input type="text" placeholder="e.g. Passport or National ID Number" value={formData.idProof} onChange={e => setFormData({...formData, idProof: e.target.value})} required />
            </div>
          </div>
          
          <div className="form-group">
            <label>Area of Expertise *</label>
            <div className="input-icon">
              <FiBookOpen />
              <input type="text" placeholder="e.g., Software Engineering, Data Science" value={formData.expertise} onChange={e => setFormData({...formData, expertise: e.target.value})} required />
            </div>
          </div>

          <div className="form-group">
            <label>Teaching Experience / Portfolio (Brief) *</label>
            <div className="input-icon" style={{ alignItems: 'flex-start' }}>
              <FiAward style={{ marginTop: '14px' }} />
              <textarea 
                placeholder="Briefly describe your teaching experience and point to your portfolio..." 
                value={formData.experience} 
                onChange={e => setFormData({...formData, experience: e.target.value})} 
                required 
                rows={4}
                style={{ width: '100%', padding: '12px 16px 12px 40px', border: '2px solid var(--gray-200)', borderRadius: 'var(--radius)', outline: 'none', transition: 'var(--transition)' }}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading} style={{ marginTop: '16px' }}>
            {loading ? 'Submitting Request...' : 'Submit Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
