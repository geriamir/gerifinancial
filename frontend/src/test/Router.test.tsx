import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const TestComponent = () => <div>Test Route</div>;

describe('Router', () => {
  test('renders with basic route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<TestComponent />} />
        </Routes>
      </MemoryRouter>
    );
    
    expect(screen.getByText('Test Route')).toBeInTheDocument();
  });
});
