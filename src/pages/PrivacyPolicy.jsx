import GlobalBanner from '../components/ui/GlobalBanner';
import './LegalPage.css';

export default function PrivacyPolicy() {
  return (
    <div className="legal-page section">
      <GlobalBanner location="Home" />
      <div className="container">
        <div className="legal-content animate-fade">
          <div className="legal-header">
            <h1>Privacy Policy</h1>
            <p>We value your privacy at Open Skools.</p>
          </div>
          
          <div className="legal-body">
            <h3>1. Information We Collect</h3>
            <ul>
              <li>Name</li>
              <li>Email address</li>
              <li>Payment details (processed securely via third-party providers)</li>
            </ul>

            <h3>2. How We Use Data</h3>
            <ul>
              <li>To provide course access</li>
              <li>To improve user experience</li>
              <li>To send updates</li>
            </ul>

            <h3>3. Data Protection</h3>
            <p>We use industry-standard security measures.</p>

            <h3>4. Third-Party Services</h3>
            <p>We may use tools like analytics and payment gateways.</p>

            <h3>5. Cookies</h3>
            <p>We use cookies to enhance user experience.</p>
            
            <h3>6. Your Rights</h3>
            <p>You can request to delete your account and data anytime.</p>
          </div>
          
          <div className="legal-footer">
            <p>📩 <strong>Contact:</strong> <a href="mailto:contact@openskools.com">contact@openskools.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
