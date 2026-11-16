import { createElement } from "react";
import { render } from "react-email";
import { Text } from "react-email";
import { describe, expect, it } from "vitest";
import { BookingEmailShell } from "../templates/booking-email-shell";

describe("booking email shell", () => {
  it("renders the version-one black-and-red transactional foundation", async () => {
    const html = await render(
      createElement(
        BookingEmailShell,
        {
          preview: "Booking request received",
          eyebrow: "Pending request",
          title: "We received your booking request",
        },
        createElement(Text, null, "Reference MAP-20261116-TEST01")
      )
    );

    expect(html).toContain("MANILA");
    expect(html).toContain("AUTO PROS");
    expect(html).toContain("MAP-20261116-TEST01");
    expect(html).toContain("#E11D2E");
    expect(html).toContain("Asia/Manila");
  });
});

