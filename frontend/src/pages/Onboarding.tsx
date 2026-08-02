import React from 'react';
import { Container, Box } from '@mui/material';
import { OnboardingChat } from '../components/onboarding';

const OnboardingPage: React.FC = () => {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 4 }}>
        <OnboardingChat />
      </Box>
    </Container>
  );
};

export default OnboardingPage;
