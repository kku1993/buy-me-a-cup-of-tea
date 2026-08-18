import { forwardRef, type ButtonHTMLAttributes } from "react";
import clsx from "clsx";

export type ButtonVariant =
  | "default"
  | "outline"
  | "ghost"
  | "destructive"
  | "settings-link"
  | "settings-action";
export type ButtonSize = "default" | "sm" | "icon" | "icon-sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClass: Record<ButtonVariant, string> = {
  default: "dd-btn dd-btn-default",
  outline: "dd-btn dd-btn-outline",
  ghost: "dd-btn dd-btn-ghost",
  destructive: "dd-btn dd-btn-destructive",
  "settings-link": "dd-btn dd-btn-link",
  "settings-action": "dd-btn dd-btn-default dd-btn-block",
};

const sizeClass: Record<ButtonSize, string> = {
  default: "dd-btn-md",
  sm: "dd-btn-sm",
  icon: "dd-btn-icon",
  "icon-sm": "dd-btn-icon-sm",
};

/** A small styled button primitive backed by plain HTML (the donate dialog
 *  only needs a clickable, focusable, disabled-aware button — no menu/popover
 *  semantics — so Radix isn't required here). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "default", size = "default", className, type, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={clsx(variantClass[variant], sizeClass[size], className)}
        {...rest}
      />
    );
  },
);
