import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Minimal shadcn-style Input using Tailwind v4 tokens
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border bg-background px-3 text-sm",
        "placeholder:text-muted-foreground/80",
        "outline-none transition-shadow",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      type={type}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
