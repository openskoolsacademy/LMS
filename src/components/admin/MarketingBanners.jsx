import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiServer, FiCheckCircle, FiXCircle, FiBarChart2, FiEye, FiMousePointer, FiPercent } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { useAlert } from '../../context/AlertContext';
import Modal from '../ui/Modal';

export default function MarketingBanners() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [showReport, setShowReport] = useState(false);
  const { showAlert } = useAlert();

  const LOCATIONS = ['Home', 'Dashboard', 'Careers', 'Blog', 'Courses', 'Quiz', 'Leaderboard', 'About', 'Contact'];

  const [formConfig, setFormConfig] = useState({
    title: '',
    subtitle: '',
    cta_text: '',
    cta_link: '',
    image_url: '',
    bg_color: '#008ad1',
    start_date: '',
    end_date: '',
    status: 'active',
    display_locations: []
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('marketing_banners')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setBanners(data || []);
    } catch (err) {
      showAlert(`Error loading banners: ${err.message}`, 'Fetch Failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshAnalytics = () => {
    fetchBanners(); // Re-fetch from Supabase to get latest counts
  };

  const handleOpenModal = (banner = null) => {
    if (banner) {
      setEditingBanner(banner);
      setFormConfig({
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        cta_text: banner.cta_text || '',
        cta_link: banner.cta_link || '',
        image_url: banner.image_url || '',
        bg_color: banner.bg_color || '#008ad1',
        start_date: new Date(banner.start_date).toISOString().slice(0,16),
        end_date: new Date(banner.end_date).toISOString().slice(0,16),
        status: banner.status || 'active',
        display_locations: banner.display_locations || []
      });
    } else {
      setEditingBanner(null);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 30);
      setFormConfig({
        title: '', subtitle: '', cta_text: '', cta_link: '', image_url: '',
        bg_color: '#008ad1',
        start_date: new Date().toISOString().slice(0,16),
        end_date: tomorrow.toISOString().slice(0,16),
        status: 'active',
        display_locations: ['Home']
      });
    }
    setIsModalOpen(true);
  };

  const toggleLocation = (loc) => {
    setFormConfig(prev => {
      if (prev.display_locations.includes(loc)) {
        return { ...prev, display_locations: prev.display_locations.filter(l => l !== loc) };
      } else {
        return { ...prev, display_locations: [...prev.display_locations, loc] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formConfig.display_locations.length === 0) {
      showAlert('Please select at least one display location.', 'Validation Error', 'error');
      return;
    }

    try {
      const payload = {
        title: formConfig.title,
        subtitle: formConfig.subtitle || null,
        cta_text: formConfig.cta_text || null,
        cta_link: formConfig.cta_link || null,
        image_url: formConfig.image_url || null,
        bg_color: formConfig.bg_color || '#008ad1',
        start_date: new Date(formConfig.start_date).toISOString(),
        end_date: new Date(formConfig.end_date).toISOString(),
        status: formConfig.status,
        display_locations: formConfig.display_locations
      };

      if (editingBanner) {
        const { error } = await supabase.from('marketing_banners').update(payload).eq('id', editingBanner.id);
        if (error) throw error;
        showAlert('Banner updated successfully.', 'Success', 'success');
      } else {
        const { error } = await supabase.from('marketing_banners').insert(payload);
        if (error) throw error;
        showAlert('Banner created successfully.', 'Success', 'success');
      }
      setIsModalOpen(false);
      fetchBanners();
    } catch (err) {
      showAlert(err.message, 'Save Failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to completely delete this banner?')) return;
    try {
      const { error } = await supabase.from('marketing_banners').delete().eq('id', id);
      if (error) throw error;
      fetchBanners();
    } catch (err) {
      showAlert(err.message, 'Delete Failed', 'error');
    }
  };

  // Calculate total analytics from banner data (Supabase)
  const totalImpressions = banners.reduce((sum, b) => sum + (b.impressions || 0), 0);
  const totalClicks = banners.reduce((sum, b) => sum + (b.clicks || 0), 0);
  const overallCTR = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0';

  return (
    <div className="ap-content animate-fade">
      <div className="ap-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' }}>
        <div>
          <h2><FiServer style={{ marginRight: 8, color: 'var(--primary)' }} /> Marketing Banners</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Create dynamic targeted banners for the platform.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${showReport ? 'btn-primary' : 'btn-outline'}`} 
            onClick={() => { setShowReport(!showReport); refreshAnalytics(); }} 
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <FiBarChart2 /> Campaign Report
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <FiPlus /> Create Banner
          </button>
        </div>
      </div>

      {/* Campaign Report Section */}
      {showReport && (
        <div className="animate-fade" style={{ marginBottom: 32 }}>
          {/* Summary Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', borderRadius: '12px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: '#008ad1', borderRadius: '12px', padding: '12px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiEye size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Impressions</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0c4a6e' }}>{totalImpressions.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)', borderRadius: '12px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: '#10b981', borderRadius: '12px', padding: '12px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiMousePointer size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total CTA Clicks</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#14532d' }}>{totalClicks.toLocaleString()}</div>
              </div>
            </div>
            <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderRadius: '12px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ background: '#f59e0b', borderRadius: '12px', padding: '12px', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FiPercent size={24} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall CTR</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#78350f' }}>{overallCTR}%</div>
              </div>
            </div>
          </div>

          {/* Per-Banner Analytics */}
          <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--gray-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                <FiBarChart2 style={{ marginRight: 8, color: 'var(--primary)' }} />
                Per-Campaign Analytics
              </h3>
              <button className="btn btn-outline btn-sm" onClick={refreshAnalytics} style={{ fontSize: '0.75rem' }}>
                Refresh Data
              </button>
            </div>
            <div style={{ padding: '16px 24px' }}>
              {banners.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: '24px 0' }}>No campaigns to report on.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {banners.map(b => {
                    const stats = { impressions: b.impressions || 0, clicks: b.clicks || 0 };
                    const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(1) : '0.0';
                    const maxImpressions = Math.max(...banners.map(bb => (bb.impressions || 0)), 1);
                    const barWidth = (stats.impressions / maxImpressions) * 100;
                    
                    return (
                      <div key={b.id} style={{ padding: '16px', background: 'var(--gray-50)', borderRadius: '10px', border: '1px solid var(--gray-100)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--dark)' }}>{b.title}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '2px' }}>
                              {b.display_locations?.join(' • ')} • {b.status === 'active' ? '🟢 Active' : '⚪ Inactive'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '20px', fontSize: '0.8rem' }}>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#008ad1' }}>{stats.impressions}</div>
                              <div style={{ color: 'var(--gray-500)', fontSize: '0.7rem', fontWeight: 600 }}>VIEWS</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#10b981' }}>{stats.clicks}</div>
                              <div style={{ color: 'var(--gray-500)', fontSize: '0.7rem', fontWeight: 600 }}>CLICKS</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#f59e0b' }}>{ctr}%</div>
                              <div style={{ color: 'var(--gray-500)', fontSize: '0.7rem', fontWeight: 600 }}>CTR</div>
                            </div>
                          </div>
                        </div>
                        {/* Visual bar */}
                        <div style={{ height: '6px', background: 'var(--gray-200)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ 
                            height: '100%', 
                            width: `${barWidth}%`, 
                            background: 'linear-gradient(90deg, #008ad1, #33a1da)',
                            borderRadius: '3px',
                            transition: 'width 0.6s ease'
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="ap-table-wrap">
        <table className="id-table ap-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Status</th>
              <th>Locations</th>
              <th>Date Range</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px' }}>Loading banners...</td></tr>
            ) : banners.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-500)' }}>No banners found. Start by creating one!</td></tr>
            ) : (
              banners.map(b => (
                <tr key={b.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--dark)' }}>{b.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>{b.cta_text || 'No CTA'}</div>
                  </td>
                  <td>
                    {b.status === 'active' ? (
                      <span className="badge badge-success"><FiCheckCircle style={{marginRight: 4}}/> Active</span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: '#e5e7eb', color: '#4b5563' }}><FiXCircle style={{marginRight: 4}}/> Inactive</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {b.display_locations.map(l => <span key={l} className="badge badge-info" style={{ fontSize: '0.65rem' }}>{l}</span>)}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.813rem' }}>
                    {new Date(b.start_date).toLocaleDateString()} - {new Date(b.end_date).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleOpenModal(b)} aria-label="Edit"><FiEdit2 /></button>
                      <button className="btn btn-outline btn-sm danger" onClick={() => handleDelete(b.id)} aria-label="Delete"><FiTrash2 /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingBanner ? 'Edit Banner' : 'Create New Banner'}>
        <form id="bannerForm" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '8px 0' }}>
          
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Banner Title (Primary H2) *</label>
            <input type="text" value={formConfig.title} onChange={e => setFormConfig({...formConfig, title: e.target.value})} required placeholder="e.g. HUGE SALE ON AI COURSES" style={{width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.938rem'}} />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Subtitle / Top Badge (Optional)</label>
            <input type="text" value={formConfig.subtitle} onChange={e => setFormConfig({...formConfig, subtitle: e.target.value})} placeholder="e.g. FLASH DEAL" style={{width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.938rem'}} />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>CTA Button Text</label>
            <input type="text" value={formConfig.cta_text} onChange={e => setFormConfig({...formConfig, cta_text: e.target.value})} placeholder="e.g. Start Learning" style={{width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.938rem'}} />
          </div>
          
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>CTA Button Link</label>
            <input type="text" value={formConfig.cta_link} onChange={e => setFormConfig({...formConfig, cta_link: e.target.value})} placeholder="e.g. /courses or https://..." style={{width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.938rem'}} />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Background Mode</label>
            <div style={{ fontSize: '0.813rem', color: 'var(--gray-500)', marginBottom: 8 }}>Provide a direct Image URL to use a high-quality cover image, OR choose a background color.</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <input type="text" value={formConfig.image_url} onChange={e => setFormConfig({...formConfig, image_url: e.target.value})} placeholder="Image URL (e.g. https://domain.com/bg.jpg)" style={{flex: 1, padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.938rem'}} />
              <input type="color" value={formConfig.bg_color} onChange={e => setFormConfig({...formConfig, bg_color: e.target.value})} style={{ width: 44, height: 44, padding: 0, borderRadius: 4, cursor: 'pointer', border: '1px solid var(--gray-200)' }} title="Background Color Fallback" />
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Start Date & Time *</label>
            <input type="datetime-local" value={formConfig.start_date} onChange={e => setFormConfig({...formConfig, start_date: e.target.value})} style={{width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.938rem'}} required />
          </div>

          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>End Date & Time *</label>
            <input type="datetime-local" value={formConfig.end_date} onChange={e => setFormConfig({...formConfig, end_date: e.target.value})} style={{width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.938rem'}} required />
          </div>

          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Display Locations *</label>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              {LOCATIONS.map(loc => (
                <button 
                  key={loc} 
                  type="button"
                  className={`badge ${formConfig.display_locations.includes(loc) ? 'badge-primary' : 'badge-outline'}`}
                  style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: 20 }}
                  onClick={() => toggleLocation(loc)}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
          
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>Global Status</label>
            <select value={formConfig.status} onChange={e => setFormConfig({...formConfig, status: e.target.value})} style={{width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--gray-300)', fontSize: '0.938rem'}}>
              <option value="active">Active (Visible if between dates)</option>
              <option value="inactive">Inactive (Hidden entirely)</option>
            </select>
          </div>

          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#008ad1' }}>{editingBanner ? 'Save Changes' : 'Launch Campaign'}</button>
          </div>

        </form>
      </Modal>
    </div>
  );
}
