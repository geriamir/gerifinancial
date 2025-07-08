import React from 'react';
import { render, screen } from '@testing-library/react';
import { VerificationStats } from '../VerificationStats';

describe('VerificationStats', () => {
  const defaultProps = {
    totalVerified: 75,
    totalPending: 25,
    avgVerificationTime: 1500, // 1.5 seconds
    batchVerificationRate: 0.6 // 60%
  };

  it('renders the verification progress correctly', () => {
    render(<VerificationStats {...defaultProps} />);

    // Check progress text
    expect(screen.getByText('75 of 100 verified')).toBeInTheDocument();
    expect(screen.getByText('(75.0%)')).toBeInTheDocument();

    // Check progress bar exists
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays all stat items with correct values', () => {
    render(<VerificationStats {...defaultProps} />);

    // Check all values are displayed
    expect(screen.getByText('75')).toBeInTheDocument(); // Verified
    expect(screen.getByText('25')).toBeInTheDocument(); // Pending
    expect(screen.getByText('1.5s')).toBeInTheDocument(); // Average time
    expect(screen.getByText('60%')).toBeInTheDocument(); // Batch rate

    // Check labels
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Avg. Time')).toBeInTheDocument();
    expect(screen.getByText('Batch Rate')).toBeInTheDocument();
  });

  it('shows tooltips for all stat items', () => {
    render(<VerificationStats {...defaultProps} />);

    expect(screen.getByLabelText('Total Verified Transactions')).toBeInTheDocument();
    expect(screen.getByLabelText('Pending Verifications')).toBeInTheDocument();
    expect(screen.getByLabelText('Average Time per Verification')).toBeInTheDocument();
    expect(screen.getByLabelText('Batch Verification Rate')).toBeInTheDocument();
  });

  describe('Status chips', () => {
    it('shows "Efficient" chip when batch rate is high', () => {
      render(<VerificationStats {...defaultProps} />);
      expect(screen.getByText('Efficient')).toBeInTheDocument();
    });

    it('shows "Could be improved" chip when batch rate is low', () => {
      render(
        <VerificationStats
          {...defaultProps}
          batchVerificationRate={0.3}
        />
      );
      expect(screen.getByText('Could be improved')).toBeInTheDocument();
    });

    it('shows "Fast verifications" chip when average time is low', () => {
      render(<VerificationStats {...defaultProps} />);
      expect(screen.getByText('Fast verifications')).toBeInTheDocument();
    });

    it('does not show "Fast verifications" chip when average time is high', () => {
      render(
        <VerificationStats
          {...defaultProps}
          avgVerificationTime={3000}
        />
      );
      expect(screen.queryByText('Fast verifications')).not.toBeInTheDocument();
    });

    it('shows "All verified" chip when no pending transactions', () => {
      render(
        <VerificationStats
          {...defaultProps}
          totalVerified={100}
          totalPending={0}
        />
      );
      expect(screen.getByText('All verified')).toBeInTheDocument();
    });

    it('does not show "All verified" chip when there are pending transactions', () => {
      render(<VerificationStats {...defaultProps} />);
      expect(screen.queryByText('All verified')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles zero total transactions gracefully', () => {
      render(
        <VerificationStats
          totalVerified={0}
          totalPending={0}
          avgVerificationTime={0}
          batchVerificationRate={0}
        />
      );

      expect(screen.getByText('0 of 0 verified')).toBeInTheDocument();
      expect(screen.getByText('(0.0%)')).toBeInTheDocument();
    });

    it('handles very large numbers appropriately', () => {
      render(
        <VerificationStats
          totalVerified={1000000}
          totalPending={500000}
          avgVerificationTime={1500}
          batchVerificationRate={0.75}
        />
      );

      expect(screen.getByText('1000000')).toBeInTheDocument();
      expect(screen.getByText('500000')).toBeInTheDocument();
    });

    it('handles very small batch verification rates', () => {
      render(
        <VerificationStats
          {...defaultProps}
          batchVerificationRate={0.001}
        />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('Could be improved')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides accessible progress information', () => {
      render(<VerificationStats {...defaultProps} />);
      
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    });

    it('uses semantic heading for the title', () => {
      render(<VerificationStats {...defaultProps} />);
      
      expect(screen.getByRole('heading', { 
        name: 'Verification Progress' 
      })).toBeInTheDocument();
    });
  });
});
