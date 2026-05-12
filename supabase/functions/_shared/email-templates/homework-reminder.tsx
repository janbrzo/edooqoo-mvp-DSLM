import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22';
import * as React from 'npm:react@18.3.1';

interface HomeworkReminderEmailProps {
  studentName: string;
  teacherName: string;
  homeworkTitle: string;
  homeworkLink: string;
  deadline: string;
  daysUntilDeadline: number;
}

export const HomeworkReminderEmail = ({
  studentName,
  teacherName,
  homeworkTitle,
  homeworkLink,
  deadline,
  daysUntilDeadline,
}: HomeworkReminderEmailProps) => {
  const isOverdue = daysUntilDeadline < 0;
  const urgencyLevel = daysUntilDeadline <= 1 ? 'high' : 'medium';
  
  return (
    <Html>
      <Head />
      <Preview>
        {isOverdue 
          ? `Overdue: ${homeworkTitle}` 
          : `Reminder: ${homeworkTitle} due in ${daysUntilDeadline} day${daysUntilDeadline !== 1 ? 's' : ''}`
        }
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isOverdue ? '⚠️ Overdue Homework' : '⏰ Homework Reminder'}
          </Heading>
          
          <Text style={text}>
            Hi <strong>{studentName}</strong>,
          </Text>
          
          <Text style={text}>
            {isOverdue ? (
              <>
                Your homework assignment <strong>"{homeworkTitle}"</strong> from {teacherName} was due on{' '}
                <strong>{new Date(deadline).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}</strong>.
              </>
            ) : (
              <>
                This is a reminder about your homework assignment <strong>"{homeworkTitle}"</strong> from {teacherName}.
              </>
            )}
          </Text>
          
          <div style={urgencyLevel === 'high' ? urgentBox : reminderBox}>
            <Heading style={h2}>{homeworkTitle}</Heading>
            <Text style={deadlineText}>
              {isOverdue ? (
                <>❌ Was due: <strong>{new Date(deadline).toLocaleDateString('en-US')}</strong></>
              ) : (
                <>📅 Due: <strong>{new Date(deadline).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}</strong></>
              )}
            </Text>
            {!isOverdue && daysUntilDeadline <= 2 && (
              <Text style={urgentText}>
                ⚡ {daysUntilDeadline === 0 ? 'Due today!' : daysUntilDeadline === 1 ? 'Only 1 day left!' : `Only ${daysUntilDeadline} days left!`}
              </Text>
            )}
          </div>
          
          <Link
            href={homeworkLink}
            target="_blank"
            style={isOverdue ? urgentButton : button}
          >
            {isOverdue ? 'Complete Now' : 'View Homework'}
          </Link>
          
          <Text style={text}>
            {isOverdue 
              ? "Please complete this homework as soon as possible and contact your teacher if you need help."
              : "Don't forget to complete your homework before the deadline!"
            }
          </Text>
          
          <Text style={footer}>
            This is an automated reminder from your English teacher's homework management system.
            If you have any questions, please contact {teacherName} directly.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default HomeworkReminderEmail;

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

const deadlineText = {
  color: '#64748b',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '8px 0',
};

const urgentText = {
  color: '#dc2626',
  fontSize: '16px',
  fontWeight: '600',
  margin: '12px 0 0',
};

const reminderBox = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 40px',
};

const urgentBox = {
  backgroundColor: '#fef2f2',
  border: '2px solid #fca5a5',
  borderRadius: '8px',
  padding: '24px',
  margin: '24px 40px',
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

const urgentButton = {
  ...button,
  backgroundColor: '#dc2626',
};

const footer = {
  color: '#898989',
  fontSize: '13px',
  lineHeight: '20px',
  marginTop: '32px',
  padding: '0 40px',
};
