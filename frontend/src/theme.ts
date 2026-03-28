import { createTheme, ThemeOptions, alpha } from '@mui/material/styles';

const sharedTypography: ThemeOptions['typography'] = {
  fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  h4: { fontWeight: 700, letterSpacing: '-0.02em' },
  h5: { fontWeight: 600, letterSpacing: '-0.01em' },
  h6: { fontWeight: 600, letterSpacing: '-0.01em' },
  subtitle1: { fontWeight: 500 },
  subtitle2: { fontWeight: 500, letterSpacing: '0.02em', textTransform: 'uppercase' as const, fontSize: '0.75rem' },
  button: { fontWeight: 600, letterSpacing: '0.02em' },
};

const sharedShape = { borderRadius: 12 };

const lightPalette: ThemeOptions['palette'] = {
  mode: 'light',
  primary: {
    main: '#1a237e',
    light: '#534bae',
    dark: '#000051',
    contrastText: '#ffffff',
  },
  secondary: {
    main: '#0d47a1',
    light: '#5472d3',
    dark: '#002171',
    contrastText: '#ffffff',
  },
  background: {
    default: '#f5f6fa',
    paper: '#ffffff',
  },
  success: { main: '#2e7d32', light: '#4caf50' },
  warning: { main: '#ed6c02', light: '#ff9800' },
  error: { main: '#c62828', light: '#ef5350' },
  info: { main: '#0288d1', light: '#03a9f4' },
  text: {
    primary: '#1a1a2e',
    secondary: '#546e7a',
  },
  divider: 'rgba(0, 0, 0, 0.08)',
};

const darkPalette: ThemeOptions['palette'] = {
  mode: 'dark',
  primary: {
    main: '#7986cb',
    light: '#aab6fe',
    dark: '#49599a',
    contrastText: '#000000',
  },
  secondary: {
    main: '#64b5f6',
    light: '#9be7ff',
    dark: '#2286c3',
    contrastText: '#000000',
  },
  background: {
    default: '#0f1117',
    paper: '#1a1d2e',
  },
  success: { main: '#66bb6a', light: '#81c784' },
  warning: { main: '#ffa726', light: '#ffb74d' },
  error: { main: '#ef5350', light: '#e57373' },
  info: { main: '#42a5f5', light: '#64b5f6' },
  text: {
    primary: '#e8eaf6',
    secondary: '#90a4ae',
  },
  divider: 'rgba(255, 255, 255, 0.08)',
};

function getComponentOverrides(mode: 'light' | 'dark'): ThemeOptions['components'] {
  const isDark = mode === 'dark';

  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: isDark ? '#3a3f5c #0f1117' : '#c1c1c1 #f5f6fa',
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-track': { background: isDark ? '#0f1117' : '#f5f6fa' },
          '&::-webkit-scrollbar-thumb': {
            background: isDark ? '#3a3f5c' : '#c1c1c1',
            borderRadius: 4,
          },
        },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          backgroundImage: 'none',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          '&:hover': {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiCardActionArea: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          },
        },
      },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          ...(isDark
            ? { backgroundColor: '#141627', borderBottom: '1px solid rgba(255,255,255,0.06)' }
            : { backgroundColor: '#1a237e', borderBottom: 'none' }
          ),
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          ...(isDark && { backgroundColor: '#141627' }),
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none' as const,
          fontWeight: 600,
          padding: '8px 20px',
        },
        containedPrimary: isDark
          ? { backgroundColor: '#3949ab', '&:hover': { backgroundColor: '#303f9f' } }
          : {},
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
            color: isDark ? '#90a4ae' : '#546e7a',
            backgroundColor: isDark ? '#141627' : '#f5f6fa',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          ...(isDark && { backgroundColor: '#1a1d2e' }),
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' as const },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 600,
          minHeight: 48,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 8, height: 8 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          fontSize: '0.8rem',
          ...(isDark && { backgroundColor: '#2a2d3e' }),
        },
      },
    },
    MuiFab: {
      defaultProps: { color: 'primary' as const },
      styleOverrides: {
        root: { boxShadow: isDark
          ? '0 4px 14px rgba(0,0,0,0.4)'
          : '0 4px 14px rgba(26,35,126,0.3)',
        },
      },
    },
  };
}

export function buildTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: mode === 'light' ? lightPalette : darkPalette,
    typography: sharedTypography,
    shape: sharedShape,
    components: getComponentOverrides(mode),
  });
}

// Utility: get a subtle gradient for summary cards based on a color key
export function getSummaryCardGradient(
  colorKey: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary',
  mode: 'light' | 'dark'
) {
  const gradients: Record<string, { light: string; dark: string }> = {
    primary:   { light: 'linear-gradient(135deg, #e8eaf6 0%, #c5cae9 100%)', dark: 'linear-gradient(135deg, #1a1d3a 0%, #252850 100%)' },
    secondary: { light: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)', dark: 'linear-gradient(135deg, #0d1b30 0%, #1a2940 100%)' },
    success:   { light: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', dark: 'linear-gradient(135deg, #1a2e1a 0%, #1e3b1e 100%)' },
    warning:   { light: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)', dark: 'linear-gradient(135deg, #2e2210 0%, #3a2e14 100%)' },
    error:     { light: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', dark: 'linear-gradient(135deg, #2e1414 0%, #3a1a1a 100%)' },
    info:      { light: 'linear-gradient(135deg, #e1f5fe 0%, #b3e5fc 100%)', dark: 'linear-gradient(135deg, #0d1e30 0%, #142a3e 100%)' },
  };
  return gradients[colorKey]?.[mode] ?? gradients.primary[mode];
}

// Utility: icon container background for summary cards
export function getSummaryIconBg(
  colorKey: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary',
  mode: 'light' | 'dark'
) {
  const colors: Record<string, { light: string; dark: string }> = {
    primary:   { light: alpha('#1a237e', 0.10), dark: alpha('#7986cb', 0.15) },
    secondary: { light: alpha('#0d47a1', 0.10), dark: alpha('#64b5f6', 0.15) },
    success:   { light: alpha('#2e7d32', 0.10), dark: alpha('#66bb6a', 0.15) },
    warning:   { light: alpha('#ed6c02', 0.10), dark: alpha('#ffa726', 0.15) },
    error:     { light: alpha('#c62828', 0.10), dark: alpha('#ef5350', 0.15) },
    info:      { light: alpha('#0288d1', 0.10), dark: alpha('#42a5f5', 0.15) },
  };
  return colors[colorKey]?.[mode] ?? colors.primary[mode];
}
