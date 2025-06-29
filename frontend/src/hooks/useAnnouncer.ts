import { useState, useCallback } from 'react';

export const useAnnouncer = () => {
  const [announcement, setAnnouncement] = useState('');
  const [isAssertive, setIsAssertive] = useState(false);

  const announce = useCallback((message: string, assertive: boolean = false) => {
    setAnnouncement(message);
    setIsAssertive(assertive);
  }, []);

  return {
    announcement,
    isAssertive,
    announce,
  };
};

export const formatFilterAnnouncement = (
  filterType: string, 
  value: string | number | Date | null
): string => {
  if (!value) {
    return `${filterType} filter cleared`;
  }

  if (value instanceof Date) {
    return `${filterType} set to ${value.toLocaleDateString()}`;
  }

  return `${filterType} filter set to ${value}`;
};
