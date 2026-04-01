import { FaStar, FaStarHalfAlt, FaRegStar } from 'react-icons/fa';
import './Rating.css';

export default function Rating({ value, count, showCount = true, size = 'sm' }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    if (value >= i) stars.push(<FaStar key={i} className="star filled" />);
    else if (value >= i - 0.5) stars.push(<FaStarHalfAlt key={i} className="star filled" />);
    else stars.push(<FaRegStar key={i} className="star" />);
  }
  if (!value || value === 0) {
    return (
      <div className={`rating rating-${size} rating-new`}>
        <span className="badge badge-primary">New</span>
        {showCount && <span className="rating-count" style={{ marginLeft: 8 }}>(No reviews)</span>}
      </div>
    );
  }

  return (
    <div className={`rating rating-${size}`}>
      <span className="rating-value">{value.toFixed(1)}</span>
      <span className="stars">{stars}</span>
      {showCount && count !== undefined && <span className="rating-count">({count.toLocaleString()})</span>}
    </div>
  );
}
