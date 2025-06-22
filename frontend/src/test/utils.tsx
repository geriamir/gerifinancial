import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

interface WrapperProps {
  children: React.ReactNode;
}

export const TestWrapper: React.FC<WrapperProps> = ({ children }) => {
  return (
    <MemoryRouter>
      {children}
    </MemoryRouter>
  );
};

export const renderWithRouter = (ui: React.ReactElement, options = {}) => {
  return render(ui, {
    wrapper: TestWrapper,
    ...options,
  });
};
