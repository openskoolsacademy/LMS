import GlobalBanner from '../components/ui/GlobalBanner';
import './LegalPage.css';

export default function TermsOfService() {
  return (
    <div className="legal-page section">
      <GlobalBanner location="Home" />
      <div className="container">
        <div className="legal-content animate-fade">
          <div className="legal-header">
            <h1>Terms of Service</h1>
            <p>By accessing Open Skools, you agree to the following terms:</p>
          </div>
          
          <div className="legal-body">
            <h3>1. Use of Platform</h3>
            <p>You agree to use the platform only for lawful purposes.</p>

            <h3>2. User Accounts</h3>
            <p>You are responsible for maintaining the confidentiality of your account.</p>

            <h3>3. Course Access</h3>
            <p>Courses are for personal use only and should not be shared, copied, or redistributed.</p>

            <h3>4. Payments</h3>
            <p>All purchases are final unless otherwise stated.</p>

            <h3>5. Intellectual Property</h3>
            <p>All content belongs to Open Skools and cannot be reused without permission.</p>
            
            <h3>6. Termination</h3>
            <p>We reserve the right to suspend accounts that violate our policies.</p>
            
            <h3>7. Changes</h3>
            <p>We may update these terms at any time.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
