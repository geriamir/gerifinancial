import React from 'react';
import { render, screen } from '@testing-library/react';
import { BatchTransactionList } from '../BatchTransactionList';

const mockTransactions = [
  {
    _id: '1',
    description: 'Test Transaction 1',
    amount: -100,
    currency: 'ILS',
    date: '2025-07-04T12:00:00.000Z',
    category: {
      name: 'Food',
      _id: 'cat1'
    },
    subCategory: {
      name: 'Restaurant',
      _id: 'sub1'
    }
  },
  {
    _id: '2',
    description: 'Test Transaction 2',
    amount: -75,
    currency: 'ILS',
    date: '2025-07-04T13:00:00.000Z',
    category: {
      name: 'Food',
      _id: 'cat1'
    },
    subCategory: {
      name: 'Groceries',
      _id: 'sub2'
    }
  }
] as any; // Type assertion for test simplicity

describe('BatchTransactionList', () => {
  it('renders all transactions', () => {
    render(<BatchTransactionList transactions={mockTransactions} />);
    
    expect(screen.getByText('Test Transaction 1')).toBeInTheDocument();
    expect(screen.getByText('Test Transaction 2')).toBeInTheDocument();
  });

  it('highlights main transaction', () => {
    render(
      <BatchTransactionList 
        transactions={mockTransactions} 
        mainTransaction={mockTransactions[0]}
      />
    );
    
    expect(screen.getByText('Main')).toBeInTheDocument();
  });

  it('displays category information', () => {
    render(<BatchTransactionList transactions={mockTransactions} />);
    
    expect(screen.getByText('Food > Restaurant')).toBeInTheDocument();
    expect(screen.getByText('Food > Groceries')).toBeInTheDocument();
  });

  it('formats currency correctly', () => {
    render(<BatchTransactionList transactions={mockTransactions} />);
    
    // Hebrew locale formatting
    expect(screen.getByText(/‏100\.00 ‏₪/)).toBeInTheDocument();
    expect(screen.getByText(/‏75\.00 ‏₪/)).toBeInTheDocument();
  });

  it('formats date correctly', () => {
    render(<BatchTransactionList transactions={mockTransactions} />);
    
    // Hebrew locale formatting
    const formattedDate = new Date('2025-07-04').toLocaleDateString('he-IL');
    expect(screen.getAllByText(new RegExp(formattedDate))).toHaveLength(2);
  });

  it('applies dense prop correctly', () => {
    const { container } = render(
      <BatchTransactionList transactions={mockTransactions} dense={true} />
    );
    
    const list = container.querySelector('.MuiList-dense');
    expect(list).toBeInTheDocument();
  });

  it('applies maxHeight correctly', () => {
    const { container } = render(
      <BatchTransactionList transactions={mockTransactions} maxHeight={300} />
    );
    
    const paper = container.querySelector('.MuiPaper-root');
    expect(paper).toHaveStyle({ maxHeight: '300px' });
  });
});
