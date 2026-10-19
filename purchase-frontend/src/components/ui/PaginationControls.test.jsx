import React, { useState } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import PaginationControls from "./PaginationControls";

test("top and bottom controls share current page, including the jump selector", () => {
  function Pair() {
    const [page, setPage] = useState(1);
    return (
      <>
        <PaginationControls
          currentPage={page}
          totalPages={108}
          onPageChange={setPage}
          ariaLabel="Top pages"
        />
        <PaginationControls
          currentPage={page}
          totalPages={108}
          onPageChange={setPage}
          ariaLabel="Bottom pages"
        />
      </>
    );
  }
  render(<Pair />);
  const top = within(screen.getByRole("navigation", { name: "Top pages" }));
  const bottom = within(
    screen.getByRole("navigation", { name: "Bottom pages" }),
  );
  expect(top.getByRole("button", { name: "Prev" })).toBeDisabled();
  fireEvent.click(top.getByRole("button", { name: "2" }));
  expect(bottom.getByRole("button", { name: "2" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(bottom.getByRole("combobox")).toHaveValue("2");
  fireEvent.change(bottom.getByRole("combobox"), { target: { value: "108" } });
  expect(top.getByRole("button", { name: "108" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(top.getByRole("button", { name: "Next" })).toBeDisabled();
  expect(top.getByText("Page 108 of 108")).toBeInTheDocument();
});
test("large page ranges use ellipses and current-page clicks do not refetch", () => {
  const change = jest.fn();
  render(
    <PaginationControls
      currentPage={54}
      totalPages={108}
      onPageChange={change}
    />,
  );
  expect(screen.getByRole("button", { name: "53" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "55" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "30" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "54" }));
  expect(change).not.toHaveBeenCalled();
});
test("loading disables buttons and page selection", () => {
  render(
    <PaginationControls
      currentPage={2}
      totalPages={3}
      disabled
      onPageChange={jest.fn()}
    />,
  );
  screen
    .getAllByRole("button")
    .forEach((button) => expect(button).toBeDisabled());
  expect(screen.getByRole("combobox")).toBeDisabled();
});
test("single or empty page lists do not expose navigation", () => {
  const { rerender } = render(
    <PaginationControls
      currentPage={1}
      totalPages={1}
      onPageChange={jest.fn()}
    />,
  );
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  rerender(
    <PaginationControls
      currentPage={1}
      totalPages={0}
      onPageChange={jest.fn()}
    />,
  );
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
});
