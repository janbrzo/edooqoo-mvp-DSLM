/**
 * Enhanced security utilities for input validation and sanitization
 */

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Malicious patterns to detect
const MALICIOUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
  /expression\s*\(/gi,
  /@import/gi
];

/**
 * Validates if a string is a valid UUID
 */
export function isValidUUID(uuid: string): boolean {
  return typeof uuid === 'string' && UUID_REGEX.test(uuid);
}

/**
 * Validates if a string is a valid email
 */
export function isValidEmail(email: string): boolean {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

/**
 * Enhanced sanitization with better XSS protection
 */
export function sanitizeInput(input: string, maxLength: number = 10000): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  let sanitized = input
    .trim()
    .slice(0, maxLength);
  
  // Remove malicious patterns
  MALICIOUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Additional cleanup
  sanitized = sanitized
    .replace(/[<>]/g, '') // Remove basic HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/on\w+=/gi, '') // Remove event handlers
    .replace(/data:/gi, '') // Remove data: URLs
    .replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;'); // Escape unescaped ampersands
  
  return sanitized;
}

/**
 * Enhanced prompt validation with better security checks
 */
export function validatePrompt(prompt: string): { isValid: boolean; error?: string } {
  if (!prompt || typeof prompt !== 'string') {
    return { isValid: false, error: 'Prompt is required and must be a string' };
  }
  
  const trimmedPrompt = prompt.trim();
  
  if (trimmedPrompt.length < 10) {
    return { isValid: false, error: 'Prompt must be at least 10 characters long' };
  }
  
  if (trimmedPrompt.length > 5000) {
    return { isValid: false, error: 'Prompt must be less than 5000 characters' };
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /select\s+\*\s+from/gi,
    /drop\s+table/gi,
    /delete\s+from/gi,
    /insert\s+into/gi,
    /update\s+set/gi,
    /<script/gi,
    /javascript:/gi
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmedPrompt)) {
      console.warn('Suspicious pattern detected in prompt:', pattern);
      return { isValid: false, error: 'Prompt contains potentially harmful content' };
    }
  }
  
  return { isValid: true };
}

/**
 * Validates rating input
 */
export function validateRating(rating: number): { isValid: boolean; error?: string } {
  if (typeof rating !== 'number' || isNaN(rating)) {
    return { isValid: false, error: 'Rating must be a number' };
  }
  
  if (rating < 1 || rating > 5) {
    return { isValid: false, error: 'Rating must be between 1 and 5' };
  }
  
  if (!Number.isInteger(rating)) {
    return { isValid: false, error: 'Rating must be a whole number' };
  }
  
  return { isValid: true };
}

/**
 * Enhanced comment validation
 */
export function validateComment(comment: string): { isValid: boolean; error?: string } {
  if (typeof comment !== 'string') {
    return { isValid: false, error: 'Comment must be a string' };
  }
  
  if (comment.length > 2000) {
    return { isValid: false, error: 'Comment must be less than 2000 characters' };
  }
  
  // Check for suspicious patterns in comments
  const suspiciousPatterns = [
    /<script/gi,
    /javascript:/gi,
    /on\w+=/gi
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(comment)) {
      console.warn('Suspicious pattern detected in comment:', pattern);
      return { isValid: false, error: 'Comment contains potentially harmful content' };
    }
  }
  
  return { isValid: true };
}

/**
 * Generates a cryptographically secure session token
 */
export function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const timestamp = Date.now().toString(36);
  const randomHex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `ds_${timestamp}_${randomHex}`;
}

/**
 * Enhanced rate limiting with better tracking
 */
