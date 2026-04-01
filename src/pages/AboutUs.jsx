import { FiTarget, FiMessageSquare, FiEye, FiStar, FiLinkedin, FiTwitter, FiGlobe } from 'react-icons/fi';
import './AboutUs.css';

export default function AboutUs() {
  return (
    <div className="about-page">
      {/* Pro-Level Hero Section (No Images) */}
      <section className="about-hero-pro">
        <div className="hero-mesh-bg"></div>
        <div className="container about-hero-container">
          
          <div className="about-hero-content animate-slide-up">
            <span className="hero-label">Meet Open Skools</span>
            <h1>Transforming Lives Through Digital Learning</h1>
            <p>Open Skools Academy empowers the next generation to think, create, and lead in the digital world with industry relevant education.</p>
            <div className="hero-inspiration">Inspired by A. P. J. Abdul Kalam</div>
          </div>

          <div className="about-hero-visuals animate-fade">
             <div className="abstract-container">
               {/* Dr. Abdul Kalam Portrait */}
               <div className="kalam-portrait-wrapper">
                 <div className="portrait-halo-glow"></div>
                 <div className="portrait-dashed-circle"></div>
                 <div className="portrait-solid-circle"></div>
                 <div className="portrait-circuit-bg"></div>
                 <img src="/abdul-kalam-hero.png" alt="Dr. A.P.J. Abdul Kalam" className="kalam-portrait-img" />
               </div>

               <div className="glow-sphere s-1"></div>
               <div className="glow-sphere s-2"></div>
             </div>
          </div>
          
        </div>
      </section>

      {/* Main Content */}
      <section className="section bg-light" style={{ paddingTop: '40px' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '6rem' }}>
          
          {/* Company & Founder Split */}
          <div className="about-split animate-slide-up">
            <div className="about-company">
              <h2>Our Story</h2>
              <p>
                Open Skools Academy is a modern learning institute committed to delivering high quality, industry relevant education for students and working professionals. As a forward thinking training organization, we focus on practical skill development, real time learning experiences, and career oriented programs that prepare learners to thrive in today’s competitive world.
              </p>
              <p>
                We are officially registered under the National Career Service (NCS), Government of India, ensuring authenticity, transparency, and regulatory compliance in all our training operations. Our commitment to excellence is further reinforced by our ISO 9001:2015 Certification, reflecting our standardized processes, structured learning methodology, and strong learner support system.
              </p>
              <p>
                By continuously updating our curriculum in line with emerging technologies and industry trends, Open Skools Academy ensures that learners remain confident, competent, and future ready.
              </p>
            </div>
            
            {/* Founder Card - Pro Level UI (Transparent Image) */}
            <div className="founder-profile-pro">
               <div className="founder-image-wrap">
                 <div className="founder-glow-backdrop"></div>
                 <img src="/Founder-transparent.png" alt="Karthik Selva Siva | Founder" className="founder-main-img" />
               </div>

               <div className="founder-info-pro">
                 <div className="founder-name-area">
                   <h3>Karthik Selva Siva</h3>
                   <span className="role-badge">Founder & Managing Director</span>
                 </div>
                 
                 <div className="quote-container">
                   <p className="founder-bio">
                     "Driven by a clear vision to make quality education accessible, engaging, and impactful. We bridge the gap between academic knowledge and real world industry requirements through expert trainers, interactive sessions, and hands on practical learning."
                   </p>
                 </div>
               </div>
            </div>
          </div>

          {/* Vision, Mission, Values */}
          <div className="vmv-section animate-fade" style={{ animationDelay: '0.2s' }}>
            
            <div className="vmv-item">
              <div className="vmv-icon">
                <FiTarget />
              </div>
              <h3>OUR <span>MISSION</span></h3>
              <div className="vmv-divider"><div className="vmv-dot"></div></div>
              <p>
                To bridge the gap between traditional learning and modern technology by creating innovative, learner centric digital platforms. We aim to inspire curiosity, promote lifelong learning, and equip students with the tools to unlock their full potential.
              </p>
            </div>

            <div className="vmv-divider-vertical"></div>
            
            <div className="vmv-item">
              <div className="vmv-icon">
                <FiEye />
              </div>
              <h3>OUR <span>VISION</span></h3>
              <div className="vmv-divider"><div className="vmv-dot"></div></div>
              <p>
                To make quality education accessible, engaging, and affordable for every learner, empowering the next generation to think, create, and lead confidently in an ever evolving digital world.
              </p>
            </div>

            <div className="vmv-divider-vertical"></div>

            <div className="vmv-item">
              <div className="vmv-icon">
                <FiStar />
              </div>
              <h3>OUR <span>VALUES</span></h3>
              <div className="vmv-divider"><div className="vmv-dot"></div></div>
              <p>
                We believe in innovation, integrity, and inclusivity. Our core values drive us to continuously improve our curriculum, support our learners unconditionally, and foster a diverse, thriving community of professionals.
              </p>
            </div>

          </div>

        </div>
      </section>
    </div>
  );
}
