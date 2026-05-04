"use client";

import { useEffect, useRef, useState } from "react";

const VALID = /^\d*$/;

export type QuantityInputProps = {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  className?: string;
  "aria-label"?: string;
};

export function QuantityInput({
  value,
  onChange,
  min = 1,
  className,
  "aria-label": ariaLabel,
}: QuantityInputProps) {
  const [text, setText] = useState(() => String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (focused.current) return;
    setText(String(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    if (next !== "" && !VALID.test(next)) return;
    setText(next);
    if (next === "") return;
    const n = parseInt(next, 10);
    if (Number.isFinite(n) && n >= min) onChange(n);
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    focused.current = true;
    e.currentTarget.select();
  }

  function handleBlur() {
    focused.current = false;
    const n = parseInt(text, 10);
    if (!Number.isFinite(n) || n < min) {
      setText(String(min));
      onChange(min);
    } else {
      setText(String(n));
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={text}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
