import React from 'react';
import { render } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';

test('renders without crashing', () => {
  render(
    <Router>
      <App />
    </Router>
  );
});
