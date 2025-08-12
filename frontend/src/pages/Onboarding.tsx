import React from 'react';
import { Container, Box } from '@mui/material';
import { OnboardingWizard } from '../components/onboarding';

const OnboardingPage: React.FC = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <OnboardingWizard />
      </Box>
    </Container>
  );
};

export default OnboardingPage;
