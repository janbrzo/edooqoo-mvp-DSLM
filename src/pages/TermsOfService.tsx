import React from "react";
import StickyNav from '@/components/landing/StickyNav';

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <StickyNav isRegisteredUser={false} tokenLeft={0} user={null} />

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-gray max-w-none">
          <h1 className="text-3xl font-bold text-foreground mb-8">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">
            <strong>Last updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">1. Acceptance of Terms</h2>
            <p className="text-foreground mb-4">
              By accessing or using Edooqoo ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">2. Description of Service</h2>
            <p className="text-foreground mb-4">
              Edooqoo is a platform for English teachers that provides tools for generating worksheets, managing students, scheduling lessons, creating homework assignments, and tracking student progress. The Service includes:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>AI-powered worksheet generation</li>
              <li>Student management and progress tracking</li>
              <li>Lesson scheduling and calendar management</li>
              <li>Homework assignment and review tools</li>
              <li>Flashcard creation and spaced repetition learning</li>
              <li>Student Hub for learner access to materials</li>
              <li>Google Calendar integration</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">3. User Accounts</h2>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>You must provide accurate and complete information when creating an account</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials</li>
              <li>You are responsible for all activities that occur under your account</li>
              <li>You must notify us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">4. Acceptable Use</h2>
            <p className="text-foreground mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Use the Service for any illegal purpose or in violation of any laws</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Interfere with or disrupt the Service or its servers</li>
              <li>Upload or transmit viruses or malicious code</li>
              <li>Use the Service to generate harmful, offensive, or inappropriate content</li>
              <li>Resell or redistribute the Service without authorization</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">5. Intellectual Property</h2>
            <p className="text-foreground mb-4">
              <strong>Your Content:</strong> You retain ownership of the worksheets, student data, and other content you create using the Service. By using the Service, you grant us a limited license to process and store your content as needed to provide the Service.
            </p>
            <p className="text-foreground mb-4">
              <strong>Our Content:</strong> The Service, including its design, features, and underlying technology, is owned by Edooqoo and protected by intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">6. Payment and Subscriptions</h2>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Some features require a paid subscription or token purchase</li>
              <li>Payments are processed securely through Stripe</li>
              <li>Subscription fees are billed in advance on a recurring basis</li>
              <li>You may cancel your subscription at any time</li>
              <li>Refunds are handled on a case-by-case basis</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">7. Student Data and Privacy</h2>
            <p className="text-foreground mb-4">
              As a teacher using Edooqoo, you are responsible for:
            </p>
            <ul className="list-disc pl-6 mb-4 text-foreground">
              <li>Obtaining necessary consent from your students before entering their personal data</li>
              <li>Ensuring compliance with applicable data protection laws in your jurisdiction</li>
              <li>Using student data only for educational purposes</li>
            </ul>
            <p className="text-foreground">
              For details on how we handle data, please see our <a href="/privacy-policy" className="text-primary hover:underline">Privacy Policy</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">8. Third-Party Integrations</h2>
            <p className="text-foreground mb-4">
              The Service integrates with third-party services including Google Calendar. Your use of these integrations is subject to the respective third-party terms of service. We are not responsible for the availability or functionality of third-party services.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">9. Limitation of Liability</h2>
            <p className="text-foreground mb-4">
              To the maximum extent permitted by law, Edooqoo shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">10. Termination</h2>
            <p className="text-foreground mb-4">
              We may terminate or suspend your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service will immediately cease. You may request export of your data before account deletion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">11. Changes to Terms</h2>
            <p className="text-foreground mb-4">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the updated Terms on this page and updating the "Last updated" date. Your continued use of the Service after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-4">12. Contact Us</h2>
            <div className="bg-muted p-6 rounded-lg">
              <p className="text-foreground mb-4">
                If you have any questions about these Terms of Service, please contact us:
              </p>
              <div className="text-foreground">
                <p className="mb-2"><strong>Email:</strong> contact@edooqoo.com</p>
                <p><strong>Response Time:</strong> We aim to respond within 72 hours</p>
              </div>
            </div>
          </section>

          <div className="border-t pt-8 mt-12">
            <p className="text-muted-foreground text-sm">
              These Terms of Service are effective as of the date listed above and apply to all users of the Edooqoo platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
