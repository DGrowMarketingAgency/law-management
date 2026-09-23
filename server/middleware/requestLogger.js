/**
 * Simple request logger middleware for development and auditing
 * Logs: HTTP method, URL, status code, and response time.
 * Explicitly omits sensitive headers, request bodies, tokens, and credentials.
 */
const requestLogger = (req, res, next) => {
  const startTime = process.hrtime();

  res.on("finish", () => {
    const elapsed = process.hrtime(startTime);
    const responseTimeMs = (elapsed[0] * 1000 + elapsed[1] / 1e6).toFixed(2);
    const method = req.method;
    const url = req.originalUrl || req.url;
    const statusCode = res.statusCode;

    // Filter status code coloring or formatting if in terminal
    const logLine = `[${new Date().toISOString()}] ${method} ${url} ${statusCode} - ${responseTimeMs}ms`;

    if (statusCode >= 500) {
      console.error(`\x1b[31m${logLine}\x1b[0m`);
    } else if (statusCode >= 400) {
      console.warn(`\x1b[33m${logLine}\x1b[0m`);
    } else {
      console.log(`\x1b[32m${logLine}\x1b[0m`);
    }
  });

  next();
};

module.exports = requestLogger;
