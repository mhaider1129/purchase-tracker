import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Navbar from "./Navbar";
import { useAuth } from "../hooks/useAuth";

jest.mock("../hooks/useAuth", () => ({ useAuth: jest.fn() }));
jest.mock("../hooks/useAccessControl", () => ({
  useAccessControl: () => ({ hasAccess: () => false }),
}));
jest.mock("../hooks/useDarkMode", () => () => [false, jest.fn()]);
jest.mock("../theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "default", themes: [] }),
}));
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
    i18n: { language: "en", changeLanguage: jest.fn() },
  }),
}));
jest.mock("./ui/NotificationBell", () => () => null);
const user = (permissions) => ({
  name: "Test User",
  role: "requester",
  permissions,
});
const renderNav = (permissions) => {
  useAuth.mockReturnValue({
    user: user(permissions),
    logout: jest.fn(),
    isLoading: false,
  });
  return render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
};

test("AI navigation is hidden without permission", () => {
  renderNav([]);
  expect(screen.queryByText("AI Assistant")).not.toBeInTheDocument();
});
test("AI navigation is visible with permission", () => {
  renderNav(["ai-intelligence.use"]);
  expect(screen.getAllByText("AI Assistant").length).toBeGreaterThan(0);
});