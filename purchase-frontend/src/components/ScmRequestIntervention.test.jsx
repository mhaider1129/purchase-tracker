import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScmRequestIntervention from './ScmRequestIntervention';
import api from '../api/axios';
jest.mock('../api/axios', () => ({ post: jest.fn() }));
jest.mock('react-i18next', () => {
  const i18n = require('i18next').createInstance();
  i18n.init({ lng: 'en', resources: { en: { translation: require('../locales/en.json') } }, initImmediate: false });
  return { useTranslation: () => ({ t: i18n.t.bind(i18n) }) };
});
beforeEach(() => jest.clearAllMocks());
test('hidden without authority; reason and explicit confirmation are required', async () => {
  const saved = jest.fn();
  const { rerender } = render(<ScmRequestIntervention requestId={208} allowed={false} onRejected={saved} />);
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  rerender(<ScmRequestIntervention requestId={208} allowed onRejected={saved} />);
  fireEvent.click(screen.getByRole('button', { name:'SCM intervention' }));
  expect(screen.getByRole('button', { name:'Reject and stop request' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Rejection reason'), { target:{ value:' Incorrect request type ' } });
  api.post.mockResolvedValue({ data:{ status:'Rejected' } });
  fireEvent.click(screen.getByRole('button', { name:'Reject and stop request' }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/requests/208/scm-rejection', { reason:'Incorrect request type' });
});
test('cancel does not submit; conflict retains the reason and shows server guidance', async () => {
  render(<ScmRequestIntervention requestId={208} allowed onRejected={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name:'SCM intervention' }));
  fireEvent.click(screen.getByRole('button', { name:'Cancel' }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name:'SCM intervention' }));
  fireEvent.change(screen.getByLabelText('Rejection reason'), { target:{ value:'Duplicate submission' } });
  api.post.mockRejectedValue({ response:{ data:{ message:'Request already approved' } } });
  fireEvent.click(screen.getByRole('button', { name:'Reject and stop request' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Request already approved');
  expect(screen.getByLabelText('Rejection reason')).toHaveValue('Duplicate submission');
});
