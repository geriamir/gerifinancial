import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from '.';
import TransactionsPage from '../pages/Transactions';

export const Router: React.FC = () => {
  return (
    <Routes>
      {/* Main transactions route */}
      <Route path="/transactions" element={<PrivateRoute><TransactionsPage /></PrivateRoute>} />
      
      {/* Redirect unmatched routes to transactions */}
      <Route path="*" element={<Navigate to="/transactions" replace />} />
    </Routes>
  );
};
