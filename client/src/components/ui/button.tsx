import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-xs font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#2F3A58] focus-visible:ring-offset-1 aria-invalid:ring-destructive/20 active:scale-[0.99]",
  {
    variants: {
      variant: {
        default: "bg-[#2F3A58] text-white hover:bg-[#242E47] shadow-xs focus-visible:ring-[#2F3A58]",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 shadow-xs focus-visible:ring-destructive",
        outline:
          "border border-border bg-surface text-text shadow-xs hover:bg-[#F2DBD7] hover:border-[#965660] hover:text-[#965660]",
        secondary:
          "bg-[#F2DBD7] text-[#965660] hover:bg-[#EAC9C4] shadow-xs focus-visible:ring-[#2F3A58]",
        ghost:
          "hover:bg-[#F2DBD7] text-text hover:text-[#965660]",
        link: "text-[#965660] underline-offset-4 hover:underline",
        sapphire: "bg-[#2F3A58] text-white hover:bg-[#242E47] shadow-xs focus-visible:ring-[#2F3A58]",
        terracotta: "bg-[#965660] text-white hover:bg-[#7E454E] shadow-xs focus-visible:ring-[#965660]",
        lavender: "bg-[#E4E7F3] text-[#2F3A58] border border-[#D9DDEB] shadow-xs hover:bg-[#F2DBD7] focus-visible:ring-[#2F3A58]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-lg gap-1.5 px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-10 rounded-lg px-6 text-sm has-[>svg]:px-4",
        icon: "size-9 rounded-lg",
        "icon-sm": "size-8 rounded-lg",
        "icon-lg": "size-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
