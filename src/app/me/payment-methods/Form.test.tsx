import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PaymentMethodsForm } from "./Form";

// Stub the server action — we only need to know what FormData was submitted.
const upsertSpy = vi.fn<(fd: FormData) => Promise<{ ok: true }>>(async () => ({
  ok: true,
}));
vi.mock("../actions", () => ({
  upsertPayerAction: (fd: FormData) => upsertSpy(fd),
}));

describe("PaymentMethodsForm", () => {
  it("renders US fields by default and hides India fields", () => {
    render(<PaymentMethodsForm initial={null} />);
    expect(screen.getByPlaceholderText("your-venmo-handle")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("yourcashtag")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("phone or email")).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("yourname@oksbi")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText("+91XXXXXXXXXX")
    ).not.toBeInTheDocument();
  });

  it("swaps to India fields when India is selected", async () => {
    const user = userEvent.setup();
    render(<PaymentMethodsForm initial={null} />);

    await user.click(screen.getByRole("radio", { name: /India/i }));

    expect(
      screen.queryByPlaceholderText("your-venmo-handle")
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("yourname@oksbi")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+91XXXXXXXXXX")).toBeInTheDocument();
  });

  it("submits with country=IN and the UPI id when India is selected", async () => {
    const user = userEvent.setup();
    upsertSpy.mockClear();
    render(<PaymentMethodsForm initial={null} />);

    await user.type(screen.getByPlaceholderText("Your name"), "Jishnu");
    await user.click(screen.getByRole("radio", { name: /India/i }));
    await user.type(
      screen.getByPlaceholderText("yourname@oksbi"),
      "jishnu@oksbi"
    );
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const fd = upsertSpy.mock.calls[0]![0];
    expect(fd.get("country")).toBe("IN");
    expect(fd.get("upi_id")).toBe("jishnu@oksbi");
    expect(fd.get("display_name")).toBe("Jishnu");
  });

  it("pre-selects India when initial.country = 'IN'", () => {
    render(
      <PaymentMethodsForm
        initial={{
          display_name: "Existing",
          country: "IN",
          upi_id: "x@y",
          paytm_phone: null,
          venmo_handle: null,
          zelle_contact: null,
          cashapp_handle: null,
        }}
      />
    );
    expect(screen.getByRole("radio", { name: /India/i })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByPlaceholderText("yourname@oksbi")).toHaveValue("x@y");
  });
});
