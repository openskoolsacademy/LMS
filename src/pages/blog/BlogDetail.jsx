import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { FiArrowLeft, FiClock, FiUser, FiEdit2 } from 'react-icons/fi';
import DOMPurify from 'dompurify'; // Need to sanitize HTML
import GlobalBanner from '../../components/ui/GlobalBanner';
import './Blog.css';
import Loader from '../../components/ui/Loader';



export default function BlogDetail() {
  const { slug } = useParams();
  const { user, role } = useAuth();
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // Show edit button if the user is the blog author or an admin
  const canEdit = user && (role === 'admin' || blog.author_id === user.id);

  return (
    <div className="blog-detail-page">
      {/* Cover Image Banner */}
      {blog.cover_image ? (
        <img src={blog.cover_image} alt={blog.title} className="blog-cover" />
      ) : (
        <div className="blog-cover" style={{ backgroundColor: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ color: 'white', opacity: 0.5, fontSize: '4rem' }}>{blog.title.substring(0, 1)}</h1>
        </div>
      )}

      <div className="container">
        <article className="blog-article">
          <div className="blog-detail-top-bar">
            <Link to="/blog" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <FiArrowLeft /> Back to Blog
            </Link>
            {canEdit && (
              <Link to={`/blog/edit/${slug}`} className="blog-edit-btn" id="blog-edit-button">
                <FiEdit2 size={14} /> Edit Post
              </Link>
            )}
          </div>

          <header className="article-header">
            {blog.status === 'pending' && <span className="badge badge-warning" style={{ marginBottom: '16px', display: 'inline-block' }}>Pending Review</span>}
            <h1 className="article-title">{blog.title}</h1>
            <div className="article-meta">
              <div className="article-author-info">
                {blog.author?.avatar_url ? (
                  <img src={blog.author.avatar_url} alt={blog.author?.name} className="article-author-avatar" />
                ) : (
                  <div className="article-author-avatar" style={{ backgroundColor: 'var(--gray-200)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FiUser size={24} /></div>
                )}
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: 'var(--dark)' }}>{blog.author?.name || 'Unknown Author'}</div>
                  <div style={{ fontSize: '0.85rem' }}>{new Date(blog.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                </div>
              </div>
            </div>
          </header>

          <GlobalBanner location="Blog Reading Top" />

          <div 
            className="article-content ql-editor" 
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(blog.content) }} 
          />

          <GlobalBanner location="Blog Reading Bottom" />
        </article>
      </div>
    </div>
  );
}
