import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { VerifyTransactions } from '../pages/VerifyTransactions';
import { PrivateRoute } from '.';

export const Router: React.FC = () => {
  return (
    <Routes>
      {/* Main transaction verification route */}
      <Route path="/verify" element={<PrivateRoute><VerifyTransactions /></PrivateRoute>} />
      
      {/* Redirect unmatched routes to verify */}
      <Route path="*" element={<Navigate to="/verify" replace />} />
    </Routes>
  );
};
