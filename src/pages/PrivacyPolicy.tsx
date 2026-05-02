
import React from "react";
import StickyNav from '@/components/landing/StickyNav';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <StickyNav isRegisteredUser={false} tokenLeft={0} user={null} />

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold text-foreground mb-8">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">
            <strong>Last updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-foreground mb-4">
              Welcome to Edooqoo ("we," "our," or "us"). We are committed to protecting your privacy and handling your personal information responsibly. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our worksheet generation platform for English teachers.
            </p>
            <p className="text-foreground">
              By using Edooqoo, you agree to the collection and use of information in accordance with this Privacy Policy.
            </p>
          </section>

          {/* Contact Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Data Controller</h2>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-foreground mb-2"><strong>Company:</strong> Edooqoo</p>
              <p className="text-foreground mb-2"><strong>Contact:</strong> contact@edooqoo.com</p>
              <p className="text-foreground">
                For any privacy-related questions or requests, please contact us at the above email address.
              </p>
            </div>
          </section>

          {/* Information We Collect */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. Information We Collect</h2>
            
            <h3 className="text-xl font-medium text-foreground mb-3">3.1 Account Information</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Email address and password (for account creation)</li>
              <li>First name and last name</li>
              <li>Profile information (teaching experience, preferences)</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mb-3">3.2 Student Information</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Student names (first names only, as provided by you)</li>
              <li>English proficiency levels</li>
              <li>Learning goals and preferences</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mb-3">3.3 Worksheet Data</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Generated worksheets and educational content</li>
              <li>Worksheet parameters and preferences</li>
              <li>Rating and feedback data</li>
              <li>Usage history and generation timestamps</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mb-3">3.4 Payment Information</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Billing information (processed securely through Stripe)</li>
              <li>Subscription status and token usage</li>
              <li>Payment history and transaction records</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mb-3">3.5 Technical Information</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>IP address and geolocation data</li>
              <li>Browser type and device information</li>
              <li>Usage analytics and performance metrics</li>
              <li>Session data and authentication tokens</li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. How We Use Your Information</h2>
            
            <h3 className="text-xl font-medium text-foreground mb-3">4.1 Service Provision</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Generate personalized English worksheets</li>
              <li>Manage your account and student profiles</li>
              <li>Process payments and manage subscriptions</li>
              <li>Provide customer support</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mb-3">4.2 Legal Bases (GDPR)</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li><strong>Contract Performance:</strong> Processing necessary to provide our services</li>
              <li><strong>Legitimate Interest:</strong> Improving our services and preventing fraud</li>
              <li><strong>Consent:</strong> Marketing communications (where applicable)</li>
              <li><strong>Legal Obligation:</strong> Compliance with tax and financial regulations</li>
            </ul>
          </section>

          {/* Information Sharing */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Information Sharing</h2>
            
            <h3 className="text-xl font-medium text-foreground mb-3">5.1 Third-Party Service Providers</h3>
            <div className="bg-muted p-4 rounded-lg mb-4">
              <ul className="list-disc pl-6 text-foreground">
                <li><strong>Supabase:</strong> Database hosting and authentication (EU/US)</li>
                <li><strong>Stripe:</strong> Payment processing (global, GDPR compliant)</li>
                <li><strong>Google:</strong> OAuth authentication (global, GDPR compliant)</li>
                <li><strong>OpenAI:</strong> AI worksheet generation (US, privacy-focused)</li>
              </ul>
            </div>

            <h3 className="text-xl font-medium text-foreground mb-3">5.2 We Do NOT Share</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Personal information with advertisers</li>
              <li>Student data with third parties</li>
              <li>Worksheet content with competitors</li>
              <li>Data for marketing purposes without consent</li>
            </ul>
          </section>

          {/* Data Security */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Data Security</h2>
            <div className="bg-muted p-4 rounded-lg">
              <ul className="list-disc pl-6 text-foreground">
                <li>End-to-end encryption for data transmission</li>
                <li>Secure authentication with bcrypt password hashing</li>
                <li>Row-level security (RLS) in our database</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and monitoring</li>
                <li>GDPR-compliant data processing agreements</li>
              </ul>
            </div>
          </section>

          {/* Your Rights */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Your Rights</h2>
            
            <h3 className="text-xl font-medium text-foreground mb-3">7.1 GDPR Rights (EU Users)</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Correct inaccurate information</li>
              <li><strong>Erasure:</strong> Request deletion of your data</li>
              <li><strong>Portability:</strong> Export your data in a readable format</li>
              <li><strong>Restriction:</strong> Limit processing of your data</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interest</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mb-3">7.2 CCPA Rights (California Users)</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Right to know what personal information is collected</li>
              <li>Right to delete personal information</li>
              <li>Right to opt-out of sale (we don't sell data)</li>
              <li>Right to non-discrimination</li>
            </ul>

            <div className="bg-muted p-4 rounded-lg mt-4">
              <p className="text-foreground">
                <strong>To exercise your rights:</strong> Contact us at contact@edooqoo.com or use the account settings in your profile.
              </p>
            </div>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Data Retention</h2>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li><strong>Account Data:</strong> Retained while your account is active</li>
              <li><strong>Worksheets:</strong> Stored for your access until account deletion</li>
              <li><strong>Payment Records:</strong> 7 years for tax compliance</li>
              <li><strong>Analytics Data:</strong> Anonymized after 24 months</li>
              <li><strong>Backup Data:</strong> Automatically deleted after 30 days</li>
            </ul>
          </section>

          {/* Cookies */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Cookies and Tracking</h2>
            
            <h3 className="text-xl font-medium text-foreground mb-3">9.1 Essential Cookies</h3>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Authentication and session management</li>
              <li>Security and fraud prevention</li>
              <li>Basic functionality and preferences</li>
            </ul>

            <h3 className="text-xl font-medium text-foreground mb-3">9.2 Analytics</h3>
            <p className="text-foreground mb-4">
              We use privacy-focused analytics to understand how users interact with our platform. This helps us improve the service quality and user experience.
            </p>
          </section>

          {/* International Transfers */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. International Data Transfers</h2>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-foreground mb-2">
                Your data may be transferred to and processed in countries outside your residence, including the United States. We ensure adequate protection through:
              </p>
              <ul className="list-disc pl-6 text-foreground">
                <li>Standard Contractual Clauses (SCCs) with service providers</li>
                <li>Adequacy decisions by the European Commission</li>
                <li>Appropriate safeguards as required by GDPR</li>
              </ul>
            </div>
          </section>

          {/* Children's Privacy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">11. Children's Privacy</h2>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <p className="text-foreground">
                Edooqoo is designed for use by English teachers (adults). We do not knowingly collect personal information from children under 13/16. If you believe a child has provided us with personal information, please contact us immediately.
              </p>
            </div>
          </section>

          {/* Changes to Policy */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">12. Changes to This Privacy Policy</h2>
            <p className="text-foreground mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any changes by:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Posting the new Privacy Policy on this page</li>
              <li>Updating the "Last updated" date</li>
              <li>Sending email notifications for material changes</li>
            </ul>
          </section>

          {/* Contact Us */}
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">13. Contact Us</h2>
            <div className="bg-muted p-6 rounded-lg">
              <p className="text-foreground mb-4">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="text-foreground">
                <p className="mb-2"><strong>Email:</strong> contact@edooqoo.com</p>
                <p className="mb-2"><strong>Subject Line:</strong> Privacy Policy Inquiry</p>
                <p><strong>Response Time:</strong> We aim to respond within 72 hours</p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="border-t pt-8 mt-12">
            <p className="text-muted-foreground text-sm">
              This Privacy Policy is effective as of the date listed above and applies to all users of the Edooqoo platform. 
              Your continued use of our services after any changes indicates your acceptance of the updated Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
