import React from 'react';
import { render, screen } from '@testing-library/react';
import { PerformanceMetricsDisplay } from '../PerformanceMetricsDisplay';
import type { PerformanceMetrics } from '../../../utils/analytics';

describe('PerformanceMetricsDisplay', () => {
  const mockMetrics: PerformanceMetrics = {
    duration: 750,
    startTime: Date.now() - 750,
    endTime: Date.now(),
    tags: {
      operation: 'test',
      environment: 'testing'
    },
    data: {
      itemsProcessed: 100,
      success: true
    }
  };

  it('renders basic metrics without details', () => {
    render(
      <PerformanceMetricsDisplay
        metrics={mockMetrics}
        title="Test Performance"
      />
    );

    expect(screen.getByText('Test Performance')).toBeInTheDocument();
    expect(screen.getByText('Duration: 750ms')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();

    // Details should not be visible
    expect(screen.queryByText('Timing Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional Data')).not.toBeInTheDocument();
  });

  it('shows detailed information when showDetails is true', () => {
    render(
      <PerformanceMetricsDisplay
        metrics={mockMetrics}
        showDetails={true}
      />
    );

    // Timing details
    expect(screen.getByText('Timing Details')).toBeInTheDocument();
    expect(screen.getByText(/Start:/)).toBeInTheDocument();
    expect(screen.getByText(/End:/)).toBeInTheDocument();

    // Tags
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('operation: test')).toBeInTheDocument();
    expect(screen.getByText('environment: testing')).toBeInTheDocument();

    // Additional data
    expect(screen.getByText('Additional Data')).toBeInTheDocument();
    expect(screen.getByText(/"itemsProcessed": 100/)).toBeInTheDocument();
    expect(screen.getByText(/"success": true/)).toBeInTheDocument();
  });

  it('changes color based on performance threshold', () => {
    const { rerender } = render(
      <PerformanceMetricsDisplay
        metrics={{ ...mockMetrics, duration: 500 }}
        threshold={1000}
      />
    );

    // Success case (50% of threshold)
    const successProgress = screen.getByRole('progressbar');
    expect(successProgress).toHaveClass('MuiLinearProgress-colorSuccess');
    expect(screen.getByText('50%')).toBeInTheDocument();

    // Warning case (80% of threshold)
    rerender(
      <PerformanceMetricsDisplay
        metrics={{ ...mockMetrics, duration: 800 }}
        threshold={1000}
      />
    );
    const warningProgress = screen.getByRole('progressbar');
    expect(warningProgress).toHaveClass('MuiLinearProgress-colorWarning');
    expect(screen.getByText('80%')).toBeInTheDocument();

    // Error case (over threshold)
    rerender(
      <PerformanceMetricsDisplay
        metrics={{ ...mockMetrics, duration: 1200 }}
        threshold={1000}
      />
    );
    const errorProgress = screen.getByRole('progressbar');
    expect(errorProgress).toHaveClass('MuiLinearProgress-colorError');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('formats duration correctly', () => {
    const { rerender } = render(
      <PerformanceMetricsDisplay
        metrics={{ ...mockMetrics, duration: 500 }}
      />
    );
    expect(screen.getByText('Duration: 500ms')).toBeInTheDocument();

    rerender(
      <PerformanceMetricsDisplay
        metrics={{ ...mockMetrics, duration: 1500 }}
      />
    );
    expect(screen.getByText('Duration: 1.50s')).toBeInTheDocument();
  });

  it('handles empty tags and data', () => {
    render(
      <PerformanceMetricsDisplay
        metrics={{
          ...mockMetrics,
          tags: {},
          data: {}
        }}
        showDetails={true}
      />
    );

    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional Data')).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PerformanceMetricsDisplay
        metrics={mockMetrics}
        className="custom-metrics"
      />
    );

    expect(container.firstChild).toHaveClass('custom-metrics');
  });

  it('shows info tooltip when title is provided', () => {
    const { rerender } = render(
      <PerformanceMetricsDisplay
        metrics={mockMetrics}
      />
    );

    // Should not show tooltip without title
    expect(screen.queryByTitle('Performance Metrics')).not.toBeInTheDocument();

    // Should show tooltip with title
    rerender(
      <PerformanceMetricsDisplay
        metrics={mockMetrics}
        title="Test Performance"
      />
    );
    expect(screen.getByLabelText('Performance Metrics')).toBeInTheDocument();
  });
});
