
import { isValidUUID } from './security.ts';

export interface PaymentRequest {
  worksheetId: string;
  userId: string;
  successUrl?: string;
  cancelUrl?: string;
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

export function validatePaymentRequest(request: PaymentRequest): { valid: boolean; error?: string } {
  const { worksheetId, userId, successUrl, cancelUrl } = request;

  // Enhanced null/undefined checks
  if (!worksheetId || !userId) {
    securityMonitor.logSecurityEvent('validation_failed', {
      reason: 'Missing required payment parameters',
      hasWorksheetId: !!worksheetId,
      hasUserId: !!userId
    });
    return { 
      valid: false, 
      error: 'Missing required parameters: worksheetId and userId are required' 
    };
  }

  // Enhanced type validation
  if (typeof worksheetId !== 'string' || typeof userId !== 'string') {
    securityMonitor.logSecurityEvent('validation_failed', {
      reason: 'Invalid parameter types',
      worksheetIdType: typeof worksheetId,
      userIdType: typeof userId
    });
    return {
      valid: false,
      error: 'WorksheetId and userId must be strings'
    };
  }

  // Length validation
  if (worksheetId.length > 100 || userId.length > 100) {
    securityMonitor.logSecurityEvent('validation_failed', {
      reason: 'Parameter length exceeded',
      worksheetIdLength: worksheetId.length,
      userIdLength: userId.length
    });
    return {
      valid: false,
      error: 'Parameter values are too long'
    };
  }

  // Validate worksheetId as UUID only if it looks like a UUID (longer than 10 chars)
  if (worksheetId.length > 10 && !isValidUUID(worksheetId)) {
    securityMonitor.logSecurityEvent('validation_failed', {
      reason: 'Invalid worksheet ID format',
      worksheetIdLength: worksheetId.length
    });
    return { 
      valid: false, 
      error: 'Invalid worksheet ID format provided' 
    };
  }

  // Enhanced URL validation
  if (successUrl) {
    if (typeof successUrl !== 'string') {
      return { valid: false, error: 'Success URL must be a string' };
    }
    if (!isValidURL(successUrl)) {
      securityMonitor.logSecurityEvent('validation_failed', {
        reason: 'Invalid success URL format',
        url: successUrl.substring(0, 100) // Log first 100 chars only
      });
      return { 
        valid: false, 
        error: 'Invalid success URL provided' 
      };
    }
  }

  if (cancelUrl) {
    if (typeof cancelUrl !== 'string') {
      return { valid: false, error: 'Cancel URL must be a string' };
    }
    if (!isValidURL(cancelUrl)) {
      securityMonitor.logSecurityEvent('validation_failed', {
        reason: 'Invalid cancel URL format',
        url: cancelUrl.substring(0, 100) // Log first 100 chars only
      });
      return { 
        valid: false, 
        error: 'Invalid cancel URL provided' 
      };
    }
  }

  return { valid: true };
}

function isValidURL(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Length check
  if (url.length > 2048) {
    return false;
  }

  try {
    const urlObj = new URL(url);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return false;
    }
    
    // Basic hostname validation
    if (!urlObj.hostname || urlObj.hostname.length < 1) {
      return false;
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /javascript:/gi,
      /data:/gi,
      /vbscript:/gi,
      /@/g // @ symbol in URL can be suspicious
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url)) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}
