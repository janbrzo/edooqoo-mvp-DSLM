
import { supabase } from "@/integrations/supabase/client";
import { devLog } from '@/utils/logger';

export interface DownloadSession {
  id: string;
  session_token: string;
  downloads_count: number;
  expires_at: string;
  created_at: string;
  worksheet_id: string | null;
  payment_id: string | null;
}

async function fetchSessionByToken(sessionToken: string): Promise<DownloadSession | null> {
  const { data, error } = await (supabase as any).rpc('get_download_session_by_token', {
    p_session_token: sessionToken,
  });

  if (error) throw error;
  return Array.isArray(data) ? (data[0] || null) : (data || null);
}

export const downloadSessionService = {
  // Create a new download session
  async createSession(sessionToken: string, worksheetId?: string, paymentId?: string): Promise<DownloadSession | null> {
    try {
      const existing = await fetchSessionByToken(sessionToken);
      if (!existing) return null;

      devLog('Download session exists for token:', sessionToken);
      return existing;
    } catch (error) {
      console.error('Error creating download session:', error);
      return null;
    }
  },

  // Get session by token
  async getSessionByToken(sessionToken: string): Promise<DownloadSession | null> {
    try {
      return await fetchSessionByToken(sessionToken);
    } catch (error) {
      console.error('Error fetching download session:', error);
      return null;
    }
  },

  // Increment download count with better error handling and logging
  async incrementDownloadCount(sessionToken: string): Promise<boolean> {
    try {
      devLog('Attempting to increment download count for token:', sessionToken);
      
      const { data: updateData, error: updateError } = await (supabase as any).rpc('increment_download_session_by_token', {
        p_session_token: sessionToken,
      });

      if (updateError) {
        console.error('Error updating download count:', updateError);
        return false;
      }

      const updated = Array.isArray(updateData) ? updateData[0] : updateData;
      if (!updated) {
        console.error('No valid session found for token:', sessionToken);
        return false;
      }

      devLog('Download count updated successfully to:', updated.downloads_count);
      return true;
    } catch (error) {
      console.error('Error incrementing download count:', error);
      return false;
    }
  },

  // Check if session is valid (not expired)
  async isSessionValid(sessionToken: string): Promise<boolean> {
    try {
      const data = await fetchSessionByToken(sessionToken);
      if (!data) return false;

      const expiresAt = new Date(data.expires_at);
      const now = new Date();
      
      return expiresAt > now;
    } catch (error) {
      console.error('Error checking session validity:', error);
      return false;
    }
  },

  // Get download statistics for a session
  async getSessionStats(sessionToken: string): Promise<{ downloads_count: number; expires_at: string } | null> {
    try {
      const data = await fetchSessionByToken(sessionToken);

      devLog('Session stats fetched:', data);
      return data ? { downloads_count: data.downloads_count, expires_at: data.expires_at } : null;
    } catch (error) {
      console.error('Error fetching session stats:', error);
      return null;
    }
  }
};
