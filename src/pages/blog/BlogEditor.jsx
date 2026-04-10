import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { FiSave, FiCheckCircle, FiArrowLeft } from 'react-icons/fi';
import './Blog.css';
import Loader from '../../components/ui/Loader';

export default function BlogEditor() {
  const navigate = useNavigate();
  const { slug } = useParams(); // Will be defined when editing
  const { user, role } = useAuth();
  const { showAlert } = useAlert();
  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!slug);
  const [error, setError] = useState(null);
  const [existingBlog, setExistingBlog] = useState(null);

  const isEditing = !!slug;

  // Auto-generate a slug from title
  const generateSlug = (text) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  // Load existing blog data when editing
  useEffect(() => {
    if (!slug) return;

    const loadBlog = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from('blogs')
          .select('id, title, slug, content, excerpt, cover_image, status, author_id')
          .eq('slug', slug)
          .single();

        if (fetchErr) throw fetchErr;

        // Check permission: must be author or admin
        if (data.author_id !== user?.id && role !== 'admin') {
          await showAlert('You do not have permission to edit this blog.', 'Access Denied', 'error');
          navigate('/blog');
          return;
        }

        setExistingBlog(data);
        setTitle(data.title || '');
        setExcerpt(data.excerpt || '');
        setCoverImage(data.cover_image || '');
        setContent(data.content || '');
      } catch (err) {
        console.error('Error loading blog for editing:', err);
        await showAlert('Could not load blog for editing.', 'Error', 'error');
        navigate('/blog');
      } finally {
        setLoading(false);
      }
    };

    loadBlog();
  }, [slug, user, role]);

  const handleSave = async (status) => {
    if (!title || !content || !excerpt) {
      setError('Please fill in all required fields (Title, Excerpt, Content).');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (isEditing && existingBlog) {
        // Update existing blog
        const updatePayload = {
          title,
          content,
          excerpt,
          cover_image: coverImage || null,
          status,
        };

        const { error: updateError } = await supabase
          .from('blogs')
          .update(updatePayload)
          .eq('id', existingBlog.id);

        if (updateError) throw updateError;

        await showAlert('Blog updated successfully!', 'Success', 'success');
        navigate(`/blog/${existingBlog.slug}`);
      } else {
        // Create new blog
        const newSlug = generateSlug(title);

        const { error: insertError } = await supabase
          .from('blogs')
          .insert([{
            title,
            slug: `${newSlug}-${Date.now().toString().slice(-4)}`, // Ensure uniqueness
            content,
            excerpt,
            cover_image: coverImage || null,
            status,
            author_id: user.id
          }]);

        if (insertError) throw insertError;

        if (status === 'published') {
          await showAlert('Blog published successfully!', 'Success', 'success');
          navigate('/blog');
        } else {
          await showAlert('Blog submitted for admin review!', 'Success', 'success');
          navigate('/dashboard');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to save the blog. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="vl-page"><Loader text="Loading blog..." /></div>;

  return (
    <div className="blog-editor-page animate-fade">
      <div className="editor-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to={isEditing ? `/blog/${slug}` : '/blog'} className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <FiArrowLeft /> Back
          </Link>
          <h1>{isEditing ? 'Edit Post' : 'Write Post'}</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {role === 'admin' ? (
            <button 
              className="btn btn-primary btn-lg" 
              onClick={() => handleSave('published')} 
              disabled={saving}
              id="blog-publish-button"
            >
              <FiCheckCircle style={{ marginRight: '8px' }} /> {isEditing ? 'Update & Publish' : 'Publish Now'}
            </button>
          ) : (
            <button 
              className="btn btn-primary btn-lg" 
              onClick={() => handleSave('pending')} 
              disabled={saving}
              id="blog-submit-button"
            >
              <FiSave style={{ marginRight: '8px' }} /> {isEditing ? 'Update' : 'Submit for Review'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-error" style={{ marginBottom: '32px', padding: '16px 20px', background: '#fee2e2', color: '#b91c1c', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
           {error}
        </div>
      )}

      <div className="editor-form-group">
        <label>Article Title *</label>
        <input 
          type="text" 
          className="editor-input editor-title-input" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          placeholder="e.g. The Future of AI in Education"
          id="blog-title-input"
        />
      </div>

      <div className="editor-form-group">
        <label>Cover Image URL (Optional)</label>
        <input 
          type="url" 
          className="editor-input" 
          value={coverImage} 
          onChange={(e) => setCoverImage(e.target.value)} 
          placeholder="https://example.com/my-image.jpg"
          id="blog-cover-input"
        />
        {coverImage && (
          <img 
            src={coverImage} 
            alt="Cover Preview" 
            className="editor-cover-preview"
          />
        )}
      </div>

      <div className="editor-form-group">
        <label>Short Excerpt *</label>
        <textarea 
          className="editor-input" 
          value={excerpt} 
          onChange={(e) => setExcerpt(e.target.value)} 
          placeholder="Write a completely captivating 2-3 sentence summary of your post to appear on the blog grid..."
          rows={3}
          style={{ resize: 'vertical' }}
          id="blog-excerpt-input"
        ></textarea>
      </div>

      <div className="editor-form-group">
        <label>Article Content * (Use HTML or plain text)</label>
        <textarea 
          className="editor-input editor-content-area" 
          value={content} 
          onChange={(e) => setContent(e.target.value)} 
          placeholder="Write something amazing... Use <p> and <h2> for formatting."
          rows={18}
          style={{ resize: 'vertical' }}
          id="blog-content-input"
        ></textarea>
      </div>
    </div>
  );
}
