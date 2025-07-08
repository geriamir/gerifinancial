import { useEffect, useRef } from 'react';

interface HighlightOptions {
  enabled: boolean;
  target: string | null;
  zIndex?: number;
  pulseAnimation?: boolean;
  backdropColor?: string;
}

const DEFAULT_OPTIONS = {
  zIndex: 1299, // Just below tutorial popper
  pulseAnimation: true,
  backdropColor: 'rgba(0, 0, 0, 0.5)'
};

export const useTutorialHighlight = (options: HighlightOptions) => {
  const {
    enabled,
    target,
    zIndex = DEFAULT_OPTIONS.zIndex,
    pulseAnimation = DEFAULT_OPTIONS.pulseAnimation,
    backdropColor = DEFAULT_OPTIONS.backdropColor
  } = options;

  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !target) {
      if (overlayRef.current) {
        document.body.removeChild(overlayRef.current);
        overlayRef.current = null;
      }
      return;
    }

    const targetElement = document.querySelector(target) as HTMLElement | null;
    if (!targetElement) return;

    // Create highlight overlay if it doesn't exist
    if (!overlayRef.current) {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.backgroundColor = 'transparent';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = zIndex.toString();
      overlay.style.transition = 'all 0.3s ease-in-out';
      document.body.appendChild(overlay);
      overlayRef.current = overlay;
    }

    // Add backdrop and cutout styles
    const updateHighlight = () => {
      if (!overlayRef.current || !targetElement) return;

      const rect = targetElement.getBoundingClientRect();
      const radius = '4px';

      overlayRef.current.style.background = `
        ${backdropColor}
        -webkit-mask: 
          linear-gradient(#000 0 0) content-box,
          linear-gradient(#000 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        padding: ${rect.top}px ${window.innerWidth - rect.right}px ${window.innerHeight - rect.bottom}px ${rect.left}px;
      `;

      if (pulseAnimation) {
        targetElement.style.position = 'relative';
        targetElement.style.zIndex = (zIndex + 1).toString();
        targetElement.style.animation = 'tutorial-pulse 2s infinite';

        // Add pulse animation if it doesn't exist
        if (!document.getElementById('tutorial-highlight-styles')) {
          const style = document.createElement('style');
          style.id = 'tutorial-highlight-styles';
          style.textContent = `
            @keyframes tutorial-pulse {
              0% {
                box-shadow: 0 0 0 0 rgba(66, 153, 225, 0.4);
              }
              70% {
                box-shadow: 0 0 0 10px rgba(66, 153, 225, 0);
              }
              100% {
                box-shadow: 0 0 0 0 rgba(66, 153, 225, 0);
              }
            }
          `;
          document.head.appendChild(style);
        }
      }
    };

    // Update highlight on target changes or window resize
    updateHighlight();
    window.addEventListener('resize', updateHighlight);
    const observer = new ResizeObserver(updateHighlight);
    observer.observe(targetElement);

    return () => {
      if (overlayRef.current) {
        document.body.removeChild(overlayRef.current);
        overlayRef.current = null;
      }
      window.removeEventListener('resize', updateHighlight);
      observer.disconnect();

      // Reset target element styles
      if (targetElement) {
        targetElement.style.position = '';
        targetElement.style.zIndex = '';
        targetElement.style.animation = '';
      }
    };
  }, [enabled, target, zIndex, pulseAnimation, backdropColor]);

  return {
    isHighlighting: Boolean(overlayRef.current)
  };
};
