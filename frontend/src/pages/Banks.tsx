import React from 'react';
import { Container } from '@mui/material';
import { BankAccountsList } from '../components/bank/BankAccountsList';

export const Banks: React.FC = () => {
  return (
    <Container>
      <BankAccountsList />
    </Container>
  );
};

export default Banks;
