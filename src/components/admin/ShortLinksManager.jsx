import { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCopy, FiToggleLeft, FiToggleRight, FiExternalLink, FiMousePointer, FiLink2, FiCheck } from 'react-icons/fi';
import { supabase } from '../../lib/supabase';
import { useAlert } from '../../context/AlertContext';
import Modal from '../ui/Modal';

export default function ShortLinksManager() {
  const { showAlert, showConfirm } = useAlert();
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', slug: '', destination_url: '' });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('short_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setLinks(data || []);
    } catch (err) {
      showAlert('Error loading links: ' + err.message, 'Error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let slug = '';
    for (let i = 0; i < 6; i++) slug += chars[Math.floor(Math.random() * chars.length)];
    return slug;
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ title: '', slug: generateSlug(), destination_url: '' });
    setShowModal(true);
  };

  const openEdit = (link) => {
    setEditing(link);
    setForm({ title: link.title || '', slug: link.slug, destination_url: link.destination_url });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.slug.trim() || !form.destination_url.trim()) return;

    // Sanitize slug
    const cleanSlug = form.slug.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!cleanSlug) {
      showAlert('Slug can only contain letters, numbers, hyphens, and underscores.', 'Error', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('short_links')
          .update({ title: form.title, slug: cleanSlug, destination_url: form.destination_url })
          .eq('id', editing.id);
        if (error) throw error;
        setLinks(links.map(l => l.id === editing.id ? { ...l, title: form.title, slug: cleanSlug, destination_url: form.destination_url } : l));
        showAlert('Link updated.', 'Success', 'success');
      } else {
        const { data, error } = await supabase
          .from('short_links')
          .insert([{ title: form.title, slug: cleanSlug, destination_url: form.destination_url }])
          .select()
          .single();
        if (error) {
          if (error.message.includes('duplicate') || error.message.includes('unique')) {
            showAlert('This slug is already in use. Choose a different one.', 'Error', 'error');
          } else {
            throw error;
          }
          setSaving(false);
          return;
        }
        setLinks([data, ...links]);
        showAlert('Short link created!', 'Success', 'success');
      }
      setShowModal(false);
    } catch (err) {
      showAlert('Error: ' + err.message, 'Error', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirmed = await showConfirm('Delete this short link?', undefined, 'Delete Link', 'Delete', 'Cancel');
    if (!confirmed) return;
    try {
      const { error } = await supabase.from('short_links').delete().eq('id', id);
      if (error) throw error;
      setLinks(links.filter(l => l.id !== id));
    } catch (err) {
      showAlert('Error: ' + err.message, 'Error', 'error');
    }
  };

  const handleToggle = async (link) => {
    try {
      const { error } = await supabase
        .from('short_links')
        .update({ is_active: !link.is_active })
        .eq('id', link.id);
      if (error) throw error;
      setLinks(links.map(l => l.id === link.id ? { ...l, is_active: !l.is_active } : l));
    } catch (err) {
      showAlert('Error: ' + err.message, 'Error', 'error');
    }
  };

  const copyShortLink = (slug, id) => {
    const url = `${window.location.origin}/go/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  };

  const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
  const baseUrl = window.location.origin;

  return (
    <div className="ap-content animate-fade">
      <div className="ap-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2><FiLink2 style={{ marginRight: 8, color: 'var(--primary)' }} /> Link Converter</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>Create short links that open in Chrome/Safari from Instagram. Format: <strong>{baseUrl}/go/your-slug</strong></p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FiPlus /> Create Short Link
        </button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#008ad1', borderRadius: 10, padding: 10, color: '#fff', display: 'flex' }}><FiLink2 size={20} /></div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Links</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0c4a6e' }}>{links.length}</div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#10b981', borderRadius: 10, padding: 10, color: '#fff', display: 'flex' }}><FiMousePointer size={20} /></div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Clicks</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#14532d' }}>{totalClicks.toLocaleString()}</div>
          </div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderRadius: 12, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: '#f59e0b', borderRadius: 10, padding: 10, color: '#fff', display: 'flex' }}><FiToggleRight size={20} /></div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Links</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#78350f' }}>{links.filter(l => l.is_active).length}</div>
          </div>
        </div>
      </div>

      {/* Links Table */}
      <div className="ap-table-wrap">
        <table className="id-table ap-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Short Link</th>
              <th>Destination</th>
              <th style={{ width: 90 }}>Clicks</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 140 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
            ) : links.length === 0 ? (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--gray-500)' }}>No short links yet. Create your first one!</td></tr>
            ) : (
              links.map((link) => (
                <tr key={link.id} style={{ opacity: link.is_active ? 1 : 0.5 }}>
                  <td>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>{link.title || link.slug}</div>
                      <div style={{ fontSize: '0.78rem', color: '#008ad1', fontWeight: 500 }}>/go/{link.slug}</div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {link.destination_url}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <FiMousePointer size={13} style={{ color: 'var(--gray-400)' }} />
                      <span style={{ fontWeight: 700 }}>{link.clicks || 0}</span>
                    </div>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleToggle(link)}
                      style={{ color: link.is_active ? '#10b981' : '#9ca3af', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      {link.is_active ? <><FiToggleRight size={18} /> Active</> : <><FiToggleLeft size={18} /> Off</>}
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => copyShortLink(link.slug, link.id)}
                        title="Copy short link"
                        style={copiedId === link.id ? { background: '#10b981', borderColor: '#10b981', color: '#fff' } : {}}
                      >
                        {copiedId === link.id ? <FiCheck size={14} /> : <FiCopy size={14} />}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(link)} title="Edit"><FiEdit2 size={14} /></button>
                      <button className="btn btn-outline btn-sm" onClick={() => window.open(link.destination_url, '_blank')} title="Open destination"><FiExternalLink size={14} /></button>
                      <button className="btn btn-outline btn-sm danger" onClick={() => handleDelete(link.id)} title="Delete"><FiTrash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Short Link' : 'Create Short Link'}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>Title <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--gray-400)' }}>(optional, for your reference)</span></label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Daily Quiz Link"
              style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: '0.938rem' }}
            />
          </div>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>Slug *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1px solid var(--gray-300)', borderRadius: 6, overflow: 'hidden' }}>
              <span style={{ padding: '10px 12px', background: '#f3f4f6', color: 'var(--gray-500)', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap', borderRight: '1px solid var(--gray-300)' }}>{baseUrl}/go/</span>
              <input
                type="text"
                value={form.slug}
                onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                placeholder="my-link"
                required
                style={{ flex: 1, padding: '10px 14px', border: 'none', outline: 'none', fontSize: '0.938rem' }}
              />
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 4, display: 'block' }}>Only lowercase letters, numbers, hyphens, and underscores</span>
          </div>
          <div className="form-group">
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>Destination URL *</label>
            <input
              type="url"
              value={form.destination_url}
              onChange={e => setForm({ ...form, destination_url: e.target.value })}
              placeholder="https://openskools.com/quiz"
              required
              style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--gray-300)', fontSize: '0.938rem' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 4, display: 'block' }}>The URL users will be redirected to</span>
          </div>

          {/* Preview */}
          {form.slug && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', fontSize: '0.85rem' }}>
              <strong style={{ color: '#166534' }}>Preview:</strong>
              <div style={{ color: '#15803d', fontWeight: 600, marginTop: 4, wordBreak: 'break-all' }}>
                {baseUrl}/go/{form.slug.toLowerCase().replace(/[^a-z0-9-_]/g, '')}
              </div>
              <div style={{ color: '#6b7280', marginTop: 2 }}>
                → {form.destination_url || '(enter destination URL)'}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Link'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
