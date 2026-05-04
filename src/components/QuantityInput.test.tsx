import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuantityInput } from "./QuantityInput";

function Harness({ initial = 1 }: { initial?: number } = {}) {
  const [n, setN] = useState(initial);
  return <QuantityInput value={n} onChange={setN} aria-label="qty" />;
}

describe("QuantityInput", () => {
  it("allows backspace to empty while focused", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;
    await user.click(input);
    await user.clear(input);
    expect(input.value).toBe("");
  });

  it("snaps to min on blur if empty", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;
    await user.click(input);
    await user.clear(input);
    await user.tab();
    expect(input.value).toBe("1");
  });

  it("rejects non-digit characters", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;
    await user.click(input);
    await user.clear(input);
    await user.type(input, "1a2.5");
    expect(input.value).toBe("125");
  });

  it("clears then types multi-digit value", async () => {
    const user = userEvent.setup();
    const Spy = () => {
      const [n, setN] = useState(1);
      return (
        <>
          <QuantityInput value={n} onChange={setN} aria-label="qty" />
          <output aria-label="state">{n}</output>
        </>
      );
    };
    render(<Spy />);
    const input = screen.getByLabelText("qty") as HTMLInputElement;
    const out = screen.getByLabelText("state");
    await user.click(input);
    await user.clear(input);
    await user.type(input, "15");
    expect(input.value).toBe("15");
    expect(out.textContent).toBe("15");
  });
});
