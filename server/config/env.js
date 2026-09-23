const path = require("path");
const dotenv = require("dotenv");

// Attempt to load .env from workspace root first, then fallback to current directory
const rootEnvPath = path.resolve(__dirname, "../../.env");
const localEnvPath = path.resolve(process.cwd(), ".env");

dotenv.config({ path: rootEnvPath });
dotenv.config({ path: localEnvPath });

const isProduction = (process.env.NODE_ENV || "development") === "production";

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  isProduction,
  isDevelopment: !isProduction,

  PORT: parseInt(process.env.PORT, 10) || 5000,

  // Database Configuration
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    name: process.env.DB_NAME || "legal_practice",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT, 10) || 0,
    waitForConnections: true,
  },

  // CORS Configuration
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",

  // Authentication Configuration
  jwt: {
    secret:
      process.env.JWT_ACCESS_SECRET ||
      process.env.JWT_SECRET ||
      (!isProduction ? "dev_access_secret_only_for_local_debugging_389271" : ""),
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ||
      (!isProduction ? "dev_refresh_secret_only_for_local_debugging_389271" : ""),
    expiresIn: process.env.JWT_EXPIRES_IN || "15m",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    refreshExpiryDays: 7,
  },

  otp: {
    expiresMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || process.env.OTP_EXPIRES_MINUTES, 10) || 5,
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5,
    resendCooldownSeconds: parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60,
    maxResends: parseInt(process.env.OTP_MAX_RESENDS, 10) || 5,
  },

  passwordReset: {
    expiresMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRY_MINUTES, 10) || 30,
  },

  email: {
    enabled: process.env.EMAIL_ENABLED !== "false",
    maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES, 10) || 3,
    rateLimitPerHour: parseInt(process.env.EMAIL_RATE_LIMIT_PER_HOUR, 10) || 5,
    smtp: {
      host: process.env.SMTP_HOST || "",
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true",
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "",
    },
    from: process.env.EMAIL_FROM || process.env.SMTP_FROM || "chambers@legalpractice.com",
    fromName: process.env.EMAIL_FROM_NAME || "Chambers of Advocate",
    replyTo: process.env.EMAIL_REPLY_TO || "",
    appUrl: process.env.APP_URL || process.env.CLIENT_URL || "http://localhost:5173",
  },

  // Secure HttpOnly Cookie Settings for Refresh Token
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  },

  // Document Storage & Security Configuration
  storage: {
    provider: process.env.DOCUMENT_STORAGE_PROVIDER || "local",
    localBasePath:
      process.env.DOCUMENT_STORAGE_PATH ||
      path.resolve(__dirname, "../../private-storage/documents"),
    maxFileSizeMb:
      parseInt(
        process.env.DOCUMENT_MAX_FILE_SIZE_MB ||
          process.env.MAX_DOCUMENT_SIZE_MB,
        10
      ) || 10,
    externalLinksEnabled:
      process.env.DOCUMENT_EXTERNAL_LINKS_ENABLED !== "false",
    externalLinkHttpsOnly:
      process.env.DOCUMENT_EXTERNAL_LINK_HTTPS_ONLY !== "false",
    allowedMimeTypes: (
      process.env.DOCUMENT_ALLOWED_MIME_TYPES ||
      "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain,image/jpeg,image/png"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  // Document Vault & Envelope Encryption Configuration
  vault: {
    autoLockMinutes: parseInt(process.env.VAULT_AUTO_LOCK_MINUTES, 10) || 15,
    maxFailedAttempts: parseInt(process.env.VAULT_MAX_FAILED_ATTEMPTS, 10) || 5,
    lockoutMinutes: parseInt(process.env.VAULT_LOCKOUT_MINUTES, 10) || 15,
    unlockRateLimitWindowMs:
      parseInt(process.env.VAULT_UNLOCK_RATE_LIMIT_WINDOW_MS, 10) ||
      15 * 60 * 1000,
    unlockRateLimitMax:
      parseInt(process.env.VAULT_UNLOCK_RATE_LIMIT_MAX, 10) || 5,
    cookieName: "vault_session",
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
      path: "/api/v1",
      maxAge:
        (parseInt(process.env.VAULT_AUTO_LOCK_MINUTES, 10) || 15) * 60 * 1000,
    },
  },

  encryption: {
    algorithm: process.env.DOCUMENT_ENCRYPTION_ALGORITHM || "aes-256-gcm",
    version: parseInt(process.env.DOCUMENT_ENCRYPTION_VERSION, 10) || 1,
  },

  /**
   * Validate required environment variables on server startup
   * In production mode, halts startup if any critical variable is missing or placeholder.
   */
  validateEnv: () => {
    const isProd = (process.env.NODE_ENV || "development") === "production";

    if (!isProd) {
      // In development, provide helpful warnings without halting
      if (!process.env.JWT_ACCESS_SECRET && !process.env.JWT_SECRET) {
        console.warn("[Env Warning]: Neither JWT_ACCESS_SECRET nor JWT_SECRET is set in .env. Using ephemeral development key.");
      }
      return { valid: true, mode: "development" };
    }

    // Strict Production Checks
    const requiredVars = [
      "DB_HOST",
      "DB_PORT",
      "DB_NAME",
      "DB_USER",
      "DB_PASSWORD",
      "EMAIL_ENABLED",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",
      "EMAIL_FROM",
      "APP_URL",
    ];

    const insecurePlaceholders = [
      "replace_this_later",
      "your_jwt_secret_key_change_in_production",
      "your_jwt_refresh_secret_key_change_in_production",
      "your_database_password_here",
      "your_smtp_app_password_here",
      "password",
      "password123",
      "secret",
      "secret123",
      "123456",
      "changeme",
      "defaultsecret",
      "admin",
      "admin123",
    ];

    const missing = [];
    const invalid = [];

    // Check JWT secrets specifically
    const accessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret) {
      missing.push("JWT_ACCESS_SECRET");
    } else if (insecurePlaceholders.includes(accessSecret.toLowerCase())) {
      invalid.push("JWT_ACCESS_SECRET (contains insecure default placeholder)");
    }

    if (!refreshSecret) {
      missing.push("JWT_REFRESH_SECRET");
    } else if (insecurePlaceholders.includes(refreshSecret.toLowerCase())) {
      invalid.push("JWT_REFRESH_SECRET (contains insecure default placeholder)");
    }

    for (const varName of requiredVars) {
      const val = process.env[varName];
      if (!val || String(val).trim().length === 0) {
        missing.push(varName);
      } else if (insecurePlaceholders.includes(String(val).toLowerCase().trim())) {
        invalid.push(`${varName} (contains insecure default placeholder)`);
      }
    }

    if (missing.length > 0 || invalid.length > 0) {
      console.error("\n==================================================================");
      console.error("FATAL: PRODUCTION ENVIRONMENT CONFIGURATION ERROR");
      console.error("The application cannot start in production mode (NODE_ENV=production)");
      console.error("due to missing or insecure required environment variables.");
      console.error("==================================================================");
      if (missing.length > 0) {
        console.error("\nMissing Required Environment Variables:");
        missing.forEach((m) => console.error(`  - ${m}`));
      }
      if (invalid.length > 0) {
        console.error("\nInsecure / Placeholder Values Detected:");
        invalid.forEach((inv) => console.error(`  - ${inv}`));
      }
      console.error("\nPlease configure real production secrets in your .env file.");
      console.error("Refer to .env.example for required parameter definitions.");
      console.error("==================================================================\n");
      process.exit(1);
    }

    console.log("[Environment]: Production configuration verified successfully.");
    return { valid: true, mode: "production" };
  },
};

module.exports = env;

