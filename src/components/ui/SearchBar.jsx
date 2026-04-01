import { FiSearch } from 'react-icons/fi';
import './SearchBar.css';

export default function SearchBar({ value, onChange, placeholder = 'Search courses...', onSubmit }) {
  const handleSubmit = (e) => { e.preventDefault(); onSubmit && onSubmit(value); };
  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <FiSearch className="search-icon" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </form>
  );
}
