import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import '../../i18n';
import RequestTypeSelector from './RequestTypeSelector';
import { fetchCurrentUser } from '../../api/currentUser';

jest.mock('../../api/currentUser');

beforeEach(() => {
  localStorage.clear();
  fetchCurrentUser.mockResolvedValue({
    data: {
      role: 'requester',
      department_id: 4,
      department_name: 'Operations',
      section_id: 2,
      warehouse_id: null,
      can_request_medication: false,
    },
  });
});

const renderSelector = () =>
  render(
    <MemoryRouter>
      <RequestTypeSelector />
    </MemoryRouter>
  );

test('saves frequently used workflows as persistent shortcuts', async () => {
  const user = userEvent.setup();
  renderSelector();

  const saveButtons = await screen.findAllByRole('button', {
    name: 'Save Non-Stock Request to shortcuts',
  });
  await user.click(saveButtons[0]);

  expect(screen.getByRole('heading', { name: 'Saved workflows' })).toBeInTheDocument();
  expect(localStorage.getItem('request-type-selector-favorites')).toBe(
    JSON.stringify(['/requests/non-stock'])
  );

  const removeButtons = screen.getAllByRole('button', {
    name: 'Remove Non-Stock Request from shortcuts',
  });
  await user.click(removeButtons[0]);
  expect(screen.queryByRole('heading', { name: 'Saved workflows' })).not.toBeInTheDocument();
});

test('searches the available workflows by label and description', async () => {
  const user = userEvent.setup();
  renderSelector();

  const search = await screen.findByRole('searchbox', { name: 'Find the right workflow' });
  await user.type(search, 'medical equipment');

  expect(screen.getByRole('button', { name: 'Medical Device Request' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Non-Stock Request' })).not.toBeInTheDocument();
  expect(screen.getByText('1 workflow available')).toBeInTheDocument();
});

test('filters workflows by category and can recover from no results', async () => {
  const user = userEvent.setup();
  renderSelector();

  const filters = await screen.findByLabelText('Filter workflows by category');
  await user.click(within(filters).getByRole('button', { name: 'Approvals & History' }));

  expect(screen.getByRole('button', { name: 'Custody approvals awaiting your action' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Non-Stock Request' })).not.toBeInTheDocument();

  await user.type(screen.getByRole('searchbox'), 'not a real workflow');
  expect(screen.getByText('No matching workflows')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Clear all filters' }));

  expect(screen.getAllByRole('button', { name: 'Non-Stock Request' })).not.toHaveLength(0);
  expect(within(filters).getByRole('button', { name: 'All categories' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});