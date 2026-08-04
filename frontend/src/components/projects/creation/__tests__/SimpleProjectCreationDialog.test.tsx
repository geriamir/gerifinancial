import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import SimpleProjectCreationDialog from '../SimpleProjectCreationDialog';
import { ProjectDraft } from '../../../../types/projects';

const mockCreateProject = jest.fn();
const mockDraftProject = jest.fn();

jest.mock('../../../../contexts/ProjectContext', () => ({
  useProject: () => ({ createProject: mockCreateProject })
}));

jest.mock('../../../../services/api/projects', () => ({
  projectsApi: {
    draftProject: (...args: unknown[]) => mockDraftProject(...args)
  }
}));

const draft = (overrides: Partial<ProjectDraft> = {}): ProjectDraft => ({
  name: 'Kitchen renovation',
  type: 'home_renovation',
  startDate: '2026-03-01T00:00:00.000Z',
  endDate: '2026-09-30T00:00:00.000Z',
  currency: 'ILS',
  categoryBudgets: [
    {
      categoryId: 'c1',
      subCategoryId: 's1',
      categoryName: 'Household',
      subCategoryName: 'Maintenance and Repairs',
      budgetedAmount: 50000,
      currency: 'ILS',
      description: 'Contractor'
    },
    {
      categoryId: 'c2',
      subCategoryId: 's2',
      categoryName: 'Shopping',
      subCategoryName: 'Furniture and Decorations',
      budgetedAmount: 30000,
      currency: 'ILS',
      description: 'Cabinets'
    }
  ],
  warnings: [],
  ...overrides
});

const renderDialog = () => render(
  <MemoryRouter>
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <SimpleProjectCreationDialog open onClose={jest.fn()} onSuccess={jest.fn()} />
    </LocalizationProvider>
  </MemoryRouter>
);

const describeIt = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
  await user.type(screen.getByLabelText(/describe your project/i), text);
  await user.click(screen.getByRole('button', { name: /draft with ai/i }));
};

