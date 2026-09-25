import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AppExperience from "./AppExperience";

describe("AppExperience", () => {
  beforeEach(() => {
    window.scrollTo = jest.fn();
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
      writable: true,
    });
  });

  it("announces the current workspace and updates the document title", () => {
    render(
      <MemoryRouter initialEntries={["/warehouse-inventory"]}>
        <AppExperience />
      </MemoryRouter>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Warehouse Inventory page loaded",
    );
    expect(document.title).toBe("Warehouse Inventory · Purchase Tracker");
  });

  it("offers a keyboard-focusable back-to-top action after scrolling", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppExperience />
      </MemoryRouter>,
    );

    window.scrollY = 700;
    fireEvent.scroll(window);

    const button = screen.getByRole("button", { name: "Back to top" });
    expect(button).toHaveClass("back-to-top--visible");
    expect(button).toHaveAttribute("tabindex", "0");

    fireEvent.click(button);
    expect(window.scrollTo).toHaveBeenLastCalledWith({
      top: 0,
      behavior: "smooth",
    });
  });
});