
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentTracking } from "@/hooks/usePaymentTracking";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { trackStripePaymentSuccess } = usePaymentTracking();

  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (sessionId) {
      verifyPayment();
    } else {
      setError('No session ID found');
      setIsVerifying(false);
    }
  }, [sessionId]);

  const verifyPayment = async () => {
    try {
      console.log('🔍 PAYMENT VERIFICATION START - Session ID:', sessionId);
      
      const { data, error } = await supabase.functions.invoke('verify-export-payment', {
        body: { sessionId }
      });

      console.log('📋 PAYMENT VERIFICATION RESPONSE:', {
        data,
        error,
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : [],
        status: data?.status,
        worksheetId: data?.worksheetId,
        paymentId: data?.paymentId,
        amount: data?.amount
      });

      if (error) {
        console.error('❌ Payment verification error:', error);
        setError('Failed to verify payment');
        return;
      }

      setVerificationResult(data);

      if (data.status === 'paid') {
        // Set download token regardless of other conditions
        if (data.sessionToken) {
          sessionStorage.setItem('downloadToken', data.sessionToken);
          sessionStorage.setItem('downloadTokenExpiry', new Date(data.expiresAt).getTime().toString());
        }
        
        // Track successful Stripe payment - with comprehensive logging
        console.log('💰 ATTEMPTING TO TRACK STRIPE PAYMENT SUCCESS');
        console.log('📊 Tracking data:', {
          worksheetId: data.worksheetId,
          paymentId: data.paymentId,
          amount: data.amount,
          hasWorksheetId: !!data.worksheetId,
          hasPaymentId: !!data.paymentId,
          hasAmount: !!data.amount
        });

        try {
          // Always try to track, even if some data is missing
          const trackingWorksheetId = data.worksheetId || 'unknown';
          const trackingPaymentId = data.paymentId || sessionId || 'unknown';
          const trackingAmount = data.amount || 100;

          console.log('🚀 CALLING trackStripePaymentSuccess with:', {
            worksheetId: trackingWorksheetId,
            paymentId: trackingPaymentId,
            amount: trackingAmount
          });

          await trackStripePaymentSuccess(trackingWorksheetId, trackingPaymentId, trackingAmount);
          
          console.log('✅ STRIPE PAYMENT SUCCESS TRACKING COMPLETED');

        } catch (trackingError) {
          console.error('❌ ERROR IN STRIPE PAYMENT TRACKING:', trackingError);
          
          // Fallback: try to track with minimal data
          try {
            console.log('🔄 ATTEMPTING FALLBACK TRACKING');
            await trackStripePaymentSuccess('fallback-worksheet', sessionId || 'unknown', 100);
            console.log('✅ FALLBACK TRACKING COMPLETED');
          } catch (fallbackError) {
            console.error('❌ FALLBACK TRACKING ALSO FAILED:', fallbackError);
          }
        }
        
        toast({
          title: "Payment successful!",
          description: "Downloads unlocked! Returning to your worksheet...",
          className: "bg-green-50 border-green-200"
        });

        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1000);
      } else {
        console.log('⚠️ Payment not completed, status:', data.status);
      }
    } catch (error) {
      console.error('💥 PAYMENT VERIFICATION EXCEPTION:', error);
      setError('Payment verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReturnToWorksheet = () => {
    navigate('/', { replace: true });
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <div className="animate-spin h-8 w-8 border-4 border-worksheet-purple border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Verifying Payment</h2>
          <p className="text-gray-600">Please wait while we confirm your payment...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 text-red-600">Payment Verification Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={handleReturnToWorksheet} className="bg-worksheet-purple hover:bg-worksheet-purpleDark">
            Return to Worksheet
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold mb-2 text-green-600">Payment Successful!</h2>
        
        {verificationResult?.status === 'paid' ? (
          <>
            <p className="text-gray-600 mb-6">
              Your payment has been processed. Both Student and Teacher download versions are now unlocked for your current session.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-green-700">
                <Download className="h-4 w-4" />
                <span className="font-medium">Downloads Unlocked</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                You can now download both Student and Teacher HTML versions unlimited times.
              </p>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
              Returning to your worksheet...
            </p>
          </>
        ) : (
          <p className="text-gray-600 mb-6">
            Payment status: {verificationResult?.status || 'Unknown'}
          </p>
        )}
        
        <Button onClick={handleReturnToWorksheet} className="bg-worksheet-purple hover:bg-worksheet-purpleDark">
          Return to Worksheet Now
        </Button>
      </div>
    </div>
  );
};

export default PaymentSuccess;