describe('SimpleProjectCreationDialog drafting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateProject.mockResolvedValue({ _id: 'p1' });
    mockDraftProject.mockResolvedValue(draft());
  });

  it('will not ask for a draft of nothing', () => {
    renderDialog();
    expect(screen.getByRole('button', { name: /draft with ai/i })).toBeDisabled();
  });

  it('fills the form from the description', async () => {
    const user = userEvent.setup();
    renderDialog();

    await describeIt(user, 'renovating the kitchen');

    await waitFor(() => {
      expect(screen.getByLabelText(/project name/i)).toHaveValue('Kitchen renovation');
    });
    expect(mockDraftProject).toHaveBeenCalledWith('renovating the kitchen');
    expect(screen.getByDisplayValue('50000')).toBeInTheDocument();
    expect(screen.getByText(/Household › Maintenance and Repairs/)).toBeInTheDocument();
  });

  // The dialog focuses a field for you shortly after it opens. Typing straight
  // away used to race that, and the rest of the sentence landed in whichever
  // field won - so a description arrived at the drafter truncated.
  //
  // The whole sentence has to go in one character at a time for the race to be
  // reproduced, which is slow enough to overrun the default 5s timeout when the
  // suite runs under load; hence the explicit one. Typing faster would let the
  // sentence finish before the focus lands and stop testing anything.
  it('keeps every character typed into the description', async () => {
    const user = userEvent.setup();
    renderDialog();

    const sentence = 'renovating the kitchen from March, budget around 80,000';
    await user.type(screen.getByLabelText(/describe your project/i), sentence);

    expect(screen.getByLabelText(/describe your project/i)).toHaveValue(sentence);
    expect(screen.getByLabelText(/project name/i)).toHaveValue('');
  }, 20000);

  it('creates the project with the drafted budget', async () => {
    const user = userEvent.setup();
    renderDialog();

    await describeIt(user, 'renovating the kitchen');
    await screen.findByText(/Household › Maintenance and Repairs/);
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    const submitted = mockCreateProject.mock.calls[0][0];
    expect(submitted.name).toBe('Kitchen renovation');
    expect(submitted.categoryBudgets).toHaveLength(2);
    expect(submitted.categoryBudgets[0]).toMatchObject({
      categoryId: 'c1', subCategoryId: 's1', budgetedAmount: 50000
    });
  });

  it('lets a drafted line be removed before creating', async () => {
    const user = userEvent.setup();
    renderDialog();

    await describeIt(user, 'renovating the kitchen');
    await screen.findByText(/Household › Maintenance and Repairs/);
    await user.click(screen.getByRole('button', { name: /remove maintenance and repairs/i }));
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    const submitted = mockCreateProject.mock.calls[0][0];
    expect(submitted.categoryBudgets).toHaveLength(1);
    expect(submitted.categoryBudgets[0].categoryId).toBe('c2');
  });

  it('lets a drafted amount be corrected before creating', async () => {
    const user = userEvent.setup();
    renderDialog();

    await describeIt(user, 'renovating the kitchen');
    const amount = await screen.findByLabelText(/budget for maintenance and repairs/i);
    await user.clear(amount);
    await user.type(amount, '12345');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    expect(mockCreateProject.mock.calls[0][0].categoryBudgets[0].budgetedAmount).toBe(12345);
  });

  it('shows what the drafter had to leave out', async () => {
    const user = userEvent.setup();
    mockDraftProject.mockResolvedValue(draft({
      warnings: ['Left out "Renovation Permits" - you have no category by that name.']
    }));
    renderDialog();

    await describeIt(user, 'renovating the kitchen');

    expect(await screen.findByText(/Renovation Permits/)).toBeInTheDocument();
  });

  it('falls back to the plain form when there is no draft to be had', async () => {
    const user = userEvent.setup();
    mockDraftProject.mockResolvedValue(null);
    renderDialog();

    await describeIt(user, 'renovating the kitchen');

    expect(await screen.findByText(/fill in the form below instead/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create project/i })).toBeEnabled();
  });

  it('falls back to the plain form when the request fails', async () => {
    const user = userEvent.setup();
    mockDraftProject.mockRejectedValue(new Error('offline'));
    renderDialog();

    await describeIt(user, 'renovating the kitchen');

    expect(await screen.findByText(/fill in the form below instead/i)).toBeInTheDocument();
  });

  it('creates a project the ordinary way when nothing was drafted', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/project name/i), 'Manual project');
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    // Left empty on purpose: the backend's own template only applies when the
    // request carries no budget of its own.
    expect(mockCreateProject.mock.calls[0][0].categoryBudgets).toEqual([]);
    expect(mockDraftProject).not.toHaveBeenCalled();
  });

  it('keeps the sentence the project was drafted from', async () => {
    const user = userEvent.setup();
    renderDialog();

    await describeIt(user, 'renovating the kitchen');
    await screen.findByText(/Household › Maintenance and Repairs/);
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    // Not just an input to the drafter. Two projects can spend the same
    // categories over the same months, and this is what later tells their
    // transactions apart.
    expect(mockCreateProject.mock.calls[0][0].description).toBe('renovating the kitchen');
  });

  it('keeps the drafted budget in the currency the form ends up on', async () => {
    const user = userEvent.setup();
    mockDraftProject.mockResolvedValue(draft({ currency: undefined }));
    renderDialog();

    await describeIt(user, 'two weeks in Japan');
    await screen.findByText(/Household › Maintenance and Repairs/);

    await user.click(within(screen.getByRole('combobox')).getByText(/ILS/));
    await user.click(await screen.findByRole('option', { name: /USD/ }));
    await user.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(mockCreateProject).toHaveBeenCalled());
    const submitted = mockCreateProject.mock.calls[0][0];
    expect(submitted.currency).toBe('USD');
    expect(submitted.categoryBudgets.every((l: { currency: string }) => l.currency === 'USD')).toBe(true);
  });
});
