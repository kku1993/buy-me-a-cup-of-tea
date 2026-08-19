import {
  Close as DialogPrimitiveClose,
  Content as DialogPrimitiveContent,
  Description as DialogPrimitiveDescription,
  Overlay as DialogPrimitiveOverlay,
  Portal as DialogPrimitivePortal,
  Root as DialogPrimitiveRoot,
  Title as DialogPrimitiveTitle,
  Trigger as DialogPrimitiveTrigger,
} from "@radix-ui/react-dialog";
import type { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

// Note: ReactNode is imported as a named type (not the React.* namespace)
// to avoid ambiguity when multiple @types/react copies are present.

export const Dialog = DialogPrimitiveRoot;
export const DialogTrigger = DialogPrimitiveTrigger;
export const DialogClose = DialogPrimitiveClose;

export function DialogContent({
  className,
  children,
  showClose = true,
  style,
}: {
  className?: string;
  children: ReactNode;
  showClose?: boolean;
  style?: CSSProperties;
}) {
  return (
    <DialogPrimitivePortal>
      <DialogPrimitiveOverlay className="dd-dialog-overlay" />
      <DialogPrimitiveContent
        className={clsx("dd-dialog-content", className)}
        style={style}
      >
        {children}
        {showClose ? (
          <DialogPrimitiveClose className="dd-dialog-close" aria-label="Close">
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
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </DialogPrimitiveClose>
        ) : null}
      </DialogPrimitiveContent>
    </DialogPrimitivePortal>
  );
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="dd-dialog-header">{children}</div>;
}

export function DialogTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitiveTitle className={clsx("dd-dialog-title", className)}>
      {children}
    </DialogPrimitiveTitle>
  );
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitiveDescription
      className={clsx("dd-dialog-description", className)}
    >
      {children}
    </DialogPrimitiveDescription>
  );
}
