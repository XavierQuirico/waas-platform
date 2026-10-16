import * as React from "react";
import { Loader2 } from "lucide-react";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

interface SpinnerProps {
  size?: SpinnerSize;
  label?: string;
  className?: string;
}

const sizeMap: Record<SpinnerSize, number> = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 28,
};

export function Spinner({ size = "md", label = "Cargando...", className = "" }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={`inline-flex items-center justify-center ${className}`}>
      <Loader2
        className="animate-spin text-gray-500"
        size={sizeMap[size]}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
