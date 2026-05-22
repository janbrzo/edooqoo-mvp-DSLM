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

interface HomeworkNotificationEmailProps {
  studentName: string;
  teacherName: string;
  homeworkTitle: string;
  homeworkLink: string;
  deadline?: string;
  selectedExercisesCount: number;
}

export const HomeworkNotificationEmail = ({
  studentName,
  teacherName,
  homeworkTitle,
  homeworkLink,
  deadline,
  selectedExercisesCount,
}: HomeworkNotificationEmailProps) => (
  <Html>
    <Head />
    <Preview>New homework assignment from {teacherName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New Homework Assignment 📚</Heading>
        
        <Text style={text}>
          Hi <strong>{studentName}</strong>,
        </Text>
        
        <Text style={text}>
          Your teacher <strong>{teacherName}</strong> has assigned you new homework:
        </Text>
        
        <Section style={homeworkBox}>
          <Heading style={h2}>{homeworkTitle}</Heading>
          <Text style={detailText}>
            📝 Exercises: <strong>{selectedExercisesCount}</strong>
          </Text>
          {deadline && (
            <Text style={detailText}>
              ⏰ Deadline: <strong>{new Date(deadline).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}</strong>
            </Text>
          )}
        </Section>
        
        <Link
          href={homeworkLink}
          target="_blank"
          style={button}
        >
          Open Homework
        </Link>
        
        <Text style={text}>
          Click the button above to view and complete your homework assignment.
        </Text>
        
        <Text style={footer}>
          This is an automated message from your English teacher's homework management system.
          If you have any questions, please contact your teacher directly.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default HomeworkNotificationEmail;

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
  color: '#1e293b',
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

const homeworkBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
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
  backgroundColor: '#2563eb',
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
