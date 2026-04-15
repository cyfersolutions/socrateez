import React from "react";
import { cn } from "../../lib/utils";

interface SliderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
  disabled?: boolean;
}

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  ({ className, value, defaultValue = [50], min = 0, max = 100, step = 1, onValueChange, disabled, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const controlledValue = value !== undefined ? value : internalValue;
    const percentage = (controlledValue[0] - min) / (max - min) * 100;

    const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = [Number(e.target.value)];
      if (value === undefined) setInternalValue(newValue);
      onValueChange?.(newValue);
    };

    return (
      <div
        ref={ref}
        data-slot="slider"
        data-disabled={disabled || undefined}
        className={cn(
          "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50",
          className
        )}
        {...props}>
        
        <div data-slot="slider-track" className="relative h-1 w-full grow overflow-hidden rounded-full bg-muted">
          <div
            data-slot="slider-range"
            className="absolute h-full bg-primary"
            style={{ width: `${percentage}%` }} />
          
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={controlledValue[0]}
          onChange={handleInput}
          disabled={disabled}
          className="absolute inset-0 cursor-pointer opacity-0" />
        
        <div
          data-slot="slider-thumb"
          className="absolute block size-3 shrink-0 rounded-full border border-ring bg-white ring-ring/50 transition-[color,box-shadow] hover:ring-[3px]"
          style={{ left: `calc(${percentage}% - 6px)` }} />
        
      </div>);

  }
);
Slider.displayName = "Slider";

export { Slider };