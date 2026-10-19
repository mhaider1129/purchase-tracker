import React from "react";
import { render, screen, act } from "@testing-library/react";
import i18n from "../../i18n";
import UrgentRequestBadge from "./UrgentRequestBadge";
test("urgency is conveyed with text in both languages, and omitted for normal requests", async () => {
  await i18n.changeLanguage("en");
  const { rerender } = render(<UrgentRequestBadge urgent={false} />);
  expect(screen.queryByText("Urgent")).not.toBeInTheDocument();
  rerender(<UrgentRequestBadge urgent />);
  expect(screen.getByText("Urgent")).toBeInTheDocument();
  await act(async () => {
    await i18n.changeLanguage("ar");
  });
  expect(screen.getByText("عاجل")).toBeInTheDocument();
});
