import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PendingTransactions } from '../pages/PendingTransactions';
import { VerifyTransactions } from '../pages/VerifyTransactions';
import { PrivateRoute } from '.';

export const Router: React.FC = () => {
  return (
    <Routes>
      {/* Legacy verification route - redirects to pending */}
      <Route path="/verify" element={<PrivateRoute><VerifyTransactions /></PrivateRoute>} />
      
      {/* New pending transactions route */}
      <Route path="/pending" element={<PrivateRoute><PendingTransactions /></PrivateRoute>} />
      
      {/* Redirect unmatched routes to pending */}
      <Route path="*" element={<Navigate to="/pending" replace />} />
    </Routes>
  );
};
