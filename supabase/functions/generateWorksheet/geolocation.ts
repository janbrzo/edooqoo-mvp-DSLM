
// Geolocation utility with improved IP parsing, reliable services, and database cache

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

export async function getGeolocation(ip: string): Promise<{ country?: string; city?: string }> {
  try {
    // Parse IP from complex string like "46.227.241.106,46.227.241.106, 13.248.113.208"
    const cleanIP = parseIP(ip);
    console.log(`Geolocation: Original IP string: "${ip}", Parsed IP: "${cleanIP}"`);
    
    if (!cleanIP) {
      console.warn('No valid IP found to geolocate');
      return {};
    }

    // ✅ OPT 2: Check cache first (saves 0.5-2s per request)
    const cachedResult = await getCachedGeolocation(cleanIP);
    if (cachedResult) {
      console.log(`✅ [CACHE HIT] Geolocation from cache: ${cachedResult.country}, ${cachedResult.city}`);
      return cachedResult;
    }

    console.log(`❌ [CACHE MISS] Fetching geolocation from API for IP: ${cleanIP}`);

    // Try primary service first
    let result: { country?: string; city?: string } = {};
    try {
      result = await tryIPAPIService(cleanIP);
      if (result.country || result.city) {
        console.log(`Geolocation success with ipapi.co: ${result.country}, ${result.city}`);
        // Save to cache for future requests
        await saveCachedGeolocation(cleanIP, result);
        return result;
      }
    } catch (error) {
      console.warn('Primary geolocation service failed:', error);
    }

    // Try backup service
    try {
      result = await tryFreeGeoIPService(cleanIP);
      if (result.country || result.city) {
        console.log(`Geolocation success with freegeoip.app: ${result.country}, ${result.city}`);
        // Save to cache for future requests
        await saveCachedGeolocation(cleanIP, result);
        return result;
      }
    } catch (error) {
      console.warn('Backup geolocation service failed:', error);
    }

  } catch (error) {
    console.warn('Failed to get geolocation:', error);
  }
  
  console.log('Geolocation: No data available, returning empty object');
  return {};
}

// ✅ Cache helper: Get from database cache (TTL: 7 days)
async function getCachedGeolocation(ip: string): Promise<{ country?: string; city?: string } | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('geolocation_cache')
      .select('country, city, updated_at')
      .eq('ip', ip)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if cache is still fresh (< 7 days)
    const cacheAge = Date.now() - new Date(data.updated_at).getTime();
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

    if (cacheAge > sevenDaysInMs) {
      console.log(`⏰ Cache expired for IP: ${ip}`);
      return null;
    }

    return {
      country: data.country || undefined,
      city: data.city || undefined,
    };
  } catch (error) {
    console.warn('Error reading geolocation cache:', error);
    return null;
  }
}

// ✅ Cache helper: Save to database cache
async function saveCachedGeolocation(ip: string, data: { country?: string; city?: string }): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('geolocation_cache')
      .upsert({
        ip,
        country: data.country || null,
        city: data.city || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'ip'
      });

    console.log(`💾 Saved geolocation to cache: ${ip} -> ${data.country}, ${data.city}`);
  } catch (error) {
    console.warn('Error saving geolocation cache:', error);
  }
}

function parseIP(ipString: string): string | null {
  if (!ipString) return null;
  
  // Split by comma and get unique IPs
  const ips = ipString.split(',').map(ip => ip.trim()).filter(Boolean);
  
  // IPv4 regex pattern
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  
  // Find first valid IPv4 address
  for (const ip of ips) {
    if (ipv4Regex.test(ip)) {
      // Additional validation: check if octets are in valid range (0-255)
      const octets = ip.split('.').map(Number);
      if (octets.every(octet => octet >= 0 && octet <= 255)) {
        return ip;
      }
    }
  }
  
  return null;
}

async function tryIPAPIService(ip: string): Promise<{ country?: string; city?: string }> {
  const response = await fetch(`https://ipapi.co/${ip}/json/`, {
    headers: {
      'User-Agent': 'Supabase-Edge-Function/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`ipapi.co returned status: ${response.status}`);
  }
  
  const data = await response.json();
  
  // ipapi.co returns different field names
  return {
    country: data.country_name || null,
    city: data.city || null
  };
}

async function tryFreeGeoIPService(ip: string): Promise<{ country?: string; city?: string }> {
  const response = await fetch(`https://freegeoip.app/json/${ip}`, {
    headers: {
      'User-Agent': 'Supabase-Edge-Function/1.0'
    }
  });
  
  if (!response.ok) {
    throw new Error(`freegeoip.app returned status: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    country: data.country_name || null,
    city: data.city || null
  };
}
