import { useState, useEffect, useRef } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import './LogoCarousel.css';

const baseLogos = [
  { src: '/msme.png', alt: 'MSME Govt of India' },
  { src: '/ukaf.png', alt: 'UKAF Accreditation' },
  { src: '/iso.png', alt: 'ISO 9001:2015 Certified' },
  { src: '/ncs.png', alt: 'National Career Service' },
];

export default function LogoCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [itemsPerView, setItemsPerView] = useState(4);
  const trackRef = useRef(null);

  // Duplicate for infinite illusion
  const logos = [...baseLogos, ...baseLogos, ...baseLogos];

  // Detect items per view based on window size
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width <= 480) setItemsPerView(1);
      else if (width <= 768) setItemsPerView(2);
      else if (width <= 1024) setItemsPerView(3);
      else setItemsPerView(4);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 3500);
    return () => clearInterval(timer);
  }, [currentIndex]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % baseLogos.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + baseLogos.length) % baseLogos.length);
  };

  const handleDotClick = (idx) => {
    setCurrentIndex(idx);
  };

  const slideWidth = 100 / itemsPerView;

  return (
    <div className="logo-slider-container">
      <div className="logo-slider-main">
        <button className="slider-btn prev-btn" onClick={handlePrev} aria-label="Previous">
          <FiChevronLeft />
        </button>
        
        <div className="slider-viewport">
          <div 
            className="slider-track"
            ref={trackRef}
            style={{ 
              transform: `translateX(-${(currentIndex + baseLogos.length) * slideWidth}%)`,
              transition: 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            }}
          >
            {logos.map((logo, idx) => (
              <div key={`${logo.alt}-${idx}`} className="slider-slide">
                <img src={logo.src} alt={logo.alt} />
              </div>
            ))}
          </div>
        </div>

        <button className="slider-btn next-btn" onClick={handleNext} aria-label="Next">
          <FiChevronRight />
        </button>
      </div>

      <div className="slider-dots">
        {baseLogos.map((_, idx) => (
          <button 
            key={idx} 
            className={`slider-dot ${idx === currentIndex ? 'active' : ''}`}
            onClick={() => handleDotClick(idx)}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
