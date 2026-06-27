/// <reference types="vite/client" />

declare module "@/components/ui/switch" {
  import type { ComponentProps } from "react";
  export const Switch: React.ForwardRefExoticComponent<
    ComponentProps<"button"> & {
      checked?: boolean;
      onCheckedChange?: (checked: boolean) => void;
      size?: "default" | "sm";
    } & React.RefAttributes<HTMLButtonElement>
  >;
}

declare module "@/components/ui/tooltip" {
  import type { ComponentProps, ReactNode } from "react";

  export const TooltipProvider: React.FC<{
    children?: ReactNode;
    delayDuration?: number;
  }>;

  export const Tooltip: React.FC<{
    children?: ReactNode;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }>;

  export const TooltipTrigger: React.ForwardRefExoticComponent<
    ComponentProps<"button"> & {
      asChild?: boolean;
    } & React.RefAttributes<HTMLButtonElement>
  >;

  export const TooltipContent: React.ForwardRefExoticComponent<
    ComponentProps<"div"> & {
      side?: "top" | "right" | "bottom" | "left";
      sideOffset?: number;
      children?: ReactNode;
    } & React.RefAttributes<HTMLDivElement>
  >;
}
