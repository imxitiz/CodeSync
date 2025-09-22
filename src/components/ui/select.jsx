import {
  Content as SelectRadixContent,
  Group as SelectRadixGroup,
  Icon as SelectRadixIcon,
  Item as SelectRadixItem,
  ItemText as SelectRadixItemText,
  Portal as SelectRadixPortal,
  Root as SelectRadixRoot,
  Separator as SelectRadixSeparator,
  Trigger as SelectRadixTrigger,
  Value as SelectRadixValue,
  Viewport as SelectRadixViewport,
} from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// shadcn-like Select composed from Radix primitives, styled for Tailwind v4 tokens

const Select = SelectRadixRoot;

const SelectGroup = SelectRadixGroup;

const SelectValue = SelectRadixValue;

const SelectTrigger = forwardRef(({ className, children, ...props }, ref) => (
  <SelectRadixTrigger
    className={cn(
      "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm",
      "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  >
    {children}
    <SelectRadixIcon>
      <ChevronDown aria-hidden="true" className="size-4 opacity-60" />
    </SelectRadixIcon>
  </SelectRadixTrigger>
));

const SelectContent = forwardRef(
  ({ className, position = "popper", ...props }, ref) => (
    <SelectRadixPortal>
      <SelectRadixContent
        className={cn(
          "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
          "data-[state=closed]:animate-out data-[state=open]:animate-in",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
          className
        )}
        position={position}
        ref={ref}
        sideOffset={6}
        {...props}
      />
    </SelectRadixPortal>
  )
);

const SelectViewport = forwardRef(({ className, ...props }, ref) => (
  <SelectRadixViewport className={cn("p-1", className)} ref={ref} {...props} />
));

const SelectItem = forwardRef(({ className, children, ...props }, ref) => (
  <SelectRadixItem
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
      // Highlight the currently active/selected option with stronger contrast
      "data-[state=checked]:bg-primary/15 data-[state=checked]:text-foreground",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  >
    <SelectRadixItemText className="w-full">{children}</SelectRadixItemText>
  </SelectRadixItem>
));

const SelectSeparator = forwardRef(({ className, ...props }, ref) => (
  <SelectRadixSeparator
    className={cn("my-1 h-px bg-border", className)}
    ref={ref}
    {...props}
  />
));

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  SelectViewport,
};
