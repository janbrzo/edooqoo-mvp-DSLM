import * as React from "react";
import { useRef, useEffect, useCallback } from "react";
import { Textarea, TextareaProps } from "./textarea";
import { cn } from "@/lib/utils";

const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, value, onChange, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);

    // Use callback ref to handle both refs
    const setRefs = useCallback(
      (node: HTMLTextAreaElement | null) => {
        (internalRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
        }
      },
      [ref]
    );

    // Auto-resize on value change (including initial render / page refresh)
    useEffect(() => {
      const el = internalRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
      }
    }, [value]);

    return (
      <Textarea
        ref={setRefs}
        value={value}
        onChange={(e) => {
          // Resize immediately on typing
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
          onChange?.(e);
        }}
        className={cn("resize-none overflow-hidden", className)}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";

export { AutoResizeTextarea };
