import { Link, useNavigate } from 'react-router-dom';
import { FiClock, FiBookOpen } from 'react-icons/fi';
import Rating from './Rating';
import './CourseCard.css';

export default function CourseCard({ course }) {
  const currentPrice = course.offer_price || course.price || 0;
  const originalPrice = course.regular_price || course.originalPrice || 0;
  
  const hasDiscount = originalPrice > currentPrice && currentPrice > 0;
  const discount = hasDiscount
    ? Math.round((1 - currentPrice / originalPrice) * 100)
    : 0;

  const navigate = useNavigate();

  const handleInstructorClick = (e) => {
    if (course.instructorId) {
      e.preventDefault();
      e.stopPropagation();
      navigate(`/instructor/profile/${course.instructorId}`);
    }
  };

  return (
    <Link to={`/courses/${course.id}`} className="course-card">
      <div className="course-card__img">
        <img src={course.thumbnail} alt={course.title} loading="lazy" />
        {course.bestseller && <span className="course-card__badge">Bestseller</span>}
        {hasDiscount && <span className="course-card__discount">{discount}% OFF</span>}
      </div>
      <div className="course-card__body">
        <span className="course-card__category">{course.category}</span>
        <h4 className="course-card__title">{course.title}</h4>
        <p className="course-card__instructor" onClick={handleInstructorClick}>{course.instructor}</p>
        <Rating value={course.rating} count={course.reviewsCount} />
        <div className="course-card__meta">
          {course.duration && <span><FiClock /> {course.duration}</span>}
          {course.lessons > 0 && <span><FiBookOpen /> {course.lessons} lessons</span>}
        </div>
        <div className="course-card__footer">
          <div className="course-card__price">
            <span className="price-current">₹{currentPrice.toLocaleString()}</span>
            {hasDiscount && (
              <span className="price-original">₹{originalPrice.toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
