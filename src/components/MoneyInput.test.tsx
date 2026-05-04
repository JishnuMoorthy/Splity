import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MoneyInput } from "./MoneyInput";

function Harness({
  initial = 0,
  onCents,
}: {
  initial?: number;
  onCents?: (c: number) => void;
}) {
  const [cents, setCents] = useState(initial);
  return (
    <MoneyInput
      cents={cents}
      onChange={(c) => {
        setCents(c);
        onCents?.(c);
      }}
      aria-label="amount"
    />
  );
}

describe("MoneyInput", () => {
  it("does not pad to .00 mid-typing", async () => {
    const user = userEvent.setup();
    const onCents = vi.fn();
    render(<Harness onCents={onCents} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;

    await user.click(input);
    await user.keyboard("1");
    expect(input.value).toBe("1");
    await user.keyboard("2");
    expect(input.value).toBe("12");
    await user.keyboard(".");
    expect(input.value).toBe("12.");
    await user.keyboard("5");
    expect(input.value).toBe("12.5");
    await user.keyboard("0");
    expect(input.value).toBe("12.50");

    expect(onCents).toHaveBeenLastCalledWith(1250);
  });

  it("rejects a third decimal digit", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    await user.click(input);
    await user.type(input, "1.99");
    expect(input.value).toBe("1.99");
    await user.keyboard("9");
    expect(input.value).toBe("1.99");
  });

  it("rejects letters and stray characters", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    await user.click(input);
    await user.type(input, "abc1.5xyz");
    expect(input.value).toBe("1.5");
  });

  it("accepts a leading decimal point", async () => {
    const user = userEvent.setup();
    const onCents = vi.fn();
    render(<Harness onCents={onCents} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    await user.click(input);
    await user.keyboard(".");
    expect(input.value).toBe(".");
    await user.keyboard("5");
    expect(input.value).toBe(".5");
    expect(onCents).toHaveBeenLastCalledWith(50);
  });

  it("normalizes on blur and reflects parent state", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    await user.click(input);
    await user.keyboard("3");
    await user.tab();
    expect(input.value).toBe("3.00");
  });

  it("blank field on blur normalizes to empty (cents=0)", async () => {
    const user = userEvent.setup();
    const onCents = vi.fn();
    render(<Harness initial={500} onCents={onCents} />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    expect(input.value).toBe("5.00");
    await user.click(input);
    await user.clear(input);
    await user.tab();
    expect(input.value).toBe("");
    expect(onCents).toHaveBeenLastCalledWith(0);
  });

  it("syncs to parent cents updates while not focused", async () => {
    function ExternalUpdate() {
      const [cents, setCents] = useState(0);
      return (
        <>
          <MoneyInput
            cents={cents}
            onChange={setCents}
            aria-label="amount"
          />
          <button onClick={() => setCents(2599)}>set</button>
        </>
      );
    }
    const user = userEvent.setup();
    render(<ExternalUpdate />);
    const input = screen.getByLabelText("amount") as HTMLInputElement;
    expect(input.value).toBe("");
    await user.click(screen.getByText("set"));
    expect(input.value).toBe("25.99");
  });
});
