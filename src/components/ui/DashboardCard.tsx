"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  meshBg?: boolean;
}

export function DashboardCard({ children, className, meshBg, ...props }: DashboardCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl md:rounded-[24px] p-6 transition-all duration-500",
        "bg-brand-surface-1/40 backdrop-blur-2xl",
        "border border-white/5 dark:border-white/5 shadow-xl",
        // Soft hover lift effect
        "hover:shadow-2xl hover:-translate-y-1 hover:border-brand-subtle",
        className
      )}
      {...props}
    >
      {/* Optional colorful mesh gradient in the background to give that vibrant neon vibe */}
      {meshBg && (
        <div 
          className="absolute inset-0 opacity-15 pointer-events-none transition-opacity duration-500"
          style={{
            background: "radial-gradient(circle at 0% 0%, var(--color-accent-primary) 0%, transparent 50%), radial-gradient(circle at 100% 100%, var(--color-accent-secondary) 0%, transparent 50%)"
          }}
        />
      )}
      
      {/* Content wrapper relative to stay above absolute backgrounds */}
      <div className="relative z-10 w-full h-full space-y-4">
        {children}
      </div>
    </div>
  );
}

// Optional Sub-components for structuring card content clearly
export function DashboardCardHeader({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      {children}
    </div>
  );
}

export function DashboardCardTitle({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-base font-semibold text-brand-secondary", className)} {...props}>
      {children}
    </h3>
  );
}

export function DashboardCardContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("pt-2", className)} {...props}>
      {children}
    </div>
  );
}
