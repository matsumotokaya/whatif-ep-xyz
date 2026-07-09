import { Link } from '@/components/editor/lib/router';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-0">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
      <div className="text-gray-700">{children}</div>
    </div>
  );
}

export function EnglishContent() {
  return (
    <>
      <Section title="1. Introduction">
        <p>
          IMAGINE (hereinafter &quot;the Service&quot;) prioritizes the information security of our users and implements appropriate technical and organizational measures.
        </p>
      </Section>

      <Section title="2. Data Encryption">
        <div className="space-y-3">
          <div>
            <h3 className="font-semibold mb-2">Communication Encryption</h3>
            <p className="text-gray-700">
              The Service uses TLS/SSL (HTTPS) encryption protocols for all communications.
              This protects data transmitted between your browser and the Service from eavesdropping and tampering by third parties.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Stored Data Encryption</h3>
            <p className="text-gray-700">
              User information stored in the database is protected by industry-standard encryption technology.
            </p>
          </div>
        </div>
      </Section>

      <Section title="3. Authentication and Access Control">
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Google OAuth 2.0 Authentication</strong>:
            We use secure Google account authentication and do not store passwords on the Service.
          </li>
          <li>
            <strong>Row Level Security (RLS)</strong>:
            Access control is implemented at the database level, ensuring users can only access their own data.
          </li>
          <li>
            <strong>Session Management</strong>:
            Secure session tokens prevent unauthorized access.
          </li>
        </ul>
      </Section>

      <Section title="4. Payment Information Security">
        <p className="mb-3">
          The Service uses Stripe for payment processing. Credit card information does not pass through the Service&apos;s servers and is processed directly by Stripe, which is PCI DSS (Payment Card Industry Data Security Standard) compliant.
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Credit card numbers are not stored or retained by the Service</li>
          <li>Stripe holds PCI DSS Level 1 certification, an international security standard</li>
        </ul>
      </Section>

      <Section title="5. Data Backup">
        <p className="text-gray-700">
          To prevent data loss, regular automatic backups are performed by Supabase (database and storage provider).
        </p>
      </Section>

      <Section title="6. Infrastructure Security">
        <div className="space-y-2">
          <p><strong>Services Used</strong></p>
          <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
            <li><strong>Vercel</strong>: Enterprise-grade hosting, DDoS protection, automatic SSL certificates</li>
            <li><strong>Supabase</strong>: PostgreSQL database, enterprise-level security</li>
            <li><strong>Stripe</strong>: PCI DSS compliant payment processing</li>
          </ul>
          <p className="mt-3 text-gray-700">
            All infrastructure uses trusted providers that implement industry-standard security measures.
          </p>
        </div>
      </Section>

      <Section title="7. Security Incident Response">
        <p className="mb-2">
          In the unlikely event of a security incident, we will take the following actions:
        </p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Promptly identify the cause and prevent further damage</li>
          <li>Notify affected users</li>
          <li>Report to relevant authorities as necessary</li>
          <li>Implement measures to prevent recurrence</li>
        </ul>
      </Section>

      <Section title="8. Request to Users">
        <p className="mb-2">To maintain security, please cooperate with the following:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-700">
          <li>Do not share login information with third parties</li>
          <li>Always log out after using shared devices</li>
          <li>Promptly contact us if you discover suspicious activity</li>
        </ul>
      </Section>

      <Section title="9. Contact">
        <p>
          For security-related questions or reports, please contact us via the{" "}
          <Link to="/contact" className="text-blue-600 hover:underline mx-1">
            contact page
          </Link>
          or at contact@whatif-ep.xyz.
        </p>
      </Section>
    </>
  );
}