class RateLimiter {
  private requests: Map<string, { count: number; times: number[]; blocked: boolean }> = new Map();
  private readonly cleanupInterval: number;
  
  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000) as unknown as number;
  }
  
  isAllowed(key: string, maxRequests: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const entry = this.requests.get(key) || { count: 0, times: [], blocked: false };
    
    // Remove old requests outside the window
    entry.times = entry.times.filter(time => now - time < windowMs);
    entry.count = entry.times.length;
    
    // Check if currently blocked
    if (entry.blocked && entry.times.length > 0) {
      const oldestRequest = Math.min(...entry.times);
      if (now - oldestRequest < windowMs * 2) { // Extended block period
        return false;
      } else {
        entry.blocked = false; // Unblock after extended period
      }
    }
    
    if (entry.count >= maxRequests) {
      entry.blocked = true;
      this.requests.set(key, entry);
      console.warn(`Rate limit exceeded for key: ${key}`);
      return false;
    }
    
    // Add current request
    entry.times.push(now);
    entry.count = entry.times.length;
    this.requests.set(key, entry);
    
    return true;
  }
  
  cleanup(): void {
    const now = Date.now();
    const windowMs = 600000; // 10 minutes
    
    for (const [key, entry] of this.requests.entries()) {
      entry.times = entry.times.filter(time => now - time < windowMs);
      if (entry.times.length === 0 && !entry.blocked) {
        this.requests.delete(key);
      } else {
        entry.count = entry.times.length;
        this.requests.set(key, entry);
      }
    }
  }
  
  getStats(): { totalKeys: number; blockedKeys: number } {
    const blockedKeys = Array.from(this.requests.values()).filter(entry => entry.blocked).length;
    return {
      totalKeys: this.requests.size,
      blockedKeys
    };
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Security monitoring and logging
 */
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private events: Array<{ timestamp: number; type: string; details: any }> = [];
  
  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }
  
  logSecurityEvent(type: 'rate_limit_exceeded' | 'malicious_input' | 'suspicious_access' | 'validation_failed', details: any): void {
    const event = {
      timestamp: Date.now(),
      type,
      details: {
        ...details,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        timestamp: new Date().toISOString()
      }
    };
    
    this.events.push(event);
    
    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
    
    // Log to console for monitoring
    console.warn(`Security Event [${type}]:`, event.details);
    
    // In production, you might want to send this to a monitoring service
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // This could be sent to a monitoring service like Sentry, LogRocket, etc.
      this.sendToMonitoringService(event);
    }
  }
  
  private sendToMonitoringService(event: any): void {
    // Placeholder for monitoring service integration
    // Could integrate with Sentry, LogRocket, or custom monitoring
    try {
      fetch('/api/security-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      }).catch(err => console.warn('Failed to send security event:', err));
    } catch (error) {
      console.warn('Monitoring service unavailable:', error);
    }
  }
  
  getRecentEvents(limit: number = 100): Array<{ timestamp: number; type: string; details: any }> {
    return this.events.slice(-limit);
  }
  
  getEventsSummary(): { [key: string]: number } {
    const summary: { [key: string]: number } = {};
    this.events.forEach(event => {
      summary[event.type] = (summary[event.type] || 0) + 1;
    });
    return summary;
  }
}

export const securityMonitor = SecurityMonitor.getInstance();

/**
 * Enhanced validation for form data
 */
export function validateWorksheetFormData(data: any): { isValid: boolean; error?: string; sanitizedData?: any } {
  if (!data || typeof data !== 'object') {
    securityMonitor.logSecurityEvent('validation_failed', { reason: 'Invalid form data structure' });
    return { isValid: false, error: 'Invalid form data' };
  }
  
  const { lessonTopic, lessonGoal, teachingPreferences, additionalInformation, englishLevel, lessonTime } = data;
  
  // Validate required fields
  if (!lessonTopic || typeof lessonTopic !== 'string' || lessonTopic.trim().length < 3) {
    return { isValid: false, error: 'Lesson topic must be at least 3 characters long' };
  }
  
  if (!lessonGoal || typeof lessonGoal !== 'string' || lessonGoal.trim().length < 5) {
    return { isValid: false, error: 'Lesson goal must be at least 5 characters long' };
  }
  
  // Sanitize all string fields
  const sanitizedData = {
    lessonTopic: sanitizeInput(lessonTopic, 200),
    lessonGoal: sanitizeInput(lessonGoal, 500),
    teachingPreferences: teachingPreferences ? sanitizeInput(teachingPreferences, 1000) : null,
    additionalInformation: additionalInformation ? sanitizeInput(additionalInformation, 1000) : null,
    englishLevel: englishLevel ? sanitizeInput(englishLevel, 50) : null,
    lessonTime: lessonTime ? sanitizeInput(lessonTime, 20) : null
  };
  
  return { isValid: true, sanitizedData };
}

/**
 * IP address validation and sanitization
 */
export function sanitizeIPAddress(ip: string): string {
  if (!ip || typeof ip !== 'string') {
    return 'unknown';
  }
  
  // Basic IPv4 and IPv6 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  const cleanIP = ip.trim().split(',')[0]; // Take first IP if comma-separated
  
  if (ipv4Regex.test(cleanIP) || ipv6Regex.test(cleanIP)) {
    return cleanIP;
  }
  
  return 'invalid';
}
