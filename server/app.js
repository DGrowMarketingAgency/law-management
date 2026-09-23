const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const cookieParser = require("cookie-parser");
const env = require("./config/env");
const requestLogger = require("./middleware/requestLogger");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const apiRoutes = require("./routes/index");

// 1. Initialize Express application
const app = express();

// 2. Configure Security Headers (Helmet)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// 3. Configure CORS with restricted origin from environment
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server) in dev
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      env.clientUrl,
      // Also allow localhost variations in development
      ...(env.isDevelopment
        ? ["http://localhost:5173", "http://127.0.0.1:5173"]
        : []),
    ];

    // Allow localhost, 127.0.0.1, and local private IP addresses (192.168.x.x, 10.x.x.x, etc.) in development
    const isLocalNetwork =
      env.isDevelopment &&
      (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin));

    if (allowedOrigins.includes(origin) || isLocalNetwork) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} is not allowed by CORS policy`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));

// 4. Rate Limiting to prevent brute-force / abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per 15 minutes
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    message: "Too many requests from this IP, please try again later.",
    error: { code: "RATE_LIMIT_EXCEEDED" },
  },
});
app.use("/api", apiLimiter);

// 5. Configure Body Parsers & Cookie Parser
app.use(
  express.json({
    limit: "2mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

// 6. Register Request Logger
app.use(requestLogger);

// 7. Register API Routes under /api/v1
app.use("/api/v1", apiRoutes);

// 8. Register 404 Middleware
app.use(notFound);

// 9. Register Global Error Handler
app.use(errorHandler);

module.exports = app;
