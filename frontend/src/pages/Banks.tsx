import React from 'react';
import { Container, Box, Typography, Divider } from '@mui/material';
import { BankAccountsList } from '../components/bank/BankAccountsList';
import { CreditCardsList } from '../components/bank/CreditCardsList';

export const Banks: React.FC = () => {
  return (
    <Container>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Banking & Cards
        </Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
          Manage your bank accounts and view credit card analytics
        </Typography>
        
        <BankAccountsList />
        
        <Divider sx={{ my: 4 }} />
        
        <CreditCardsList />
      </Box>
    </Container>
  );
};

export default Banks;
