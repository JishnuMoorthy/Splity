import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ItemUnitsPicker } from "./ItemUnitsPicker";

describe("ItemUnitsPicker — multi-quantity (stepper)", () => {
  it("renders a stepper that shows current units of total", () => {
    render(<ItemUnitsPicker quantity={5} units={2} onChange={() => {}} />);
    expect(screen.getByText("2 of 5")).toBeInTheDocument();
  });

  it("increments and decrements on +/- clicks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ItemUnitsPicker quantity={5} units={2} onChange={onChange} />);
    await user.click(screen.getByLabelText("Increase"));
    expect(onChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByLabelText("Decrease"));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("clamps + at quantity", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ItemUnitsPicker quantity={5} units={5} onChange={onChange} />);
    expect(screen.getByLabelText("Increase")).toBeDisabled();
    await user.click(screen.getByLabelText("Decrease"));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("respects `max` cap (e.g. when other claimers took some)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ItemUnitsPicker quantity={5} units={3} max={3} onChange={onChange} />
    );
    expect(screen.getByLabelText("Increase")).toBeDisabled();
  });

  it("clamps - at zero", () => {
    render(<ItemUnitsPicker quantity={5} units={0} onChange={() => {}} />);
    expect(screen.getByLabelText("Decrease")).toBeDisabled();
  });
});

describe("ItemUnitsPicker — single-quantity (percentage)", () => {
  it("renders 0/25/50/75/100 % radios", () => {
    render(<ItemUnitsPicker quantity={1} units={0.5} onChange={() => {}} />);
    for (const pct of ["0%", "25%", "50%", "75%", "100%"]) {
      expect(screen.getByRole("radio", { name: pct })).toBeInTheDocument();
    }
  });

  it("marks the matching percent as checked", () => {
    render(<ItemUnitsPicker quantity={1} units={0.75} onChange={() => {}} />);
    expect(
      screen.getByRole("radio", { name: "75%" })
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("radio", { name: "50%" })
    ).toHaveAttribute("aria-checked", "false");
  });

  it("emits fractional units on click (25% → 0.25)", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ItemUnitsPicker quantity={1} units={0} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "25%" }));
    expect(onChange).toHaveBeenCalledWith(0.25);
  });

  it("100% emits exactly 1", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ItemUnitsPicker quantity={1} units={0} onChange={onChange} />);
    await user.click(screen.getByRole("radio", { name: "100%" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
