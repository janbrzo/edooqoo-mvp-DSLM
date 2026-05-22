
// Input validation utilities with enhanced security for edge functions

export interface SubmitFeedbackRequest {
  worksheetId: string;
  rating: number;
  comment: string;
  userId: string;
  status?: string;
}

// Security monitoring for edge functions
class EdgeSecurityMonitor {
  logSecurityEvent(type: string, details: any): void {
    console.warn(`Security Event [${type}]:`, {
      ...details,
      timestamp: new Date().toISOString()
    });
  }
}

const securityMonitor = new EdgeSecurityMonitor();

export function validateSubmitFeedbackRequest(data: any): { isValid: boolean; error?: string; validatedData?: SubmitFeedbackRequest } {
  if (!data || typeof data !== 'object') {
    securityMonitor.logSecurityEvent('validation_failed', { 
      reason: 'Invalid request body structure',
      data: typeof data 
    });
    return { isValid: false, error: 'Request body is required' };
  }

  const { worksheetId, rating, comment, userId, status } = data;

  // Validate worksheetId
  if (!worksheetId || typeof worksheetId !== 'string' || worksheetId.trim().length === 0) {
    securityMonitor.logSecurityEvent('validation_failed', { 
      reason: 'Missing or invalid worksheetId' 
    });
    return { isValid: false, error: 'Worksheet ID is required' };
  }

  // Additional worksheetId format validation
  if (worksheetId.length > 100) {
    securityMonitor.logSecurityEvent('validation_failed', { 
      reason: 'Worksheet ID too long',
      length: worksheetId.length 
    });
    return { isValid: false, error: 'Invalid worksheet ID format' };
  }

  // Validate userId
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    securityMonitor.logSecurityEvent('validation_failed', { 
      reason: 'Missing or invalid userId' 
    });
    return { isValid: false, error: 'User ID is required' };
  }

  // Additional userId format validation
  if (userId.length > 100) {
    securityMonitor.logSecurityEvent('validation_failed', { 
      reason: 'User ID too long',
      length: userId.length 
    });
    return { isValid: false, error: 'Invalid user ID format' };
  }

  // Validate rating with enhanced checks
  if (typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    securityMonitor.logSecurityEvent('validation_failed', { 
      reason: 'Invalid rating value',
      rating: rating,
      type: typeof rating 
    });
    return { isValid: false, error: 'Rating must be an integer between 1 and 5' };
  }

  // Validate comment with enhanced security checks
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      securityMonitor.logSecurityEvent('validation_failed', { 
        reason: 'Comment must be string',
        type: typeof comment 
      });
      return { isValid: false, error: 'Comment must be a string' };
    }
    
    if (comment.length > 2000) {
      securityMonitor.logSecurityEvent('validation_failed', { 
        reason: 'Comment too long',
        length: comment.length 
      });
      return { isValid: false, error: 'Comment must be less than 2000 characters' };
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /data:text\/html/gi
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(comment)) {
        securityMonitor.logSecurityEvent('malicious_input', { 
          reason: 'Suspicious pattern in comment',
          pattern: pattern.toString(),
          comment: comment.substring(0, 100) 
        });
        return { isValid: false, error: 'Comment contains invalid content' };
      }
    }
  }

  // Sanitize and validate status
  const validStatuses = ['submitted', 'pending', 'approved', 'rejected'];
  const sanitizedStatus = status && typeof status === 'string' ? status.trim().toLowerCase() : 'submitted';
  
  if (!validStatuses.includes(sanitizedStatus)) {
    securityMonitor.logSecurityEvent('validation_failed', { 
      reason: 'Invalid status value',
      status: sanitizedStatus 
    });
    return { isValid: false, error: 'Invalid status value' };
  }

  // Sanitize comment
  const sanitizedComment = comment ? sanitizeComment(String(comment).trim()) : '';

  return {
    isValid: true,
    validatedData: {
      worksheetId: worksheetId.trim(),
      rating,
      comment: sanitizedComment,
      userId: userId.trim(),
      status: sanitizedStatus
    }
  };
}

export function isValidUUID(uuid: string): boolean {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return typeof uuid === 'string' && UUID_REGEX.test(uuid);
}

function sanitizeComment(comment: string): string {
  return comment
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: URLs
    .replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;') // Escape unescaped ampersands
    .slice(0, 1000); // Ensure max length
}
