import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import i18n from "../../i18n";
import RequestTimeline, { filterTimeline } from "./RequestTimeline";

const events = [
  {
    id: "a",
    event_type: "approval",
    title: "Pending by SCM",
    status: "Pending",
    description: "Review equipment",
    actor_name: "Ahmed",
    event_time: "2026-10-01T09:00:00Z",
  },
  {
    id: "b",
    event_type: "approval",
    title: "Approved by HOD",
    status: "Approved",
    actor_name: "Sara",
    event_time: "2026-10-02T09:00:00Z",
  },
  {
    id: "c",
    event_type: "audit",
    title: "Request edited",
    description: "Updated specification",
    event_time: null,
  },
  {
    id: "d",
    event_type: "procurement",
    title: "Quote rejected",
    status: "Rejected",
    actor_name: "Ahmed",
    event_time: "2026-10-03T09:00:00Z",
  },
];
beforeEach(async () => {
  await i18n.changeLanguage("en");
});

test("timeline search and filters retain recorded status, description and actor", () => {
  render(<RequestTimeline events={events} />);
  expect(screen.getByRole("status")).toHaveTextContent("Showing 4 of 4 events");
  fireEvent.change(screen.getByLabelText("Search history"), {
    target: { value: "Ahmed equipment" },
  });
  expect(screen.getByText("Pending by SCM")).toBeInTheDocument();
  expect(screen.queryByText("Quote rejected")).not.toBeInTheDocument();
  expect(screen.getByText("Review equipment")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  fireEvent.change(screen.getByLabelText("Event type"), {
    target: { value: "approval" },
  });
  fireEvent.change(screen.getByLabelText("Status"), {
    target: { value: "Approved" },
  });
  expect(screen.getByText("Approved by HOD")).toBeInTheDocument();
  expect(screen.queryByText("Pending by SCM")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Showing 1 of 4 events");
});

test("timeline orders dated events and keeps unavailable dates at the end", () => {
  render(<RequestTimeline events={events} />);
  const rows = () => within(screen.getByRole("list")).getAllByRole("listitem");
  expect(rows()[0]).toHaveTextContent("Quote rejected");
  expect(rows()[3]).toHaveTextContent("Date not provided");
  expect(rows()[3]).toHaveTextContent("System");
  fireEvent.change(screen.getByLabelText("Order"), {
    target: { value: "oldest" },
  });
  expect(rows()[0]).toHaveTextContent("Pending by SCM");
  expect(rows()[3]).toHaveTextContent("Request edited");
});

test("no-match state can be cleared and empty histories omit filters", () => {
  const { rerender } = render(<RequestTimeline events={events} />);
  fireEvent.change(screen.getByLabelText("Search history"), {
    target: { value: "missing" },
  });
  expect(screen.getByText(/No events match/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByRole("list")).toBeInTheDocument();
  rerender(<RequestTimeline events={[]} />);
  expect(screen.getByText("No timeline events found.")).toBeInTheDocument();
  expect(screen.queryByLabelText("Search history")).not.toBeInTheDocument();
});

test("filtering preserves the source array and stable order for ties or unknown dates", () => {
  const tied = [
    ...events,
    {
      id: "e",
      event_type: "request",
      title: "Same time",
      event_time: events[0].event_time,
    },
    { id: "f", event_time: "invalid" },
  ];
  expect(
    filterTimeline(tied, { sort: "oldest" }).map((event) => event.id),
  ).toEqual(["a", "e", "b", "d", "c", "f"]);
  expect(tied.map((event) => event.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
  expect(
    filterTimeline(tied, {
      query: "Sara",
      status: "Approved",
      type: "approval",
    }),
  ).toEqual([events[1]]);
});

test("Arabic controls use application translations and preserve server event content", async () => {
  await i18n.changeLanguage("ar");
  const { container } = render(<RequestTimeline events={events} />);
  expect(
    screen.getByRole("heading", { name: "السجل الزمني للطلب" }),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("البحث في السجل"), {
    target: { value: "Sara" },
  });
  expect(screen.getByText("Approved by HOD")).toBeInTheDocument();
  expect(container.textContent).not.toContain("requestTimeline.");
});
