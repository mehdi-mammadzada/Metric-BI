import * as React from "react";
import { cn } from "@/lib/utils";

interface WeightInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type" | "min" | "max" | "step"> {
  value: number | string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

/**
 * Standart "Çəki (%)" numeric input.
 * - Yalnız rəqəm qəbul edir (0-9)
 * - Fokus alanda mövcud dəyəri seçir, yazarkən ara dəyərləri (məs. 15) daxil etməyə imkan verir
 * - Blur / Enter-də min/max intervalına klemplənir; boşdursa 0 olur
 */
export const WeightInput = React.forwardRef<HTMLInputElement, WeightInputProps>(
  ({ value, onChange, min = 0, max = 100, className, onFocus, onBlur, onKeyDown, onBeforeInput, ...rest }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [text, setText] = React.useState<string>("");

    const normalize = (v: number | string) =>
      v === undefined || v === null || v === "" ? "" : String(Number(v));

    // Limitdən kənar dəyər yazmağa icazə verilir (validasiya UI-də göstərilir),
    // yalnız 0-100 fiziki hədd tətbiq olunur.
    const clamp = (n: number) => {
      if (Number.isNaN(n)) return 0;
      return Math.max(0, Math.min(100, n));
    };

    const numeric = Number(value);
    const outOfRange = Number.isFinite(numeric) && numeric > 0 && (numeric < min || numeric > max);

    const commit = (raw: string) => {
      if (raw === "") {
        onChange(0);
        return;
      }
      const parsed = parseInt(raw.replace(/[^\d]/g, ""), 10);
      onChange(clamp(parsed));
    };

    const display = isFocused ? text : normalize(value);

    return (
      <input
        ref={ref}
        type="number"
        inputMode="numeric"
        step={1}
        aria-invalid={outOfRange || undefined}
        value={display}
        onFocus={(e) => {
          setIsFocused(true);
          setText(normalize(value));
          e.currentTarget.select();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          commit(text);
          onBlur?.(e);
        }}
        onBeforeInput={(e: any) => {
          const data: string | null = e.data;
          if (data != null && !/^\d+$/.test(data)) {
            e.preventDefault();
          }
          onBeforeInput?.(e);
        }}
        onKeyDown={(e) => {
          if (["e", "E", "+", "-", ".", ","].includes(e.key)) {
            e.preventDefault();
          }
          if (e.key === "Enter") {
            commit(text);
            (e.currentTarget as HTMLInputElement).blur();
          }
          onKeyDown?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^\d]/g, "");
          setText(raw);
        }}
        className={cn(
          "w-full px-2.5 py-1.5 text-sm border rounded bg-background",
          outOfRange ? "border-destructive text-destructive focus:border-destructive" : "border-border",
          " disabled:opacity-60 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className,
        )}
        {...rest}
      />
    );
  },
);
WeightInput.displayName = "WeightInput";
