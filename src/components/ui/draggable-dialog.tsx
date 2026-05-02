import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function DraggableDialog({ open, onOpenChange, children }: DraggableDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      {children}
    </DialogPrimitive.Root>
  );
}

interface DraggableDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export const DraggableDialogContent = React.forwardRef<HTMLDivElement, DraggableDialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const [pos, setPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const dragRef = React.useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

    // Reset position when dialog opens
    React.useEffect(() => {
      setPos({ x: 0, y: 0 });
    }, []);

    const onMouseDown = React.useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, posX: pos.x, posY: pos.y };
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        setPos({
          x: dragRef.current.posX + (ev.clientX - dragRef.current.startX),
          y: dragRef.current.posY + (ev.clientY - dragRef.current.startY),
        });
      };
      const onMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }, [pos]);

    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/10 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            "fixed left-[50%] top-[50%] z-[100] grid w-full max-w-lg gap-4 border bg-background p-6 shadow-lg sm:rounded-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            className,
          )}
          style={{
            transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          }}
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('[cmdk-list]') || target.closest('[cmdk-input]')) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-radix-popper-content-wrapper]') || target.closest('[cmdk-list]') || target.closest('[cmdk-input]')) {
              e.preventDefault();
            }
          }}
          {...props}
        >
          {/* Drag handle */}
          <div
            className="absolute top-0 left-0 right-8 h-10 cursor-move flex items-center justify-center"
            onMouseDown={onMouseDown}
          >
            <GripHorizontal className="h-4 w-4 text-muted-foreground/40" />
          </div>
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
);
DraggableDialogContent.displayName = "DraggableDialogContent";

// Re-export dialog parts for convenience
export const DraggableDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);

export const DraggableDialogTitle = DialogPrimitive.Title;

export const DraggableDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
