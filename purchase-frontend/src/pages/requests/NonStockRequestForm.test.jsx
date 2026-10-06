import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NonStockRequestForm from "./NonStockRequestForm";
import api from "../../api/axios";
const mockNavigate = jest.fn();
const mockUser = {
  id: 7,
  department_id: 3,
  department_name: "Supply Chain",
  section_name: null,
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
      key.split(".").reduce((data, part) => data?.[part], en) || key;
    return String(value).replace(
      /{{(\w+)}}/g,
      (_, name) => options[name] ?? "",
    );
  };
  return { useTranslation: () => ({ t }) };
});
jest.mock("../../components/projects/ProjectSelector", () => () => null);
jest.mock(
  "../../components/requests/RequestItemIdentityFields",
  () => () => null,
);
jest.mock("../../components/ui/HelpTooltip", () => ({
  HelpTooltip: () => null,
}));
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  jest.spyOn(window, "confirm").mockReturnValue(true);
  jest.spyOn(window, "alert").mockImplementation(() => {});
  HTMLElement.prototype.scrollIntoView = jest.fn();
  api.post.mockResolvedValue({ data: { request_id: 99 } });
});
afterEach(() => jest.restoreAllMocks());
test("item actions retain values and update the line count", async () => {
  render(<NonStockRequestForm />);
  fireEvent.change(screen.getByRole("textbox", { name: "Item 1 Name" }), {
    target: { value: "Monitor" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Duplicate line" }));
  expect(screen.getByText("2 / 50 item lines")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Item 2 Name" })).toHaveValue(
    "Monitor",
  );
  fireEvent.click(screen.getAllByRole("button", { name: "Remove line" })[1]);
  expect(screen.getByText("1 / 50 item lines")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "+ Add Another Item" }));
  expect(screen.getByText("2 / 50 item lines")).toBeInTheDocument();
});
test("multiline specifications and attachments retain the existing submission contract", async () => {
  render(<NonStockRequestForm />);
  fireEvent.change(screen.getByLabelText("Justification"), {
    target: { value: "Replace broken equipment" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Item 1 Name" }), {
    target: { value: "Monitor" },
  });
  fireEvent.change(
    screen.getByRole("textbox", { name: "Item 1 Intended Use" }),
    { target: { value: "Workstation" } },
  );
  const specs = screen.getByRole("textbox", { name: "Item 1 Specs" });
  expect(specs.tagName).toBe("TEXTAREA");
  fireEvent.change(specs, {
    target: { value: "27 inch display\nThree year warranty" },
  });
  const file = new File(["specifications"], "specs.pdf", {
    type: "application/pdf",
  });
  fireEvent.change(screen.getByLabelText("Item attachments 1"), {
    target: { files: [file] },
  });
  fireEvent.submit(
    screen.getByRole("form", { name: "Non-Stock Request Form" }),
  );
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  const [url, payload] = api.post.mock.calls[0];
  expect(url).toBe("/requests");
  expect(payload.get("request_type")).toBe("Non-Stock");
  expect(payload.get("target_department_id")).toBe("3");
  expect(JSON.parse(payload.get("items"))[0]).toMatchObject({
    item_name: "Monitor",
    specs: "27 inch display\nThree year warranty",
    quantity: 1,
    request_mode: "free_text",
  });
  expect(payload.get("item_0")).toEqual(file);
  await waitFor(() =>
    expect(mockNavigate).toHaveBeenCalledWith(
      "/request-submitted",
      expect.anything(),
    ),
  );
});
test("incomplete item details still block submission", () => {
  render(<NonStockRequestForm />);
  fireEvent.change(screen.getByLabelText("Justification"), {
    target: { value: "Needed" },
  });
  fireEvent.submit(
    screen.getByRole("form", { name: "Non-Stock Request Form" }),
  );
  expect(api.post).not.toHaveBeenCalled();
});
