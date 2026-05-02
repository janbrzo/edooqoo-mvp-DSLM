
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cookie } from 'lucide-react';
import StickyNav from '@/components/landing/StickyNav';

const CookiePolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <StickyNav isRegisteredUser={false} tokenLeft={0} user={null} />
      <div className="max-w-4xl mx-auto p-4">

        <Card>
          <CardHeader className="text-center border-b">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Cookie className="h-8 w-8 text-primary" />
              <CardTitle className="text-3xl">Cookie Policy</CardTitle>
            </div>
            <p className="text-muted-foreground">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </CardHeader>
          
          <CardContent className="prose prose-slate dark:prose-invert max-w-none p-8">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">What Are Cookies?</h2>
              <p className="mb-4 text-muted-foreground">
                Cookies are small text files that are placed on your computer or mobile device when you visit a website. 
                They help websites remember information about your visit, which can make it easier to visit the site again 
                and make the site more useful to you.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">How We Use Cookies</h2>
              <p className="mb-4 text-muted-foreground">
                Edooqoo ("we", "our", or "us") uses cookies and similar tracking technologies to provide, protect, 
                and improve our services. This Cookie Policy explains what cookies are, how we use them, and your 
                choices regarding their use.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Types of Cookies We Use</h2>
              
              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-100">Essential Cookies</h3>
                  <p className="text-blue-800 dark:text-blue-200 text-sm">
                    These cookies are necessary for the website to function and cannot be switched off. They are usually 
                    set in response to actions you take, such as logging in or filling in forms. These include:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-blue-800 dark:text-blue-200 text-sm">
                    <li>Authentication tokens (Supabase session cookies)</li>
                    <li>Security cookies for login state</li>
                    <li>Cookie consent preferences</li>
                    <li>Application functionality cookies</li>
                  </ul>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                  <h3 className="text-lg font-semibold mb-2 text-green-900 dark:text-green-100">Functional Cookies</h3>
                  <p className="text-green-800 dark:text-green-200 text-sm">
                    These cookies enable enhanced functionality and personalization, such as:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-green-800 dark:text-green-200 text-sm">
                    <li>User preference settings</li>
                    <li>Language preferences</li>
                    <li>Theme preferences (dark/light mode)</li>
                    <li>Worksheet generation history</li>
                  </ul>
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border border-orange-200 dark:border-orange-800">
                  <h3 className="text-lg font-semibold mb-2 text-orange-900 dark:text-orange-100">Analytics Cookies</h3>
                  <p className="text-orange-800 dark:text-orange-200 text-sm">
                    These cookies help us understand how visitors interact with our website:
                  </p>
                  <ul className="list-disc list-inside mt-2 text-orange-800 dark:text-orange-200 text-sm">
                    <li>Usage analytics and performance monitoring</li>
                    <li>Feature usage statistics</li>
                    <li>Error tracking and debugging</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Third-Party Cookies</h2>
              <p className="mb-4 text-muted-foreground">
                We may also use third-party services that place cookies on your device:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li><strong>Google Services:</strong> For authentication (Google OAuth) and analytics</li>
                <li><strong>Stripe:</strong> For payment processing and subscription management</li>
                <li><strong>Supabase:</strong> For authentication and data storage</li>
                <li><strong>OpenAI:</strong> For AI-powered worksheet generation</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Managing Your Cookie Preferences</h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Browser Settings</h3>
                  <p className="text-muted-foreground mb-2">
                    Most web browsers allow you to control cookies through their settings:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                    <li>Block all cookies</li>
                    <li>Block third-party cookies</li>
                    <li>Delete cookies when you close your browser</li>
                    <li>Set exceptions for trusted websites</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <h3 className="text-lg font-semibold mb-2 text-yellow-900 dark:text-yellow-100">Important Note</h3>
                  <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                    Disabling essential cookies may prevent you from accessing certain features of our website, 
                    including logging in, generating worksheets, and managing your account.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Cookie Retention</h2>
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  <strong>Session Cookies:</strong> Deleted when you close your browser
                </p>
                <p className="text-muted-foreground">
                  <strong>Persistent Cookies:</strong> Remain on your device for a set period or until manually deleted
                </p>
                <p className="text-muted-foreground">
                  <strong>Authentication Cookies:</strong> Typically expire after 30 days of inactivity
                </p>
                <p className="text-muted-foreground">
                  <strong>Preference Cookies:</strong> May persist for up to 1 year to remember your settings
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Your Rights</h2>
              <p className="mb-4 text-muted-foreground">
                Under applicable privacy laws (including GDPR and ePrivacy Directive), you have the right to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Know what cookies are being used</li>
                <li>Refuse consent for non-essential cookies</li>
                <li>Withdraw consent at any time</li>
                <li>Delete cookies from your device</li>
                <li>Object to certain processing activities</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Updates to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Cookie Policy from time to time to reflect changes in our practices, 
                technology, legal requirements, or other factors. We will post the updated policy on this page 
                and update the "Last updated" date at the top.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Cookie Policy or our use of cookies, please contact us:
              </p>
              <div className="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border">
                <p className="text-sm">
                  <strong>Email:</strong> contact@edooqoo.com<br />
                  <strong>Website:</strong> https://edooqoo.com<br />
                </p>
              </div>
            </section>

            <div className="border-t pt-6">
              <p className="text-sm text-muted-foreground text-center">
                This Cookie Policy is part of our broader{' '}
                <Link to="/privacy-policy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
                . Please review both documents to understand how we handle your personal information.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CookiePolicy;
