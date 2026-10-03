import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ActivityTimeline from './ActivityTimeline';
import type { Activity } from '../types';

const ACTIVITIES: Activity[] = [
  { id: 1, type: 'call', contact_id: 1, deal_id: null, description: 'Older call', happened_at: '2026-01-01 10:00', due_date: '', done: false, created_at: '' },
  { id: 2, type: 'note', contact_id: 1, deal_id: null, description: 'Newer note with task', happened_at: '2026-02-01 10:00', due_date: '2099-12-31', done: false, created_at: '' },
];

describe('ActivityTimeline', () => {
  afterEach(cleanup);

  it('renders activities with type badges and due-date info', () => {
    render(<ActivityTimeline activities={ACTIVITIES} onToggleDone={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('Older call')).toBeInTheDocument();
    expect(screen.getByText('Newer note with task')).toBeInTheDocument();
    expect(screen.getByText('call')).toBeInTheDocument();
    expect(screen.getByText(/due Dec 31, 2099/)).toBeInTheDocument();
  });

  it('calls onToggleDone when the task checkbox is clicked', () => {
    const onToggleDone = vi.fn();
    render(<ActivityTimeline activities={ACTIVITIES} onToggleDone={onToggleDone} onDelete={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Mark "Newer note with task" done/ }));
    expect(onToggleDone).toHaveBeenCalledTimes(1);
    expect(onToggleDone.mock.calls[0][0].id).toBe(2);
  });

  it('shows an empty state when there are no activities', () => {
    render(<ActivityTimeline activities={[]} onToggleDone={() => {}} onDelete={() => {}} />);
    expect(screen.getByText('No activity yet.')).toBeInTheDocument();
  });
});
