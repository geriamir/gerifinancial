import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import {
  Button,
  TextField,
  Typography,
  Box,
  Paper,
  Alert
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';

const validationSchema = Yup.object({
  name: Yup.string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
});

const RegisterForm: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [error, setError] = useState<string>('');

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh'
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          width: '100%',
          maxWidth: 400
        }}
      >
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          Register
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Formik
          initialValues={{
            name: '',
            email: '',
            password: '',
            confirmPassword: ''
          }}
          validationSchema={validationSchema}
          onSubmit={async (values, { setSubmitting }) => {
            try {
              await register(values.name, values.email, values.password);
              navigate('/dashboard');
            } catch (err) {
              setError('Registration failed. Email might already be in use.');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ errors, touched, isSubmitting }) => (
            <Form>
              <Field
                as={TextField}
                fullWidth
                name="name"
                label="Name"
                error={touched.name && !!errors.name}
                helperText={touched.name && errors.name}
                margin="normal"
              />

              <Field
                as={TextField}
                fullWidth
                name="email"
                label="Email"
                type="email"
                error={touched.email && !!errors.email}
                helperText={touched.email && errors.email}
                margin="normal"
              />

              <Field
                as={TextField}
                fullWidth
                name="password"
                label="Password"
                type="password"
                error={touched.password && !!errors.password}
                helperText={touched.password && errors.password}
                margin="normal"
              />

              <Field
                as={TextField}
                fullWidth
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                error={touched.confirmPassword && !!errors.confirmPassword}
                helperText={touched.confirmPassword && errors.confirmPassword}
                margin="normal"
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                disabled={isSubmitting}
                sx={{ mt: 3 }}
              >
                {isSubmitting ? 'Registering...' : 'Register'}
              </Button>

              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="body2">
                  Already have an account?{' '}
                  <Button
                    color="primary"
                    onClick={() => navigate('/login')}
                  >
                    Login
                  </Button>
                </Typography>
              </Box>
            </Form>
          )}
        </Formik>
      </Paper>
    </Box>
  );
};

export default RegisterForm;
