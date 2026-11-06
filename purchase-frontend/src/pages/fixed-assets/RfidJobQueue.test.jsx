import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RfidJobQueue from "./RfidJobQueue";
import RfidOperations from "./RfidOperations";
import { fixedAssetsApi as api } from "../../api/fixedAssets";
jest.mock("../../api/fixedAssets", () => ({
  fixedAssetsApi: { rfid: jest.fn(), recoverRfidJob: jest.fn() },
}));
beforeEach(() => {
  jest.clearAllMocks();
  api.rfid.mockResolvedValue({ data: [], pagination: { total: 0 } });
  api.recoverRfidJob.mockResolvedValue({ changed: true });
});
test("requires a reason and recovers only the chosen failed read", async () => {
  api.rfid.mockResolvedValue({
    data: [
      {
        id: 7,
        processing_status: "FAILED",
        processing_attempts: 1,
        processing_error_code: "DATABASE_INTERRUPTION",
        processing_recovery_count: 0,
        recovery_status: "NOT_RECOVERED",
      },
    ],
  });
  render(<RfidJobQueue />);
  const button = await screen.findByRole("button", { name: "Recover" });
  expect(button).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText("RFID recovery reason"),
    "Reviewed database outage",
  );
  await userEvent.click(button);
  await waitFor(() =>
    expect(api.recoverRfidJob).toHaveBeenCalledWith(
      7,
      "Reviewed database outage",
    ),
  );
  expect(screen.getByText("DATABASE_INTERRUPTION")).toBeInTheDocument();
});
test("terminal exhausted jobs remain visible without an automatic retry action", async () => {
  api.rfid.mockResolvedValue({
    data: [
      {
        id: 8,
        processing_status: "DEAD_LETTER",
        processing_attempts: 5,
        processing_error_code: "PROCESSING_FAILED",
        processing_recovery_count: 2,
        recovery_status: "RECOVERED",
      },
    ],
  });
  render(<RfidJobQueue />);
  expect(
    await screen.findByRole("cell", { name: "DEAD_LETTER" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Recover" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/5\s*\/\s*5/)).toBeInTheDocument();
});
test("ordinary RFID viewers do not load the privileged processing queue", async () => {
  render(
    <RfidOperations resource="events" user={{ permissions: ["rfid.view"] }} />,
  );
  await waitFor(() =>
    expect(api.rfid).toHaveBeenCalledWith("events", expect.any(Object)),
  );
  expect(
    screen.queryByLabelText("RFID processing jobs"),
  ).not.toBeInTheDocument();
  expect(api.rfid.mock.calls.some(([resource]) => resource === "jobs")).toBe(
    false,
  );
});
