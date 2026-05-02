
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { AlertTriangle, Check, Info, X } from "lucide-react";

export function Toaster() {
  const { toasts } = useToast();
  
  const getIcon = (variant?: string) => {
    switch (variant) {
      case "success":
        return <Check className="h-4 w-4 text-green-500" />;
      case "error":
        return <X className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant,
        ...props
      }) {
        return (
          <Toast key={id} className="bg-white shadow-lg rounded-lg group max-h-36 min-h-[36px] h-[68px] px-[16px] py-[12px]">
            <div className="flex items-center gap-2 h-full">
              <div className="flex-shrink-0 pt-0.5">
                {getIcon(variant)}
              </div>
              <div className="grid gap-1">
                {title && <ToastTitle className="font-semibold text-sm text-gray-900 py-0">{title}</ToastTitle>}
                {description && <ToastDescription className="text-xs text-gray-600">{description}</ToastDescription>}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
