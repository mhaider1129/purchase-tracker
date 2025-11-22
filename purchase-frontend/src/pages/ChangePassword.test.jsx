import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChangePassword from './ChangePassword';
import '../i18n';

jest.mock('../api/auth', () => ({
  changePassword: jest.fn(),
}));

const mockedChangePassword = require('../api/auth').changePassword;

describe('ChangePassword page', () => {
  beforeEach(() => {
    mockedChangePassword.mockReset();
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <ChangePassword />
      </MemoryRouter>
    );

  it('provides a navigation link back to the main page', () => {
    renderPage();

    expect(
      screen.getByRole('link', { name: /return to main page/i })
    ).toBeInTheDocument();
  });

  it('shows validation message when form is submitted empty', async () => {
    renderPage();

    const submitButton = screen.getByRole('button', {
      name: /update password/i,
    });
    fireEvent.click(submitButton);

    expect(
      await screen.findByText(/all password fields are required/i)
    ).toBeInTheDocument();
    expect(mockedChangePassword).not.toHaveBeenCalled();
  });

  it('submits valid payload and shows success message', async () => {
    mockedChangePassword.mockResolvedValue({
      message: 'Password updated successfully',
    });
    renderPage();

    fireEvent.change(
      screen.getByLabelText(/current password/i),
      { target: { value: 'oldPassword123' } }
    );

    // 🔧 Disambiguated selector here:
    fireEvent.change(
      screen.getByLabelText(/^New password$/i),
      { target: { value: 'newPassword123' } }
);

    fireEvent.change(
      screen.getByLabelText(/confirm new password/i),
      { target: { value: 'newPassword123' } }
    );

    fireEvent.click(
      screen.getByRole('button', { name: /update password/i })
    );

    await waitFor(() =>
      expect(mockedChangePassword).toHaveBeenCalledWith({
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123',
      })
    );

    expect(
      await screen.findByText(/password updated successfully/i)
    ).toBeInTheDocument();
  });
});