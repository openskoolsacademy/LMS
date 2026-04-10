import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { resolveImageUrl } from '../../utils/imageUtils';
import { FiClock, FiUser } from 'react-icons/fi';
import GlobalBanner from '../../components/ui/GlobalBanner';
import './Blog.css';
import Loader from '../../components/ui/Loader';


export default function BlogList() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBlogs = async () => {
      try {
        const { data, error } = await supabase
          .from('blogs')
          .select(`
            id, title, slug, excerpt, cover_image, created_at,
            author:users(name, avatar_url)
          `)
          .eq('status', 'published')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setBlogs(data || []);
      } catch (err) {
        console.error('Error fetching blogs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBlogs();
  }, []);

  if (loading) return <div className="vl-page"><Loader text="Loading..." /></div>;

  return (
    <div className="blog-page">
      <div className="container">
        <header className="blog-header">
          <h1>Our Latest Insights</h1>
          <p>Expert articles, news, and tutorials to enhance your skills.</p>
        </header>

        <GlobalBanner location="Blog" />

        {blogs.length === 0 ? (
          <div className="empty-state">
            <p>No articles published yet. Check back soon!</p>
          </div>
        ) : (
          <div className="blog-grid">
            {blogs.map((blog) => (
              <Link to={`/blog/${blog.slug}`} key={blog.id} className="blog-card">
                <div className="blog-card-img">
                  <img 
                    src={resolveImageUrl(blog.cover_image) || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=800'} 
                    alt={blog.title} 
                  />
                </div>
                <div className="blog-card-content">
                  <h3 className="blog-title">{blog.title}</h3>
                  <p className="blog-excerpt">{blog.excerpt}</p>
                  <div className="blog-meta">
                    <div className="blog-author">
                      {blog.author?.avatar_url ? (
                        <img src={blog.author.avatar_url} alt={blog.author?.name} className="author-avatar" />
                      ) : (
                        <div className="author-avatar-placeholder"><FiUser /></div>
                      )}
                      <span>{blog.author?.name || 'Unknown Author'}</span>
                    </div>
                    <div className="blog-date">
                      <FiClock />
                      {new Date(blog.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
