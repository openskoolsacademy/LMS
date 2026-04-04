import GlobalBanner from '../components/ui/GlobalBanner';
import './LegalPage.css';

export default function HelpCenter() {
  return (
    <div className="legal-page section">
      <GlobalBanner location="Home" />
      <div className="container">
        <div className="legal-content animate-fade">
          <div className="legal-header">
            <h1>Help Center</h1>
            <p>Welcome to Open Skools Help Center</p>
          </div>
          
          <div className="legal-body">
            <h3>1. Account & Login</h3>
            <p>If you are unable to login, try resetting your password using "Forgot Password".</p>

            <h3>2. Course Access</h3>
            <p>Once you enroll in a course, you will have lifetime access unless stated otherwise.</p>

            <h3>3. Payments & Refunds</h3>
            <p>All payments are processed securely. Refunds are subject to our refund policy.</p>

            <h3>4. Certificates</h3>
            <p>Certificates can be downloaded after completing the course. If you face issues, contact support.</p>

            <h3>5. Technical Issues</h3>
            <p>For bugs or errors, please reach out with screenshots.</p>
          </div>
          
          <div className="legal-footer">
            <h4>Contact Support:</h4>
            <p>Email: <a href="mailto:contact@openskools.com">contact@openskools.com</a></p>
            <p>Response Time: 24–48 hours</p>
          </div>
        </div>
      </div>
    </div>
  );
}
