// Date-related constants used across the application

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

export const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export const DAY_NAMES_SHORT = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'
];

// Helper function to get month name by index (0-based)
export const getMonthName = (monthIndex: number): string => {
  return MONTH_NAMES[monthIndex] || 'Unknown';
};

// Helper function to get month name by month number (1-based)
export const getMonthNameByNumber = (monthNumber: number): string => {
  return MONTH_NAMES[monthNumber - 1] || 'Unknown';
};
