import React from 'react';
import { renderWithRouter } from './test/utils';
import App from './App';

test('renders without crashing', () => {
  renderWithRouter(<App />);
});
