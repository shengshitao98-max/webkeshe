const formatDate = () => {
  return new Date().toISOString();
};

const formatMessage = (level, message, data = {}) => {
  const logEntry = {
    timestamp: formatDate(),
    level,
    message,
    ...data,
  };
  return JSON.stringify(logEntry);
};

const logger = {
  info: (message, data = {}) => {
    console.log(formatMessage('INFO', message, data));
  },
  warn: (message, data = {}) => {
    console.warn(formatMessage('WARN', message, data));
  },
  error: (message, data = {}) => {
    console.error(formatMessage('ERROR', message, data));
  },
  debug: (message, data = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('DEBUG', message, data));
    }
  },
};

export default logger;
