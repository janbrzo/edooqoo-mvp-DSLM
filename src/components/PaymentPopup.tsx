
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, CreditCard, Lock, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentTracking } from "@/hooks/usePaymentTracking";
import { isFreeCustomDemoWeek, getFreeWeekEndDateString, isLastDayOfFreeWeek, isPromoForLoggedInOnly } from "@/utils/promoUtils";

interface PaymentPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (sessionToken: string) => void;
  worksheetId: string | null;
  userIp?: string | null;
  isRegisteredUser?: boolean;
}

const PaymentPopup = ({ isOpen, onClose, onPaymentSuccess, worksheetId, userIp, isRegisteredUser = false }: PaymentPopupProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { trackPaymentButtonClick } = usePaymentTracking();
  
  // Check if FREE DEMO WEEK is active
  // FREE WEEK is only valid for logged-in users when promotion requires login
  // If isPromoForLoggedInOnly() returns true (e.g., FREE CHRISTMAS WEEK) and user is not registered,
  // show regular payment flow instead of free download
  const isFreeWeek = isFreeCustomDemoWeek() && (!isPromoForLoggedInOnly() || isRegisteredUser);

  // Check for existing valid token when popup opens
  useEffect(() => {
    if (isOpen) {
      const downloadToken = sessionStorage.getItem('downloadToken');
      const tokenExpiry = sessionStorage.getItem('downloadTokenExpiry');
      
      if (downloadToken && tokenExpiry) {
        const expiryTime = parseInt(tokenExpiry);
        if (Date.now() < expiryTime) {
          console.log('Found existing valid token, unlocking downloads');
          onPaymentSuccess(downloadToken);
          onClose();
          return;
        } else {
          // Token expired, clean up
          sessionStorage.removeItem('downloadToken');
          sessionStorage.removeItem('downloadTokenExpiry');
        }
      }
    }
  }, [isOpen, onPaymentSuccess, onClose]);

  const handlePayment = async () => {
    if (!worksheetId) {
      toast({
        title: "Error",
        description: "Missing worksheet information. Please try generating the worksheet again.",
        variant: "destructive"
      });
      return;
    }

    // Track payment button click
    trackPaymentButtonClick(worksheetId, 1);

    // Use IP address as user identifier, fallback to browser fingerprint
    const userIdentifier = userIp || `browser_${navigator.userAgent.slice(0, 50)}_${Date.now()}`;

    setIsProcessing(true);
    try {
      console.log('Creating payment session for:', { worksheetId, userIdentifier });
      
      // Set flag to prevent "worksheet restored" message when returning from payment
      sessionStorage.setItem('returningFromPayment', 'true');
      
      // Call edge function to create Stripe checkout session
      const { data, error } = await supabase.functions.invoke('create-export-payment', {
        body: { 
          worksheetId,
          userId: userIdentifier,
          successUrl: `${window.location.origin}/payment-success`,
          cancelUrl: window.location.href
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        // Remove flag if payment failed
        sessionStorage.removeItem('returningFromPayment');
        throw error;
      }

      if (data?.url) {
        console.log('Redirecting to Stripe checkout:', data.url);
        // Redirect to Stripe checkout in the same window
        window.location.href = data.url;
      } else {
        // Remove flag if no URL received
        sessionStorage.removeItem('returningFromPayment');
        throw new Error('No checkout URL received from payment service');
      }
    } catch (error) {
      console.error('Payment error:', error);
      // Remove flag if payment failed
      sessionStorage.removeItem('returningFromPayment');
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to create payment session. Please try again.",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const handleFreeDownload = () => {
    // Generate session token for FREE DEMO WEEK
    const freeToken = `free_week_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in sessionStorage for FREE DEMO WEEK
    sessionStorage.setItem('downloadToken', freeToken);
    sessionStorage.setItem('downloadTokenExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
    
    toast({
      title: "🎁 FREE DOWNLOAD WEEK!",
      description: "Downloads unlocked for free during our special promotion!",
      className: "bg-green-50 border-green-200"
    });
    
    onPaymentSuccess(freeToken);
    onClose();
  };

  const handleSkipPayment = () => {
    // Generate temporary session token for testing
    const tempToken = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store in sessionStorage for testing
    sessionStorage.setItem('downloadToken', tempToken);
    sessionStorage.setItem('downloadTokenExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
    
    toast({
      title: "Payment Skipped (Test Mode)",
      description: "Downloads are now unlocked for testing purposes.",
      className: "bg-yellow-50 border-yellow-200"
    });
    
    onPaymentSuccess(tempToken);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md z-[100]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isFreeWeek ? (
              <>
                <Gift className="h-5 w-5 text-green-600" />
                FREE DOWNLOAD WEEK! 🎁
              </>
            ) : (
              <>
                <Lock className="h-5 w-5 text-worksheet-purple" />
                Unlock Downloads
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {isFreeWeek ? (
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Gift className="h-5 w-5 text-green-600" />
                <p className="text-lg font-bold text-green-800">
                  🎉 FREE DOWNLOAD WEEK!
                </p>
              </div>
              <p className="text-sm text-green-800 mb-2">
                <strong>Download both Student and Teacher versions completely FREE</strong> during our special promotion week!
              </p>
              <div className="flex items-center gap-2 text-sm text-green-700 mb-2">
                <Download className="h-4 w-4" />
                <span>Student and Teacher HTML versions included</span>
              </div>
              <p className="text-xs text-green-600 mb-1">
                HTML file: Best quality, works offline. Double-click to open
              </p>
              <div className="bg-green-100 border border-green-200 rounded p-2 mt-3">
                <p className="text-xs text-green-700 font-medium">
                  ⏰ Promotion ends: {getFreeWeekEndDateString()}
                  {isLastDayOfFreeWeek() && (
                    <span className="ml-1 text-red-600 font-bold">(LAST DAY!)</span>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 mb-2">
                <strong>One-time payment of $1 USD</strong> unlocks unlimited downloads of both Student and Teacher versions during your current session.
              </p>
              <div className="flex items-center gap-2 text-sm text-amber-700 mb-2">
                <Download className="h-4 w-4" />
                <span>Student and Teacher HTML versions included</span>
              </div>
              <p className="text-xs text-amber-600 mb-1">
                HTML file: Best quality, works offline. Double-click to open
              </p>
              <p className="text-xs text-amber-600">
                ⚠️ Note: Closing the page will end your session and require a new payment.
              </p>
            </div>
          )}

          {isProcessing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Redirecting to payment page...
              </p>
            </div>
          )}

          <div className="space-y-3">
            {isFreeWeek ? (
              <Button 
                onClick={handleFreeDownload}
                disabled={isProcessing}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Gift className="mr-2 h-4 w-4" />
                Download Free Now! 🎁
              </Button>
            ) : (
              <Button 
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full bg-worksheet-purple hover:bg-worksheet-purpleDark"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                {isProcessing ? "Redirecting to Payment..." : "Pay $1 with Stripe"}
              </Button>
            )}

            {/* Skip payment button - hidden but kept in code */}
            {false && (
              <Button 
                onClick={handleSkipPayment}
                variant="outline"
                className="w-full border-yellow-300 text-yellow-700 hover:bg-yellow-50"
                disabled={isProcessing}
              >
                Skip Payment (Test Mode)
              </Button>
            )}

            <Button 
              onClick={onClose}
              variant="ghost"
              className="w-full"
              disabled={isProcessing}
            >
              Cancel
            </Button>
          </div>

          {!isFreeWeek && (
            <p className="text-xs text-gray-500 text-center">
              Secure payment via Stripe. After payment, you'll return to your worksheet with downloads unlocked.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentPopup;
