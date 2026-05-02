
import { useEventTracking } from './useEventTracking';

export const usePaymentTracking = (userId?: string) => {
  const { trackEvent } = useEventTracking(userId);

  const trackPaymentButtonClick = (worksheetId: string, amount: number) => {
    console.log('🔘 TRACKING PAYMENT BUTTON CLICK:', { worksheetId, amount });
    
    trackEvent({
      eventType: 'payment_button_click',
      eventData: {
        worksheetId,
        amount,
        timestamp: new Date().toISOString()
      }
    });
  };

  const trackStripePaymentSuccess = async (worksheetId: string, paymentId: string, amount: number) => {
    console.log('💳 TRACKING STRIPE PAYMENT SUCCESS:', { 
      worksheetId, 
      paymentId, 
      amount,
      eventType: 'stripe_payments_success'
    });
    
    try {
      await trackEvent({
        eventType: 'stripe_payments_success',
        eventData: {
          worksheetId,
          paymentId,
          amount,
          timestamp: new Date().toISOString()
        }
      });
      
      console.log('✅ STRIPE PAYMENT SUCCESS EVENT SENT TO TRACKING');
    } catch (error) {
      console.error('❌ ERROR SENDING STRIPE PAYMENT SUCCESS EVENT:', error);
      throw error;
    }
  };

  return {
    trackPaymentButtonClick,
    trackStripePaymentSuccess
  };
};
