import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const TestComponent = () => <div>Test Route</div>;

describe('Router', () => {
  test('renders with basic route', () => {
    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<TestComponent />} />
        </Routes>
      </BrowserRouter>
    );
    
    expect(screen.getByText('Test Route')).toBeInTheDocument();
  });
});
