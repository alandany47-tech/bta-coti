import * as React from "react";
import { cn } from "@/lib/utils";

export const Slider = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="range"
      className={cn(
        "h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-hover accent-foreground",
        "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-foreground",
        className,
      )}
      {...props}
    />
  );
});
Slider.displayName = "Slider";
