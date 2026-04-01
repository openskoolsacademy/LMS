import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { FiSave, FiCheckCircle } from 'react-icons/fi';
import './Blog.css';

export default function BlogEditor() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Auto-generate a slug from title
  const generateSlug = (text) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleSave = async (status) => {
    if (!title || !content || !excerpt) {
      setError('Please fill in all required fields (Title, Excerpt, Content).');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const slug = generateSlug(title);
      
      const { error: insertError } = await supabase
        .from('blogs')
        .insert([{
          title,
          slug: `${slug}-${Date.now().toString().slice(-4)}`, // Ensure uniqueness
          content,
          excerpt,
          cover_image: coverImage || null,
          status,
          author_id: user.id
        }]);

      if (insertError) throw insertError;
      
      if (status === 'published') {
        alert('Blog published successfully!');
        navigate('/blog');
      } else {
        alert('Blog submitted for admin review!');
        // Keep them on page or redirect to their courses/dashboard
        navigate('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to save the blog. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="blog-editor-page animate-fade">
      <div className="editor-header">
        <h1>Write Post</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {role === 'admin' ? (
            <button 
              className="btn btn-primary btn-lg" 
              onClick={() => handleSave('published')} 
              disabled={saving}
            >
              <FiCheckCircle style={{ marginRight: '8px' }} /> Publish Now
            </button>
          ) : (
            <button 
              className="btn btn-primary btn-lg" 
              onClick={() => handleSave('pending')} 
              disabled={saving}
            >
              <FiSave style={{ marginRight: '8px' }} /> Submit for Review
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
        ></textarea>
      </div>
    </div>
  );
}
