import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProjectSuggestionsDialog from '../ProjectSuggestionsDialog';
import { ProjectSuggestion } from '../../../services/api/budgets';

const mockGet = jest.fn();
const mockResolve = jest.fn();

jest.mock('../../../services/api/budgets', () => ({
  budgetsApi: {
    getProjectSuggestions: (...args: unknown[]) => mockGet(...args),
    resolveProjectSuggestion: (...args: unknown[]) => mockResolve(...args)
  }
}));

const suggestion = (overrides: Partial<ProjectSuggestion> = {}): ProjectSuggestion => ({
  transaction: {
    _id: 't1',
    description: 'HOME CENTER',
    amount: -1200,
    currency: 'ILS',
    date: '2026-03-04T00:00:00.000Z',
    category: { _id: 'c1', name: 'Household' },
    subCategory: { _id: 's1', name: 'Maintenance and Repairs' }
  },
  confidence: 0.91,
  reason: 'A hardware shop during the renovation window',
  suggestedAt: '2026-03-05T00:00:00.000Z',
  ...overrides
});

const onAccepted = jest.fn();

const renderDialog = () => render(
  <ProjectSuggestionsDialog
    open
    onClose={jest.fn()}
    projectId="p1"
    projectName="Kitchen renovation"
    onAccepted={onAccepted}
  />
);

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue({ success: true, data: [suggestion()] });
  mockResolve.mockResolvedValue({ success: true, data: { status: 'accepted' } });
});

describe('what it shows', () => {
  it('lists what the matcher found, with the reason it gave', async () => {
    renderDialog();

    expect(await screen.findByText('HOME CENTER')).toBeInTheDocument();
    expect(screen.getByText('A hardware shop during the renovation window')).toBeInTheDocument();
    expect(screen.getByText('91%')).toBeInTheDocument();
    expect(screen.getByText('Household › Maintenance and Repairs')).toBeInTheDocument();
    expect(screen.queryByText(/nothing to review/i)).not.toBeInTheDocument();
  });

  // The model not being reached is not the same as the model saying no: the
  // candidate still matched a budget line inside the project's dates, and a
  // "0%" badge would tell the user the opposite.
  it('says a candidate is unscored rather than showing it as a bad match', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [suggestion({ confidence: null, reason: '' })]
    });

    renderDialog();

    expect(await screen.findByText('unscored')).toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('does not ask for the doubted ones until told to', async () => {
    renderDialog();
    await screen.findByText('HOME CENTER');

    expect(mockGet).toHaveBeenCalledWith('p1', { refresh: false, includeUnlikely: false });
  });

  it('asks again for the doubted ones when the switch is turned on', async () => {
    renderDialog();
    await screen.findByText('HOME CENTER');

    await userEvent.click(screen.getByRole('checkbox'));

    await waitFor(() => {
      expect(mockGet).toHaveBeenLastCalledWith('p1', { refresh: false, includeUnlikely: true });
    });
  });

  // Refreshing is what makes the screen useful for a project created after the
  // transactions were already imported.
  it('can go looking for new matches on demand', async () => {
    renderDialog();
    await screen.findByText('HOME CENTER');

    await userEvent.click(screen.getByRole('button', { name: /look for new matches/i }));

    await waitFor(() => {
      expect(mockGet).toHaveBeenLastCalledWith('p1', { refresh: true, includeUnlikely: false });
    });
  });

  it('says so plainly when there is nothing to review', async () => {
    mockGet.mockResolvedValue({ success: true, data: [] });

    renderDialog();

    expect(await screen.findByText(/nothing to review/i)).toBeInTheDocument();
  });

  it('shows why the list could not be loaded', async () => {
    mockGet.mockRejectedValue({ response: { data: { message: 'Project not found' } } });

    renderDialog();

    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });
});

describe('deciding', () => {
  it('adds the transaction to the project when accepted', async () => {
    renderDialog();
    await screen.findByText('HOME CENTER');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('p1', 't1', 'accept'));
    expect(onAccepted).toHaveBeenCalled();
  });

  it('rejects without touching the project totals', async () => {
    renderDialog();
    await screen.findByText('HOME CENTER');

    await userEvent.click(screen.getByRole('button', { name: 'Not this' }));

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('p1', 't1', 'reject'));
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('takes a decided suggestion off the list', async () => {
    renderDialog();
    await screen.findByText('HOME CENTER');

    await userEvent.click(screen.getByRole('button', { name: 'Not this' }));

    await waitFor(() => expect(screen.queryByText('HOME CENTER')).not.toBeInTheDocument());
  });

  // A suggestion that failed to save has not been decided, so leaving it on the
  // list is what lets the user try again.
  it('keeps a suggestion that could not be saved, and says why', async () => {
    mockResolve.mockRejectedValue({ response: { data: { message: 'already been decided' } } });

    renderDialog();
    await screen.findByText('HOME CENTER');

    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('already been decided')).toBeInTheDocument();
    expect(screen.getByText('HOME CENTER')).toBeInTheDocument();
    expect(onAccepted).not.toHaveBeenCalled();
  });

  it('only decides the one that was clicked', async () => {
    mockGet.mockResolvedValue({
      success: true,
      data: [
        suggestion(),
        suggestion({
          transaction: { ...suggestion().transaction, _id: 't2', description: 'ACE HARDWARE' }
        })
      ]
    });

    renderDialog();
    await screen.findByText('ACE HARDWARE');

    await userEvent.click(screen.getAllByRole('button', { name: 'Add' })[1]);

    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith('p1', 't2', 'accept'));
    expect(mockResolve).toHaveBeenCalledTimes(1);
    expect(screen.getByText('HOME CENTER')).toBeInTheDocument();
  });
});
