// ============================================
// FAZA 8: Email Template for Worksheet Notifications
// ============================================

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface WorksheetNotificationEmailProps {
  studentName: string;
  teacherName: string;
  worksheetTitle: string;
  worksheetLink: string;
}

export const WorksheetNotificationEmail = ({
  studentName,
  teacherName,
  worksheetTitle,
  worksheetLink,
}: WorksheetNotificationEmailProps) => (
  <Html>
    <Head />
    <Preview>Your teacher shared a worksheet with you</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Worksheet Shared 📝</Heading>
        
        <Text style={text}>
          Hi <strong>{studentName}</strong>,
        </Text>
        
        <Text style={text}>
          Your teacher <strong>{teacherName}</strong> has shared a worksheet with you:
        </Text>
        
        <Section style={worksheetBox}>
          <Heading style={h2}>{worksheetTitle}</Heading>
          <Text style={detailText}>
            📚 Interactive English practice worksheet
          </Text>
          <Text style={detailText}>
            ✏️ Fill in your answers during the lesson
          </Text>
        </Section>
        
        <Link
          href={worksheetLink}
          target="_blank"
          style={button}
        >
          Open Worksheet
        </Link>
        
        <Text style={text}>
          Click the button above to view the worksheet. You'll need to verify your email to start studying.
        </Text>
        
        <Text style={footer}>
          This is an automated message from edooqoo.com - English teaching worksheets made easy.
          If you have any questions, please contact your teacher directly.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WorksheetNotificationEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const h1 = {
  color: '#333',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0 40px',
};

const h2 = {
  color: '#7c3aed', // worksheet-purple
  fontSize: '22px',
  fontWeight: '600',
  margin: '0 0 12px',
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
  padding: '0 40px',
};

const detailText = {
  color: '#64748b',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '8px 0',
};

const worksheetBox = {
  backgroundColor: '#faf5ff', // Light purple background
  border: '1px solid #e9d5ff',
  borderRadius: '8px',
  padding: '24px',
  marginTop: '24px',
  marginBottom: '24px',
  marginLeft: '40px',
  marginRight: '40px',
  maxWidth: 'calc(100% - 80px)', // PROBLEM 4 FIX: Prevent box from overflowing
  boxSizing: 'border-box' as const,
};

const button = {
  backgroundColor: '#7c3aed', // worksheet-purple
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '14px 20px',
  margin: '24px 40px',
};

const footer = {
  color: '#898989',
  fontSize: '13px',
  lineHeight: '20px',
  marginTop: '32px',
  padding: '0 40px',
};
