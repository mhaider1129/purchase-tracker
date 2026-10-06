import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
  waitFor,
} from "@testing-library/react";
import MedicalDeviceRequestForm from "./MedicalDeviceRequestForm";
import api from "../../api/axios";
const mockNavigate = jest.fn();
const mockUser = {
  id: 7,
  department_id: 3,
  department_name: "Supply Chain",
  section_id: 9,
  permissions: [],
};
jest.mock("react-router-dom", () => ({ useNavigate: () => mockNavigate }));
jest.mock("../../hooks/useCurrentUser", () => ({
  __esModule: true,
  default: () => ({ user: mockUser, loading: false }),
}));
jest.mock("../../api/axios", () => ({ post: jest.fn() }));
jest.mock("react-i18next", () => {
  const en = require("../../locales/en.json");
  const t = (key, options = {}) => {
    const value =
      key.split(".").reduce((data, part) => data?.[part], en) ||
      options.defaultValue ||
      key;
    return String(value).replace(
      /{{(\w+)}}/g,
      (_, name) => options[name] ?? "",
    );
  };
  return { useTranslation: () => ({ t }) };
});
jest.mock("../../components/projects/ProjectSelector", () => () => null);
jest.mock("../../components/ui/HelpTooltip", () => ({
  HelpTooltip: () => null,
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(window, "confirm").mockReturnValue(true);
  jest.spyOn(window, "alert").mockImplementation(() => {});
  api.post.mockResolvedValue({ data: { request_id: 99 } });
});
afterEach(() => jest.restoreAllMocks());
test("overview totals and device actions stay synchronized", () => {
  render(<MedicalDeviceRequestForm />);
  const first = within(screen.getByRole("region", { name: "Device 1" }));
  fireEvent.change(first.getByLabelText("Quantity*"), {
    target: { value: "3" },
  });
  fireEvent.change(first.getByLabelText("Unit cost*"), {
    target: { value: "100" },
  });
  const overview = within(
    screen.getByRole("region", { name: "Request overview" }),
  );
  expect(overview.getByText("3")).toBeInTheDocument();
  expect(overview.getByText("≈ 300.00")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "+ Add another device" }));
  expect(screen.getByRole("region", { name: "Device 2" })).toBeInTheDocument();
  expect(overview.getByText("4")).toBeInTheDocument();
  const second = within(screen.getByRole("region", { name: "Device 2" }));
  fireEvent.click(second.getByRole("button", { name: /Remove Device/ }));
  expect(
    screen.queryByRole("region", { name: "Device 2" }),
  ).not.toBeInTheDocument();
  expect(overview.getByText("3")).toBeInTheDocument();
});
test("device fields and attachments retain the medical request submission contract", async () => {
  render(<MedicalDeviceRequestForm />);
  fireEvent.change(screen.getByLabelText("Justification"), {
    target: { value: "Improve clinical services" },
  });
  const first = within(screen.getByRole("region", { name: "Device 1" }));
  fireEvent.change(first.getByLabelText("Device name*"), {
    target: { value: "Ultrasound" },
  });
  fireEvent.change(first.getByLabelText("Technical specifications"), {
    target: { value: "Portable\nThree year warranty" },
  });
  fireEvent.change(first.getByLabelText("Purchase type*"), {
    target: { value: "Replacement" },
  });
  const file = new File(["specifications"], "specs.pdf", {
    type: "application/pdf",
  });
  fireEvent.change(first.getByLabelText("Supporting documents"), {
    target: { files: [file] },
  });
  fireEvent.submit(
    screen.getByRole("form", { name: "Medical Device Request Form" }),
  );
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const [url, payload] = api.post.mock.calls[0];
  expect(url).toBe("/requests");
  expect(payload.get("request_type")).toBe("Medical Device");
  expect(payload.get("target_department_id")).toBe("3");
  expect(payload.get("target_section_id")).toBe("9");
  expect(JSON.parse(payload.get("items"))[0]).toMatchObject({
    item_name: "Ultrasound",
    specs: "Portable\nThree year warranty",
    purchase_type: "Replacement",
    quantity: 1,
    unit_cost: 0,
  });
  expect(payload.get("item_0")).toEqual(file);
  await waitFor(() =>
    expect(mockNavigate).toHaveBeenCalledWith(
      "/request-submitted",
      expect.anything(),
    ),
  );
});
test("invalid device fields stay visibly associated with their errors", () => {
  render(<MedicalDeviceRequestForm />);
  fireEvent.change(screen.getByLabelText("Justification"), {
    target: { value: "Needed" },
  });
  fireEvent.submit(
    screen.getByRole("form", { name: "Medical Device Request Form" }),
  );
  expect(screen.getByLabelText("Device name*")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Item name is required.");
  expect(api.post).not.toHaveBeenCalled();
});
test("unsupported attachments stay rejected", () => {
  render(<MedicalDeviceRequestForm />);
  fireEvent.change(screen.getByLabelText("Supporting documents"), {
    target: { files: [new File(["bad"], "script.exe")] },
  });
  expect(screen.getByText(/Unsupported file type/)).toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
