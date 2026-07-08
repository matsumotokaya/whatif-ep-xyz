import { Section } from './Section';

export function EnglishContent() {
  return (
    <>
      <Section title="1. Introduction">
        <p>
          IMAGINE (the "Service") is a banner design assistant tool provided by Kaya Matsumoto (the "Operator").
          This Privacy Policy explains how we handle personal information in our Service.
        </p>
      </Section>

      <Section title="2. Information We Collect">
        <p className="mb-2">We collect the following information:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Account Information</strong>: Email address, name, and profile picture obtained via Google OAuth
          </li>
          <li>
            <strong>Payment Information</strong>: Credit card information processed through Stripe (not stored by us)
          </li>
          <li>
            <strong>Usage Information</strong>: Banner designs created, images uploaded, service usage history
          </li>
          <li>
            <strong>Technical Information</strong>: IP address, browser information, access logs
          </li>
        </ul>
      </Section>

      <Section title="3. How We Use Your Information">
        <p className="mb-2">We use collected information for the following purposes:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Providing, operating, and improving the Service</li>
          <li>User support</li>
          <li>Payment processing and subscription management</li>
          <li>Preventing fraud and ensuring security</li>
          <li>Usage analysis and statistical data creation</li>
          <li>Sending important notifications</li>
        </ul>
      </Section>

      <Section title="4. Third-Party Services">
        <p className="mb-2">Our Service uses the following third-party services:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>
            <strong>Supabase</strong>: Database, authentication, and storage (USA)
          </li>
          <li>
            <strong>Stripe</strong>: Payment processing (USA)
          </li>
          <li>
            <strong>Google</strong>: OAuth authentication (USA)
          </li>
          <li>
            <strong>Vercel</strong>: Hosting (USA)
          </li>
        </ul>
        <p className="mt-3 text-gray-700">
          These services process information according to their respective privacy policies.
          We do not share personal information with third parties without user consent, except as required by law.
        </p>
      </Section>

      <Section title="5. Data Retention">
        <p>
          Personal information is retained while your account is active. After account deletion,
          data will be promptly deleted except as required by law.
        </p>
      </Section>

      <Section title="6. Security">
        <p>
          We implement appropriate security measures to prevent unauthorized access, disclosure, alteration,
          or destruction of personal information. Data transmission is encrypted via SSL/TLS,
          and database access is strictly controlled.
        </p>
      </Section>

      <Section title="7. Your Rights">
        <p className="mb-2">You have the following rights:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Request access to your personal information</li>
          <li>Request correction or deletion of your personal information</li>
          <li>Request restriction of processing</li>
          <li>Delete your account</li>
        </ul>
        <p className="mt-3 text-gray-700">
          To exercise these rights, please contact us at contact@whatif-ep.xyz.
        </p>
      </Section>

      <Section title="8. Cookies">
        <p>
          We use cookies to improve service usability. You can disable cookies in your browser settings,
          but some features may not function properly.
        </p>
      </Section>

      <Section title="9. Children's Privacy">
        <p>
          Our Service is not intended for children under 13 years of age.
          If we discover that a child under 13 has provided personal information, we will promptly delete it.
        </p>
      </Section>

      <Section title="10. Changes to This Privacy Policy">
        <p>
          This Privacy Policy may be updated without notice due to legal changes or service improvements.
          We will notify users of significant changes via the Service or email.
        </p>
      </Section>

      <Section title="11. Contact Us">
        <p>
          For questions about this Privacy Policy, please contact:
        </p>
        <p className="mt-2 text-gray-700">
          Email: contact@whatif-ep.xyz
        </p>
      </Section>
    </>
  );
}
