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

  // Hardcoded tags for the sidebar UI
  const popularTopics = [
    'Web Development', 'React', 'AI', 'JavaScript', 
    'Python', 'Design', 'Data Science', 'Technology'
  ];

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

  const featuredPost = blogs.length > 0 ? blogs[0] : null;
  const gridPosts = blogs.length > 1 ? blogs.slice(1) : [];

  return (
    <div className="blog-page">
      <div className="container">
        <header className="blog-header">
          <h1>Our Latest Insights</h1>
          <p>Expert articles, news, and tutorials to enhance your skills.</p>
        </header>

        <GlobalBanner location="Blog" />

        {blogs.length === 0 ? (
          <div className="empty-state" style={{ marginTop: '40px' }}>
            <p style={{ color: '#6a6f73', fontSize: '1.2rem' }}>No articles published yet. Check back soon!</p>
          </div>
        ) : (
          <>
            {/* Featured Hero Post */}
            {featuredPost && (
              <div className="blog-featured">
                <img 
                  src={resolveImageUrl(featuredPost.cover_image) || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=1200'} 
                  alt={featuredPost.title} 
                  className="blog-featured-img"
                />
                <div className="blog-featured-content">
                  <span className="blog-badge">Featured Post</span>
                  <Link to={`/blog/${featuredPost.slug}`} style={{ textDecoration: 'none' }}>
                    <h2 className="blog-featured-title">{featuredPost.title}</h2>
                  </Link>
                  <p className="blog-featured-excerpt">{featuredPost.excerpt}</p>
                  <div className="blog-meta-minimal">
                    <div className="blog-author-minimal">
                      {featuredPost.author?.name || 'Unknown Author'}
                    </div>
                    <span>•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FiClock />
                      {new Date(featuredPost.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Layout: Grid + Sidebar */}
            <div className="blog-layout">
              {/* Left Column: Grid */}
              <div>
                <h3 className="blog-sidebar-title" style={{ marginTop: 0 }}>All Articles</h3>
                {gridPosts.length === 0 ? (
                  <p style={{ color: '#6a6f73' }}>No more articles to show right now.</p>
                ) : (
                  <div className="blog-grid">
                    {gridPosts.map((blog) => (
                      <Link to={`/blog/${blog.slug}`} key={blog.id} className="blog-card">
                        <img 
                          src={resolveImageUrl(blog.cover_image) || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80&w=800'} 
                          alt={blog.title} 
                          className="blog-card-img"
                        />
                        <div className="blog-card-content">
                          <h3 className="blog-title">{blog.title}</h3>
                          <p className="blog-excerpt">{blog.excerpt}</p>
                          <div className="blog-meta-minimal" style={{ marginTop: 'auto' }}>
                            <div className="blog-author-minimal">
                              {blog.author?.name || 'Unknown Author'}
                            </div>
                            <span>•</span>
                            <div>
                              {new Date(blog.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Sidebar */}
              <aside className="blog-sidebar">
                <div className="blog-sidebar-widget">
                  <h3 className="blog-sidebar-title" style={{ marginTop: 0 }}>Popular Topics</h3>
                  <div className="sidebar-tags">
                    {popularTopics.map((topic, i) => (
                      <Link key={i} to={`/blog?topic=${encodeURIComponent(topic)}`} className="sidebar-tag">
                        {topic}
                      </Link>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
