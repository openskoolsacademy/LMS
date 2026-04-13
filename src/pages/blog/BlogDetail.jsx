import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { resolveImageUrl } from '../../utils/imageUtils';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { FiArrowLeft, FiClock, FiUser, FiEdit2, FiTrash2 } from 'react-icons/fi';
import DOMPurify from 'dompurify';
import GlobalBanner from '../../components/ui/GlobalBanner';
import './Blog.css';
import Loader from '../../components/ui/Loader';

export default function BlogDetail() {
  const { slug } = useParams();
  const { user, role } = useAuth();
  const { showAlert, showConfirm } = useAlert();
  const navigate = useNavigate();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        const { data, error } = await supabase
          .from('blogs')
          .select(`
            id, title, status, content, cover_image, created_at, author_id,
            author:users(name, avatar_url, bio)
          `)
          .eq('slug', slug)
          .single();

        if (error) throw error;
        setBlog(data);
      } catch (err) {
        console.error('Error fetching blog details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchBlog();
  }, [slug]);

  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;
  if (!blog) return <div className="text-center" style={{ padding: '100px 0' }}><h2>Article Not Found</h2><Link to="/blog" className="btn btn-primary" style={{ marginTop: '20px' }}>Back to Blog</Link></div>;

  const canEdit = user && (role === 'admin' || blog.author_id === user.id);

  const handleDelete = async () => {
    showConfirm(
      'Are you sure you want to delete this blog post? This action cannot be undone.',
      async () => {
        setDeleting(true);
        try {
          const { error } = await supabase
            .from('blogs')
            .delete()
            .eq('id', blog.id);

          if (error) throw error;
          await showAlert('Blog post deleted successfully.', 'Deleted', 'success');
          navigate('/blog');
        } catch (err) {
          console.error('Error deleting blog:', err);
          await showAlert('Failed to delete blog post.', 'Error', 'error');
        } finally {
          setDeleting(false);
        }
      },
      'Delete Blog Post'
    );
  };

  return (
    <div className="blog-reading-page">
      <div className="container">
        
        <div className="blog-detail-top-bar" style={{ maxWidth: 800, margin: '0 auto 40px' }}>
          <Link to="/blog" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#6a6f73', textDecoration: 'none', fontWeight: 600 }}>
            <FiArrowLeft /> Back to Blog
          </Link>
          {canEdit && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to={`/blog/edit/${slug}`} className="blog-edit-btn" id="blog-edit-button">
                <FiEdit2 size={14} /> Edit Post
              </Link>
              <button
                className="blog-edit-btn"
                id="blog-delete-button"
                style={{ background: '#fee2e2', color: '#dc2626', borderColor: '#fecaca' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                <FiTrash2 size={14} /> {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          )}
        </div>

        <header className="article-header">
          {blog.status === 'pending' && <span className="badge badge-warning" style={{ marginBottom: '16px', display: 'inline-block' }}>Pending Review</span>}
          <h1 className="article-title">{blog.title}</h1>
          <div className="article-meta">
            <div className="article-author-info">
              {blog.author?.avatar_url ? (
                <img src={resolveImageUrl(blog.author.avatar_url)} alt={blog.author?.name} className="article-author-avatar" />
              ) : (
                <div className="article-author-avatar" style={{ backgroundColor: '#f7f9fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiUser size={24} color="#6a6f73" /></div>
              )}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 700, color: '#1c1d1f' }}>{blog.author?.name || 'Unknown Author'}</div>
                <div style={{ fontSize: '0.85rem', color: '#6a6f73' }}>
                  {new Date(blog.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </header>

        {blog.cover_image && (
          <img 
            src={resolveImageUrl(blog.cover_image)} 
            alt={blog.title} 
            className="inline-blog-cover" 
          />
        )}

        <div style={{ maxWidth: 800, margin: '0 auto 40px' }}>
          <GlobalBanner location="Blog Reading Top" />
        </div>

        <article 
          className="article-content ql-editor" 
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blog.content) }} 
        />

        <div style={{ maxWidth: 800, margin: '40px auto 0' }}>
          <GlobalBanner location="Blog Reading Bottom" />
        </div>
      </div>
    </div>
  );
}
