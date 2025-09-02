const fs = require('fs');
const path = require('path');

const ensureLogsDir = () => {
  if (process.env.NODE_ENV === 'production') {
    const logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }
};

module.exports = ensureLogsDir;
