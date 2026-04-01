import { FaWhatsapp } from 'react-icons/fa';
import './WhatsAppCTA.css';

const WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029VbBZBrJH5JM19ZwBuR2U';

export default function WhatsAppCTA() {
  return (
    <div className="whatsapp-cta">
      <div className="whatsapp-cta__content">
        <h3>Join Our WhatsApp Channel</h3>
        <p>Get instant job alerts, course updates & exclusive offers directly on WhatsApp!</p>
      </div>
      <a
        href={WHATSAPP_CHANNEL}
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-cta__btn"
      >
        <FaWhatsapp />
        Join Channel
      </a>
    </div>
  );
}
