import {
  Content as SelectRadixContent,
  type SelectContentProps as SelectRadixContentProps,
  Group as SelectRadixGroup,
  Icon as SelectRadixIcon,
  Item as SelectRadixItem,
  type SelectItemProps as SelectRadixItemProps,
  ItemText as SelectRadixItemText,
  Portal as SelectRadixPortal,
  Root as SelectRadixRoot,
  Separator as SelectRadixSeparator,
  Trigger as SelectRadixTrigger,
  type SelectTriggerProps as SelectRadixTriggerProps,
  Value as SelectRadixValue,
  Viewport as SelectRadixViewport,
  type SelectViewportProps as SelectRadixViewportProps,
} from "@radix-ui/react-select";
import { ChevronDown } from "lucide-react";
import type { HTMLAttributes, RefObject } from "react";
import { cn } from "@/lib/utils";

// shadcn-like Select composed from Radix primitives, styled for Tailwind v4 tokens

const Select = SelectRadixRoot;

const SelectGroup = SelectRadixGroup;

const SelectValue = SelectRadixValue;

const SelectTrigger = ({
  className,
  children,
  ref,
  ...props
}: SelectRadixTriggerProps & { ref?: RefObject<HTMLButtonElement | null> }) => (
  <SelectRadixTrigger
    className={cn(
      "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm",
      "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  >
    {children}
    <SelectRadixIcon>
      <ChevronDown aria-hidden="true" className="size-4 opacity-60" />
    </SelectRadixIcon>
  </SelectRadixTrigger>
);
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = ({
  className,
  position = "popper",
  ref,
  ...props
}: SelectRadixContentProps & { ref?: RefObject<HTMLDivElement | null> }) => (
  <SelectRadixPortal>
    <SelectRadixContent
      className={cn(
        "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        "data-[state=closed]:animate-out data-[state=open]:animate-in",
        "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
        "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      position={position}
      ref={ref}
      sideOffset={6}
      {...props}
    />
  </SelectRadixPortal>
);
SelectContent.displayName = "SelectContent";

const SelectViewport = ({
  className,
  ref,
  ...props
}: SelectRadixViewportProps & { ref?: RefObject<HTMLDivElement | null> }) => (
  <SelectRadixViewport className={cn("p-1", className)} ref={ref} {...props} />
);
SelectViewport.displayName = "SelectViewport";

const SelectItem = ({
  className,
  children,
  ref,
  ...props
}: SelectRadixItemProps & { ref?: RefObject<HTMLDivElement | null> }) => (
  <SelectRadixItem
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
      // Highlight the currently active/selected option with stronger contrast
      "data-[state=checked]:bg-primary/15 data-[state=checked]:text-foreground",
      "focus:bg-accent focus:text-accent-foreground",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  >
    <SelectRadixItemText className="w-full">{children}</SelectRadixItemText>
  </SelectRadixItem>
);
SelectItem.displayName = "SelectItem";

const SelectSeparator = ({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <SelectRadixSeparator
    className={cn("my-1 h-px bg-border", className)}
    ref={ref}
    {...props}
  />
);
SelectSeparator.displayName = "SelectSeparator";

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
