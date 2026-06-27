import {
  CheckboxItem as DropdownCheckboxItem,
  Content as DropdownContent,
  Item as DropdownItem,
  ItemIndicator as DropdownItemIndicator,
  Label as DropdownLabel,
  type DropdownMenuCheckboxItemProps,
  type DropdownMenuContentProps,
  type DropdownMenuItemProps,
  type DropdownMenuRadioItemProps,
  Portal as DropdownPortal,
  RadioGroup as DropdownRadioGroup,
  RadioItem as DropdownRadioItem,
  Root as DropdownRoot,
  Separator as DropdownSeparator,
  Sub as DropdownSub,
  SubContent as DropdownSubContent,
  SubTrigger as DropdownSubTrigger,
  Trigger as DropdownTrigger,
} from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import type {
  ComponentPropsWithoutRef,
  HTMLAttributes,
  RefObject,
} from "react";
import { cn } from "@/lib/utils";

const DropdownMenu = DropdownRoot;
const DropdownMenuTrigger = DropdownTrigger;
const DropdownMenuGroup = DropdownRadioGroup;
const DropdownMenuPortal = DropdownPortal;
const DropdownMenuSub = DropdownSub;
const DropdownMenuRadioGroup = DropdownRadioGroup;

const DropdownMenuSubTrigger = ({
  className,
  children,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownSubTrigger> & {
  ref?: RefObject<HTMLDivElement | null>;
  inset?: boolean;
}) => (
  <DropdownSubTrigger
    className={cn(
      "flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      props.inset && "pl-8",
      className,
    )}
    ref={ref}
    {...props}
  >
    {children}
  </DropdownSubTrigger>
);

const DropdownMenuSubContent = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownSubContent> & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <DropdownSubContent
    className={cn(
      "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 overflow-hidden rounded-md border bg-card p-1 text-card-foreground shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
      className,
    )}
    ref={ref}
    {...props}
  />
);

const DropdownMenuContent = ({
  className,
  sideOffset = 4,
  ref,
  ...props
}: DropdownMenuContentProps & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <DropdownPortal>
    <DropdownContent
      className={cn(
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 overflow-hidden rounded-md border bg-card p-1 text-card-foreground shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className,
      )}
      ref={ref}
      sideOffset={sideOffset}
      {...props}
    />
  </DropdownPortal>
);

const DropdownMenuItem = ({
  className,
  ref,
  ...props
}: DropdownMenuItemProps & {
  ref?: RefObject<HTMLDivElement | null>;
  inset?: boolean;
}) => (
  <DropdownItem
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
      props.inset && "pl-8",
      className,
    )}
    ref={ref}
    {...props}
  />
);

const DropdownMenuCheckboxItem = ({
  className,
  children,
  ref,
  ...props
}: DropdownMenuCheckboxItemProps & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <DropdownCheckboxItem
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-md py-1.5 pr-2 pl-8 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownItemIndicator>
        <Check className="size-4" />
      </DropdownItemIndicator>
    </span>
    {children}
  </DropdownCheckboxItem>
);

const DropdownMenuRadioItem = ({
  className,
  children,
  ref,
  ...props
}: DropdownMenuRadioItemProps & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <DropdownRadioItem
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-md py-1.5 pr-2 pl-8 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className,
    )}
    ref={ref}
    {...props}
  >
    <span className="absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownItemIndicator>
        <Check className="size-4" />
      </DropdownItemIndicator>
    </span>
    {children}
  </DropdownRadioItem>
);

const DropdownMenuLabel = ({
  className,
  ref,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  ref?: RefObject<HTMLDivElement | null>;
  inset?: boolean;
}) => (
  <DropdownLabel
    className={cn(
      "px-2 py-1.5 font-semibold text-sm",
      props.inset && "pl-8",
      className,
    )}
    ref={ref}
    {...props}
  />
);

const DropdownMenuSeparator = ({
  className,
  ref,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownSeparator> & {
  ref?: RefObject<HTMLDivElement | null>;
}) => (
  <DropdownSeparator
    className={cn("-mx-1 my-1 h-px bg-border", className)}
    ref={ref}
    {...props}
  />
);

const DropdownMenuShortcut = ({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
    {...props}
  />
);

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};
