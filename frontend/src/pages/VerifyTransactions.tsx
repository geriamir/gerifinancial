import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const VerifyTransactions: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to the new pending transactions page
    navigate('/pending', { replace: true });
  }, [navigate]);

  return null;
};
