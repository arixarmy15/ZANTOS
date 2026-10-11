import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-sm border font-medium whitespace-nowrap",
    "transition-control press cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary:
          "border-harbor bg-harbor text-paper hover:border-harbor-strong hover:bg-harbor-strong",
        secondary: "border-control-border bg-paper text-carbon hover:bg-ledger",
        ghost: "border-transparent bg-transparent text-carbon hover:bg-ledger",
        destructive: "border-error-fg bg-paper text-error-fg hover:bg-error-bg",
        "destructive-solid":
          "border-error-fg bg-error-fg text-paper hover:border-error-mark hover:bg-error-mark",
      },
      size: {
        sm: "h-7 px-2.5 text-small",
        md: "h-9 px-3.5 text-body",
        lg: "h-11 px-4 text-body",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...(asChild ? {} : { type: "button" })}
      {...props}
    />
  );
}
