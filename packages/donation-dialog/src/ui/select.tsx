import {
  Content as SelectPrimitiveContent,
  Group as SelectPrimitiveGroup,
  Item as SelectPrimitiveItem,
  ItemIndicator as SelectPrimitiveItemIndicator,
  Portal as SelectPrimitivePortal,
  Root as SelectPrimitiveRoot,
  Trigger as SelectPrimitiveTrigger,
  Value as SelectPrimitiveValue,
  Viewport as SelectPrimitiveViewport,
} from "@radix-ui/react-select";
import type { ReactNode } from "react";
import clsx from "clsx";

export const Select = SelectPrimitiveRoot;

export function SelectTrigger({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <SelectPrimitiveTrigger className={clsx("dd-select-trigger", className)}>
      {children}
      <svg
        className="dd-select-chevron"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </SelectPrimitiveTrigger>
  );
}

export function SelectValue({ placeholder }: { placeholder?: string }) {
  return <SelectPrimitiveValue placeholder={placeholder} />;
}

export function SelectContent({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <SelectPrimitivePortal>
      <SelectPrimitiveContent
        className={clsx("dd-select-content", className)}
        position="popper"
        sideOffset={4}
      >
        <SelectPrimitiveViewport className="dd-select-viewport">
          {children}
        </SelectPrimitiveViewport>
      </SelectPrimitiveContent>
    </SelectPrimitivePortal>
  );
}

export const SelectGroup = SelectPrimitiveGroup;

export function SelectItem({
  value,
  children,
  disabled,
}: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <SelectPrimitiveItem
      value={value}
      disabled={disabled}
      className="dd-select-item"
    >
      <SelectPrimitiveItemIndicator className="dd-select-item-indicator">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </SelectPrimitiveItemIndicator>
      <span className="dd-select-item-text">{children}</span>
    </SelectPrimitiveItem>
  );
}
