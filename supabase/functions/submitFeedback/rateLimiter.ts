
// Enhanced rate limiting functionality with better monitoring for edge functions

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

export class RateLimiter {
  private requests: Map<string, { 
    count: number; 
    times: number[]; 
    blocked: boolean; 
    firstAttempt: number;
    suspiciousActivity: boolean;
  }> = new Map();
  
  isAllowed(
    key: string, 
    maxRequests: number = 10, 
    windowMs: number = 600000, // 10 minutes
    suspiciousThreshold: number = 50 // Flag as suspicious after this many requests
  ): boolean {
    const now = Date.now();
    const entry = this.requests.get(key) || { 
      count: 0, 
      times: [], 
      blocked: false, 
      firstAttempt: now,
      suspiciousActivity: false 
    };
    
    // Remove old requests outside the window
    const validRequests = entry.times.filter(time => now - time < windowMs);
    
    // Check for suspicious activity patterns
    if (validRequests.length > suspiciousThreshold && !entry.suspiciousActivity) {
      entry.suspiciousActivity = true;
      securityMonitor.logSecurityEvent('suspicious_access', {
        key: this.hashKey(key),
        requestCount: validRequests.length,
        timeWindow: windowMs,
        pattern: 'excessive_requests'
      });
    }
    
    // Enhanced blocking logic
    if (validRequests.length >= maxRequests) {
      entry.blocked = true;
      entry.times = validRequests;
      entry.count = validRequests.length;
      this.requests.set(key, entry);
      
      securityMonitor.logSecurityEvent('rate_limit_exceeded', {
        key: this.hashKey(key),
        requestCount: validRequests.length,
        maxAllowed: maxRequests,
        timeWindow: windowMs,
        totalAttempts: entry.times.length,
        suspicious: entry.suspiciousActivity
      });
      
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    entry.times = validRequests;
    entry.count = validRequests.length;
    entry.blocked = false;
    
    // Update first attempt if this is a new session
    if (entry.count === 1) {
      entry.firstAttempt = now;
    }
    
    this.requests.set(key, entry);
    
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    const windowMs = 600000; // 10 minutes
    let cleanedCount = 0;
    
    for (const [key, entry] of this.requests.entries()) {
      const validRequests = entry.times.filter(time => now - time < windowMs);
      
      if (validRequests.length === 0 && !entry.blocked) {
        this.requests.delete(key);
        cleanedCount++;
      } else {
        entry.times = validRequests;
        entry.count = validRequests.length;
        
        // Unblock if enough time has passed
        if (entry.blocked && validRequests.length === 0) {
          entry.blocked = false;
          entry.suspiciousActivity = false;
        }
        
        this.requests.set(key, entry);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Rate limiter cleanup: removed ${cleanedCount} expired entries`);
    }
  }
  
  getStats(): { 
    totalKeys: number; 
    blockedKeys: number; 
    suspiciousKeys: number;
    totalRequests: number;
  } {
    let blockedKeys = 0;
    let suspiciousKeys = 0;
    let totalRequests = 0;
    
    for (const entry of this.requests.values()) {
      if (entry.blocked) blockedKeys++;
      if (entry.suspiciousActivity) suspiciousKeys++;
      totalRequests += entry.count;
    }
    
    return {
      totalKeys: this.requests.size,
      blockedKeys,
      suspiciousKeys,
      totalRequests
    };
  }
  
  getKeyInfo(key: string): {
    exists: boolean;
    count: number;
    blocked: boolean;
    suspicious: boolean;
    firstAttempt?: Date;
  } {
    const entry = this.requests.get(key);
    if (!entry) {
      return { exists: false, count: 0, blocked: false, suspicious: false };
    }
    
    return {
      exists: true,
      count: entry.count,
      blocked: entry.blocked,
      suspicious: entry.suspiciousActivity,
      firstAttempt: new Date(entry.firstAttempt)
    };
  }
  
  // Hash key for logging (privacy protection)
  private hashKey(key: string): string {
    // Simple hash for logging purposes - not cryptographically secure
    let hash = 0;
    if (key.length === 0) return hash.toString();
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `hashed_${Math.abs(hash).toString(16)}`;
  }
  
  // Force unblock a key (for administrative purposes)
  unblockKey(key: string): boolean {
    const entry = this.requests.get(key);
    if (entry) {
      entry.blocked = false;
      entry.suspiciousActivity = false;
      entry.times = []; // Clear history
      entry.count = 0;
      this.requests.set(key, entry);
      return true;
    }
    return false;
  }
}

export const rateLimiter = new RateLimiter();

// Cleanup old entries every 5 minutes with better error handling
const cleanupInterval = setInterval(() => {
  try {
    rateLimiter.cleanup();
  } catch (error) {
    console.error('Rate limiter cleanup failed:', error);
    securityMonitor.logSecurityEvent('validation_failed', {
      reason: 'Rate limiter cleanup error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}, 300000);

// Ensure cleanup runs on process termination
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
  });
}
