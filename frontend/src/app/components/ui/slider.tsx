"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";

import { cn } from "./utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max],
  );

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          "relative grow overflow-hidden rounded-full border border-black/10 bg-[linear-gradient(90deg,rgba(255,255,255,0.6),rgba(0,0,0,0.04))] shadow-inner data-[orientation=horizontal]:h-3 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5 dark:border-white/10 dark:bg-[linear-gradient(90deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03))]",
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            "absolute bg-[linear-gradient(90deg,rgba(24,24,27,0.9),rgba(120,113,108,0.7))] shadow-[0_0_20px_rgba(15,23,42,0.18)] data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full dark:bg-[linear-gradient(90deg,rgba(255,255,255,0.95),rgba(214,211,209,0.7))]",
          )}
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-5 shrink-0 rounded-md border-2 border-white bg-black shadow-[0_10px_20px_rgba(15,23,42,0.18)] transition-[transform,color,box-shadow] hover:scale-105 hover:shadow-[0_12px_24px_rgba(15,23,42,0.24)] focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-black/15 disabled:pointer-events-none disabled:opacity-50 dark:border-black dark:bg-white dark:focus-visible:ring-white/20"
        />
      ))}
    </SliderPrimitive.Root>
  );
}

export { Slider };
