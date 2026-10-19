import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RequestViewModeToggle from "./RequestViewModeToggle";
test("switches the pressed state while preserving custom labels", () => {
  function Toggle() {
    const [mode, setMode] = useState("detailed");
    return (
      <RequestViewModeToggle
        value={mode}
        onChange={setMode}
        detailedLabel="تفصيلي"
        summaryLabel="ملخص"
      />
    );
  }
  render(<Toggle />);
  expect(screen.getByRole("button", { name: "تفصيلي" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "ملخص" }));
  expect(screen.getByRole("button", { name: "ملخص" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByRole("button", { name: "تفصيلي" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
