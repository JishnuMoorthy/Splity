import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillsList, type BillRow } from "./BillsList";

function makeBill(overrides: Partial<BillRow> = {}): BillRow {
  return {
    id: crypto.randomUUID(),
    short_id: "abc123",
    restaurant_name: "Joe's Pizza",
    total_cents: 5000,
    currency: "USD",
    created_at: "2026-05-01T12:00:00Z",
    receipt_path: null,
    claimed_cents: 2500,
    confirmed_cents: 1000,
    ...overrides,
  };
}

const SAMPLE: BillRow[] = [
  makeBill({
    short_id: "aaa111",
    restaurant_name: "Joe's Pizza",
    total_cents: 5000,
    created_at: "2026-05-03T12:00:00Z",
  }),
  makeBill({
    short_id: "bbb222",
    restaurant_name: "Bobs Burgers",
    total_cents: 12000,
    created_at: "2026-05-01T12:00:00Z",
  }),
  makeBill({
    short_id: "ccc333",
    restaurant_name: "Acme Diner",
    total_cents: 800,
    created_at: "2026-05-02T12:00:00Z",
  }),
];

describe("BillsList", () => {
  it("renders empty state when no bills", () => {
    render(<BillsList bills={[]} appUrl="" />);
    expect(screen.getByText(/No bills yet/i)).toBeInTheDocument();
  });

  it("filters by restaurant name (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(<BillsList bills={SAMPLE} appUrl="" />);
    expect(screen.getByText("Joe's Pizza")).toBeInTheDocument();
    expect(screen.getByText("Bobs Burgers")).toBeInTheDocument();
    expect(screen.getByText("Acme Diner")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search bills"), "burger");
    expect(screen.queryByText("Joe's Pizza")).not.toBeInTheDocument();
    expect(screen.getByText("Bobs Burgers")).toBeInTheDocument();
    expect(screen.queryByText("Acme Diner")).not.toBeInTheDocument();
  });

  it("filters by short_id substring", async () => {
    const user = userEvent.setup();
    render(<BillsList bills={SAMPLE} appUrl="" />);
    await user.type(screen.getByLabelText("Search bills"), "ccc");
    expect(screen.getByText("Acme Diner")).toBeInTheDocument();
    expect(screen.queryByText("Joe's Pizza")).not.toBeInTheDocument();
  });

  it("shows 'no match' state when search has no results", async () => {
    const user = userEvent.setup();
    render(<BillsList bills={SAMPLE} appUrl="" />);
    await user.type(screen.getByLabelText("Search bills"), "zzzzzz");
    expect(screen.getByText(/No bills match/i)).toBeInTheDocument();
  });

  it("orders bills correctly under each sort option", async () => {
    const user = userEvent.setup();
    const { container } = render(<BillsList bills={SAMPLE} appUrl="" />);

    function visibleNames(): string[] {
      const cards = container.querySelectorAll(".font-medium.truncate");
      return Array.from(cards).map((c) => c.textContent?.trim() ?? "");
    }

    // Default: date_desc → 5/3, 5/2, 5/1
    expect(visibleNames()).toEqual(["Joe's Pizza", "Acme Diner", "Bobs Burgers"]);

    await user.selectOptions(screen.getByLabelText("Sort bills"), "amount_desc");
    expect(visibleNames()).toEqual(["Bobs Burgers", "Joe's Pizza", "Acme Diner"]);

    await user.selectOptions(screen.getByLabelText("Sort bills"), "amount_asc");
    expect(visibleNames()).toEqual(["Acme Diner", "Joe's Pizza", "Bobs Burgers"]);

    await user.selectOptions(screen.getByLabelText("Sort bills"), "name_asc");
    expect(visibleNames()).toEqual(["Acme Diner", "Bobs Burgers", "Joe's Pizza"]);

    await user.selectOptions(screen.getByLabelText("Sort bills"), "date_asc");
    expect(visibleNames()).toEqual(["Bobs Burgers", "Acme Diner", "Joe's Pizza"]);
  });

  it("renders coverage progress bar with correct percentage", () => {
    render(
      <BillsList
        bills={[
          makeBill({
            total_cents: 10000,
            claimed_cents: 7500,
            confirmed_cents: 2500,
          }),
        ]}
        appUrl=""
      />
    );
    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "75");
    expect(within(screen.getByLabelText("Coverage")).getByText("75%")).toBeInTheDocument();
  });
});
