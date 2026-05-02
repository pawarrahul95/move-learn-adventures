// Big chunky kid-friendly button with cartoon shadow.
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "sunny" | "grass" | "sky" | "berry" | "white";
type Size = "md" | "lg" | "xl";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground",
  sunny: "bg-sunny text-sunny-foreground",
  grass: "bg-grass text-grass-foreground",
  sky: "bg-sky text-sky-foreground",
  berry: "bg-berry text-berry-foreground",
  white: "bg-white text-primary",
};
const sizes: Record<Size, string> = {
  md: "px-6 py-3 text-lg rounded-2xl",
  lg: "px-8 py-4 text-2xl rounded-3xl",
  xl: "px-10 py-6 text-3xl rounded-4xl",
};

export const KidButton = forwardRef<HTMLButtonElement, Props>(function KidButton(
  { className, variant = "primary", size = "lg", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "font-bold shadow-cartoon transition-transform duration-150 active:translate-y-1 active:shadow-pop hover:scale-[1.03] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
});
