
import React, { useState } from "react";
import WorksheetForm, { FormData } from "@/components/WorksheetForm";
import TrackingFormWrapper from "@/components/WorksheetForm/TrackingFormWrapper";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface FormViewProps {
  onSubmit: (data: FormData) => void;
  userId?: string;
  onStudentChange?: (studentId: string | null) => void;
  preSelectedStudent?: {id: string;name: string;} | null;
  isRegisteredUser?: boolean;
  variant?: 'landing' | 'dashboard';
}

const FormView: React.FC<FormViewProps> = ({
  onSubmit,
  userId,
  onStudentChange,
  preSelectedStudent,
  isRegisteredUser = false,
  variant = 'dashboard'
}) => {
  const isMobile = useIsMobile();
  const [couponCode, setCouponCode] = useState("");
  const [showCouponDialog, setShowCouponDialog] = useState(false);

  const handleSubscriptionWithCoupon = async (planType: string, monthlyLimit: number, price: number, planName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: {
          planType,
          monthlyLimit,
          price,
          planName,
          couponCode: couponCode.trim() || undefined
        }
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Subscription error:', error);
    }
  };

  if (variant === 'landing') {
    return (
      <TrackingFormWrapper userId={userId}>
        <div className="scroll-mt-24 pb-8 pt-0">
            <div className={`max-w-6xl mx-auto ${isMobile ? 'px-2' : 'px-4'}`}>
            
            {/* Premium Form Wrapper with glow */}
            <div className="relative group/glow">
              <div className="absolute -inset-1 bg-gradient-to-r from-violet-500 to-indigo-500 rounded-[2rem] blur opacity-20 group-hover/glow:opacity-30 transition duration-500"></div>
              
              {/* No signup badge */}
              <div className="absolute -top-3 left-8 z-10">
                <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full shadow-md">
                  No signup needed
                </span>
              </div>
              
              <div className="relative bg-background rounded-3xl shadow-2xl border border-border/50 overflow-hidden p-1 md:p-2 px-[8px] py-[8px]">
                <WorksheetForm
                  onSubmit={onSubmit}
                  userId={userId ?? null}
                  onStudentChange={onStudentChange}
                  preSelectedStudent={preSelectedStudent} />
                
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-6 text-sm font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div> System online</span>
              <span className="hidden sm:inline text-border">•</span>
              <span>Generates in ~90 seconds</span>
              <span className="hidden sm:inline text-border">•</span>
              <span>100% Free trial</span>
            </div>
          </div>
        </div>

        {/* Coupon dialog */}
        <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Coupon Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Enter coupon code (optional)"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)} />
              
              <div className="flex gap-2">
                <Button onClick={() => setShowCouponDialog(false)} variant="outline">
                  Cancel
                </Button>
                <Button onClick={() => setShowCouponDialog(false)}>
                  Apply & Continue
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </TrackingFormWrapper>);

  }

  // variant === 'dashboard'
  return (
    <TrackingFormWrapper userId={userId}>
      <div className="max-w-5xl mx-auto">
        <WorksheetForm
          onSubmit={onSubmit}
          userId={userId ?? null}
          onStudentChange={onStudentChange}
          preSelectedStudent={preSelectedStudent} />
        
      </div>

      {/* Coupon dialog */}
      <Dialog open={showCouponDialog} onOpenChange={setShowCouponDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Coupon Code</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter coupon code (optional)"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)} />
            
            <div className="flex gap-2">
              <Button onClick={() => setShowCouponDialog(false)} variant="outline">
                Cancel
              </Button>
              <Button onClick={() => setShowCouponDialog(false)}>
                Apply & Continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TrackingFormWrapper>);

};

export default FormView;