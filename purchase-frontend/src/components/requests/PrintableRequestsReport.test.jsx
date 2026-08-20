import { render, screen } from '@testing-library/react';
import PrintableRequestsReport from './PrintableRequestsReport';

describe('PrintableRequestsReport', () => {
  it('renders every supplied request in the print table', () => {
    const requests = [
      {
        id: 101,
        request_type: 'Stock',
        project_name: 'Clinic',
        status: 'pending',
        assigned_user_name: 'Sam',
        created_at: '2026-08-01',
        updated_at: '2026-08-02',
      },
      { id: 102, request_type: 'Maintenance', status: 'approved' },
    ];
    const labels = {
      id: 'ID',
      type: 'Type',
      project: 'Project',
      status: 'Status',
      assigned: 'Assigned',
      submitted: 'Submitted',
      updated: 'Updated',
      printedAt: 'Printed at',
      notAvailable: 'Not available',
    };

    render(
      <PrintableRequestsReport
        requests={requests}
        title="My Requests"
        labels={labels}
        formatDate={(value) => (value ? String(value) : '—')}
      />,
    );

    expect(screen.getByText('My Requests')).toBeInTheDocument();
    expect(screen.getByText('101')).toBeInTheDocument();
    expect(screen.getByText('102')).toBeInTheDocument();
    expect(screen.getByText('Clinic')).toBeInTheDocument();
    expect(screen.getAllByText('Not available')).toHaveLength(2);
  });
});