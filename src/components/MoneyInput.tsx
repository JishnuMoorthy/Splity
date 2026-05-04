"use client";

import { useEffect, useRef, useState } from "react";
import { centsToDollarString, dollarsToCents } from "@/lib/money";

const VALID = /^\d*(\.\d{0,2})?$/;

export type MoneyInputProps = {
  cents: number;
  onChange: (cents: number) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
};

export function MoneyInput({
  cents,
  onChange,
  placeholder = "0.00",
  className,
  autoFocus,
  "aria-label": ariaLabel,
}: MoneyInputProps) {
  const [text, setText] = useState(() => centsToDollarString(cents));
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    setText(centsToDollarString(cents));
  }, [cents]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    if (next !== "" && !VALID.test(next)) return;
    setText(next);
    onChange(next === "" || next === "." ? 0 : dollarsToCents(next));
  }

  function handleBlur() {
    focused.current = false;
    if (text === "" || text === ".") {
      setText("");
      onChange(0);
      return;
    }
    const normalized = centsToDollarString(dollarsToCents(text));
    setText(normalized);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    focused.current = true;
    e.currentTarget.select();
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      autoFocus={autoFocus}
      aria-label={ariaLabel}
    />
  );
}
