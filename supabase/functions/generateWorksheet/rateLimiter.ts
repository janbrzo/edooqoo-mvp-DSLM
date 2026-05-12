
// Enhanced multi-tier rate limiting

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests
    const validRequests = requests.filter(time => now - time < 3600000); // Keep last hour
    
    // Check 3 requests per 5 minutes (300 seconds)
    const recentRequests5min = validRequests.filter(time => now - time < 300000);
    if (recentRequests5min.length >= 3) {
      console.warn(`Rate limit exceeded (3/5min) for key: ${key}`);
      return false;
    }
    
    // Check 5 requests per 15 minutes (900 seconds)
    const recentRequests15min = validRequests.filter(time => now - time < 900000);
    if (recentRequests15min.length >= 5) {
      console.warn(`Rate limit exceeded (5/15min) for key: ${key}`);
      return false;
    }
    
    // Check 10 requests per 60 minutes (3600 seconds)
    const recentRequests60min = validRequests.filter(time => now - time < 3600000);
    if (recentRequests60min.length >= 10) {
      console.warn(`Rate limit exceeded (10/60min) for key: ${key}`);
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }
}
