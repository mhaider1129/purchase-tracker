import React from "react";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18n from "../i18n";
import ContractFinancialHistoryNotice from "./ContractFinancialHistoryNotice";

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});
test("history notice gives the supported AP path without offering a payment writer", async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
  render(
    <MemoryRouter>
      <ContractFinancialHistoryNotice />
    </MemoryRouter>,
  );
  expect(screen.getByRole("note")).toHaveTextContent("read-only");
  expect(screen.getByRole("note")).toHaveTextContent(
    "Do not recreate an already settled obligation",
  );
  expect(
    screen.getByRole("link", { name: "Open Accounts Payable" }),
  ).toHaveAttribute("href", "/procure-to-pay/accounts-payable");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
test("Arabic mode presents the same financial restriction and replacement", async () => {
  await act(async () => {
    await i18n.changeLanguage("ar");
  });
  render(
    <MemoryRouter>
      <ContractFinancialHistoryNotice />
    </MemoryRouter>,
  );
  expect(screen.getByRole("note")).toHaveTextContent("متاح للقراءة فقط");
  expect(
    screen.getByRole("link", { name: "فتح الذمم الدائنة" }),
  ).toHaveAttribute("href", "/procure-to-pay/accounts-payable");
});
