import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-12 w-full rounded-lg px-4 py-2 text-sm",
        "bg-white/5 border border-white/10 text-[#F9F9F9]",
        "placeholder:text-white/25",
        "focus:outline-none focus:ring-2 focus:ring-[#FF8C00]/50 focus:border-[#FF8C00]/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-200",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
