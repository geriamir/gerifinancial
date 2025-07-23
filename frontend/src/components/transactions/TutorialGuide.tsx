import React, { useEffect } from 'react';
import {
  Popper,
  Paper,
  Fade,
  IconButton,
  Button,
  Typography,
  Box,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Close as CloseIcon,
  Keyboard as KeyboardIcon,
  ArrowForward as ArrowForwardIcon,
  Highlight as HighlightIcon
} from '@mui/icons-material';
import type { TutorialStep } from '../../hooks/useTutorialGuide';
import { useTutorialHighlight } from '../../hooks/useTutorialHighlight';
import { useTutorialAnalytics } from '../../hooks/useTutorialAnalytics';

interface TutorialGuideProps {
  step: TutorialStep | null;
  onNext: () => void;
  onSkip: () => void;
  currentStepIndex: number;
  totalSteps: number;
  disableHighlight?: boolean;
}

export const TutorialGuide: React.FC<TutorialGuideProps> = ({
  step,
  onNext,
  onSkip,
  currentStepIndex,
  totalSteps,
  disableHighlight = false
}) => {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
  const [highlightEnabled, setHighlightEnabled] = React.useState(!disableHighlight);

  const {
    trackStepViewed,
    trackStepCompleted,
    trackTutorialCompleted,
    trackTutorialSkipped,
    trackStepChange,
    trackHighlightToggle
  } = useTutorialAnalytics();

  // Set up highlighting
  useTutorialHighlight({
    enabled: highlightEnabled,
    target: step?.target || null,
    pulseAnimation: true,
    backdropColor: 'rgba(0, 0, 0, 0.5)'
  });

  // Track step view
  useEffect(() => {
    if (step) {
      trackStepViewed(step.id);
    }
  }, [step, trackStepViewed]);

  // Handle element targeting
  useEffect(() => {
    if (step?.target) {
      const element = document.querySelector(step.target);
      if (element instanceof HTMLElement) {
        setAnchorEl(element);
      }
    } else {
      setAnchorEl(null);
    }
  }, [step]);

  if (!step || !anchorEl) return null;

  const isLastStep = currentStepIndex === totalSteps - 1;

  const handleNext = () => {
    trackStepCompleted(step.id);
    if (isLastStep) {
      trackTutorialCompleted();
    } else {
      trackStepChange(step.id, currentStepIndex, totalSteps);
    }
    onNext();
  };

  const handleSkip = () => {
    if (step) {
      trackTutorialSkipped(step.id);
    }
    onSkip();
  };

  const toggleHighlight = () => {
    const newValue = !highlightEnabled;
    setHighlightEnabled(newValue);
    trackHighlightToggle(newValue);
    localStorage.setItem('tutorial_highlight_disabled', (!newValue).toString());
  };

  return (
    <Popper
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      placement={step.position || 'bottom'}
      transition
      modifiers={[
        {
          name: 'offset',
          options: {
            offset: [0, 8]
          }
        }
      ]}
      sx={{ zIndex: 1300 }}
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={350}>
          <Paper
            elevation={8}
            sx={{
              p: 2,
              maxWidth: 350,
              position: 'relative'
            }}
          >
            <IconButton
              size="small"
              onClick={handleSkip}
              aria-label="Close tutorial"
              sx={{
                position: 'absolute',
                right: 8,
                top: 8,
                color: 'text.secondary'
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>

            <Box sx={{ mb: 2, pr: 4 }}>
              <Typography variant="subtitle1" color="primary" gutterBottom>
                {step.title}
              </Typography>
              <Typography variant="body2">
                {step.content}
              </Typography>
            </Box>

            {step.action === 'keyboard' && step.shortcut && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 2,
                  color: 'text.secondary',
                  backgroundColor: 'action.hover',
                  p: 1,
                  borderRadius: 1
                }}
              >
                <KeyboardIcon fontSize="small" />
                <Typography variant="body2" component="code">
                  {step.shortcut}
                </Typography>
              </Box>
            )}

            <Box
              sx={{
                borderTop: 1,
                borderColor: 'divider',
                mt: 2,
                pt: 2
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={highlightEnabled}
                    onChange={toggleHighlight}
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <HighlightIcon fontSize="small" />
                    <Typography variant="caption">Highlight</Typography>
                  </Box>
                }
                sx={{ mb: 1 }}
              />

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mt: 1
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  Step {currentStepIndex + 1} of {totalSteps}
                </Typography>
                <Box>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={handleSkip}
                    sx={{ mr: 1 }}
                  >
                    Skip
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={handleNext}
                    endIcon={isLastStep ? undefined : <ArrowForwardIcon />}
                  >
                    {isLastStep ? 'Finish' : 'Next'}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Fade>
      )}
    </Popper>
  );
};
