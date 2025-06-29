import React, { useEffect } from 'react';

interface LiveAnnouncerProps {
  message: string;
  assertive?: boolean;
}

const LiveAnnouncer: React.FC<LiveAnnouncerProps> = ({ message, assertive = false }) => {
  useEffect(() => {
    // Clear the region after 3 seconds to prevent stale announcements
    const timeout = setTimeout(() => {
      if (message) {
        document.getElementById('live-announcer')!.textContent = '';
      }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [message]);

  return (
    <div
      id="live-announcer"
      role="status"
      aria-live={assertive ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: '0',
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        border: '0',
      }}
    >
      {message}
    </div>
  );
};

export default LiveAnnouncer;
