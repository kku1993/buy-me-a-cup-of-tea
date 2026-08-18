import type { HTMLAttributes } from "react";
import clsx from "clsx";

export type AlertVariant = "default" | "destructive";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

/** A small inline alert/banner. */
export function Alert({ variant = "default", className, ...rest }: AlertProps) {
  return (
    <div
      role="alert"
      className={clsx(
        "dd-alert",
        variant === "destructive" && "dd-alert-destructive",
        className,
      )}
      {...rest}
    />
  );
}
