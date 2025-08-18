import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute } from '.';
import TransactionsPage from '../pages/Transactions';
import ForeignCurrencyPage from '../pages/ForeignCurrency';

export const Router: React.FC = () => {
  return (
    <Routes>
      {/* Main transactions route */}
      <Route path="/transactions" element={<PrivateRoute><TransactionsPage /></PrivateRoute>} />
      
      {/* Foreign currency routes */}
      <Route path="/foreign-currency" element={<PrivateRoute><ForeignCurrencyPage /></PrivateRoute>} />
      <Route path="/foreign-currency/accounts/:accountNumber" element={<PrivateRoute><ForeignCurrencyPage /></PrivateRoute>} />
      <Route path="/foreign-currency/accounts/:accountNumber/transactions" element={<PrivateRoute><ForeignCurrencyPage /></PrivateRoute>} />
      <Route path="/foreign-currency/convert" element={<PrivateRoute><ForeignCurrencyPage /></PrivateRoute>} />
      
      {/* Redirect unmatched routes to transactions */}
      <Route path="*" element={<Navigate to="/transactions" replace />} />
    </Routes>
  );
};
