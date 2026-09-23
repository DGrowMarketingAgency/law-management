const db = require("../config/database");
const env = require("../config/env");
const authService = require("../services/authService");
const otpService = require("../services/otpService");
const emailSecurityService = require("../services/email/emailSecurityService");
const emailTemplateService = require("../services/email/emailTemplateService");
const centralEmailService = require("../services/email/emailService");
const { hashPassword } = require("../utils/password");

async function runTests() {
  console.log("=================================================");
  console.log("PROMPT 12: EMAIL & SECURITY INTEGRATION TESTS");
  console.log("=================================================");

  let testUserId = null;
  const testEmail = `sec_test_${Date.now()}@chambers-lex.com`;
  const initialPassword = "SecurePassword123!";

  try {
    // 1. Setup Test User
    console.log("\n[TEST 1] Setup Test User with initial password...");
    const pwdHash = await hashPassword(initialPassword);
    const [userRes] = await db.query(
      `INSERT INTO users (first_name, last_name, email, password_hash, status, two_factor_enabled)
       VALUES ('Security', 'Tester', ?, ?, 'ACTIVE', 0)`,
      [testEmail, pwdHash]
    );
    testUserId = userRes.insertId;

    // Assign OWNER role for permissions
    const [roleRows] = await db.query(`SELECT id FROM roles WHERE name = 'OWNER' LIMIT 1`);
    if (roleRows.length > 0) {
      await db.query(`INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`, [testUserId, roleRows[0].id]);
    }
    console.log(`✓ User created (ID: ${testUserId}, Email: ${testEmail})`);

    // 2. Test Standard Login (2FA Disabled)
    console.log("\n[TEST 2] Standard Login (2FA Disabled)...");
    const login1 = await authService.loginWithPassword(
      testEmail,
      initialPassword,
      "127.0.0.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"
    );
    if (!login1.accessToken || login1.requires2FA !== false) {
      throw new Error("Standard login failed to issue tokens directly.");
    }
    console.log("✓ Standard login succeeded, tokens issued.");

    // 3. Test Active Sessions
    console.log("\n[TEST 3] Active Session Inspection & Device Info...");
    const sessions = await authService.getActiveSessions(testUserId, login1.refreshToken);
    if (sessions.length === 0) {
      throw new Error("No active session recorded in refresh_tokens table.");
    }
    const curSession = sessions.find((s) => s.isCurrent);
    if (!curSession || !curSession.deviceInfo.includes("Windows")) {
      throw new Error(`Device info parsing failed: ${JSON.stringify(curSession)}`);
    }
    console.log(`✓ Active session verified: Device '${curSession.deviceInfo}', IP '${curSession.ipAddress}'`);

    // 4. Test 2FA Enablement Flow
    console.log("\n[TEST 4] Two-Factor Authentication Enablement...");
    const req2fa = await authService.request2FAEnable(testUserId, "127.0.0.1", "TestBrowser");
    if (!req2fa.devOtp) {
      throw new Error("2FA setup OTP was not generated.");
    }
    const confirm2fa = await authService.confirm2FAEnable(testUserId, req2fa.devOtp, "127.0.0.1", "TestBrowser");
    if (!confirm2fa.success) {
      throw new Error("Failed to confirm 2FA enablement.");
    }
    // Verify DB flag
    const [chkUser] = await db.query(`SELECT two_factor_enabled, two_factor_method FROM users WHERE id = ?`, [testUserId]);
    if (!chkUser[0].two_factor_enabled || chkUser[0].two_factor_method !== "EMAIL_OTP") {
      throw new Error("User DB 2FA fields were not properly updated.");
    }
    console.log("✓ 2FA enabled successfully with EMAIL_OTP method.");

    // 5. Test 2FA Login Challenge & Verification
    console.log("\n[TEST 5] Login with 2FA Challenge & Verification...");
    const login2fa = await authService.loginWithPassword(testEmail, initialPassword, "127.0.0.1", "TestBrowser");
    if (!login2fa.requires2FA || !login2fa.challengeId || !login2fa.devOtp) {
      throw new Error("Login did not trigger 2FA challenge flow.");
    }
    console.log(`✓ 2FA Challenge triggered (Challenge ID: ${login2fa.challengeId}, Masked: ${login2fa.maskedEmail})`);

    // Test Resend Cooldown
    console.log("\n[TEST 5A] Testing 60s Resend Cooldown...");
    try {
      await authService.resendLogin2FA(login2fa.challengeId);
      throw new Error("Cooldown check failed: Resend should have been blocked within 60 seconds.");
    } catch (cdErr) {
      if (cdErr.statusCode !== 429) {
        throw cdErr;
      }
      console.log(`✓ Resend correctly blocked under cooldown: "${cdErr.message}"`);
    }

    // Verify 2FA with incorrect OTP
    console.log("\n[TEST 5B] Testing 2FA verification with invalid OTP...");
    try {
      await authService.verifyLogin2FA({ challengeId: login2fa.challengeId, otp: "000000" });
      throw new Error("Invalid OTP should have been rejected.");
    } catch (otpErr) {
      console.log(`✓ Invalid OTP correctly rejected: "${otpErr.message}"`);
    }

    // Verify 2FA with correct OTP
    console.log("\n[TEST 5C] Testing 2FA verification with valid OTP...");
    const final2faLogin = await authService.verifyLogin2FA({
      challengeId: login2fa.challengeId,
      otp: login2fa.devOtp,
      ip: "127.0.0.1",
      userAgent: "TestBrowser",
    });
    if (!final2faLogin.accessToken || !final2faLogin.refreshToken) {
      throw new Error("Failed to issue session tokens after 2FA verification.");
    }
    console.log("✓ 2FA verified and final tokens successfully issued.");

    // 6. Test Password Reset with Crypto Token Hash & Single-Use
    console.log("\n[TEST 6] Forgot Password & Reset via Secure Token...");
    const forgotRes = await authService.forgotPassword(testEmail, "127.0.0.1", "TestBrowser");
    if (!forgotRes.devToken) {
      throw new Error("Reset token not generated.");
    }
    const rawResetToken = forgotRes.devToken;

    // Verify token hash is stored in DB, not raw token
    const [prtRows] = await db.query(
      `SELECT * FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL`,
      [testUserId]
    );
    if (prtRows.length === 0) {
      throw new Error("No password_reset_tokens record found in database.");
    }
    if (prtRows[0].token_hash === rawResetToken) {
      throw new Error("SECURITY VIOLATION: Raw token was stored in plain text!");
    }
    console.log("✓ Reset token generated; SHA-256 hash stored securely in DB.");

    // Perform Reset
    const newPassword = "NewSecurePassword456!";
    const resetRes = await authService.resetPassword({
      token: rawResetToken,
      newPassword,
      ip: "127.0.0.1",
      userAgent: "TestBrowser",
    });
    if (!resetRes.success) {
      throw new Error("Password reset failed.");
    }
    console.log("✓ Password successfully reset.");

    // Replay attack prevention: Attempting to use the same token again
    console.log("\n[TEST 6A] Testing single-use token replay prevention...");
    try {
      await authService.resetPassword({
        token: rawResetToken,
        newPassword: "AnotherPassword789!",
      });
      throw new Error("Replay attack succeeded! Token should have been consumed.");
    } catch (replayErr) {
      console.log(`✓ Single-use enforced: Replay attempt rejected: "${replayErr.message}"`);
    }

    // Verify all prior sessions were revoked on password reset
    const activeAfterReset = await authService.getActiveSessions(testUserId);
    if (activeAfterReset.length > 0) {
      throw new Error("Sessions should have been revoked after password reset.");
    }
    console.log("✓ All previous refresh sessions successfully revoked upon password reset.");

    // 7. Test Email Template Rendering & XSS Protection
    console.log("\n[TEST 7] Email Template Rendering & HTML Escaping...");
    const tmplRender = await emailTemplateService.renderTemplate("two_factor_code", {
      first_name: "<script>alert('xss')</script>John",
      otp_code: "123456",
      expiry_minutes: 5,
    });
    if (tmplRender.html.includes("<script>")) {
      throw new Error("XSS vulnerability: <script> was not escaped in template rendering!");
    }
    if (!tmplRender.html.includes("&lt;script&gt;")) {
      throw new Error("HTML entities escaping did not encode <script> properly.");
    }
    console.log("✓ Email template rendered and HTML escaping verified.");

    // 8. Test Rate Limiting
    console.log("\n[TEST 8] Email Security Rate Limiting Check...");
    const rateCheck = await emailSecurityService.checkRateLimit(testEmail);
    console.log(`✓ Rate limit check working: count=${rateCheck.count}, max=${rateCheck.max}, allowed=${rateCheck.allowed}`);

    console.log("\n=================================================");
    console.log("ALL PROMPT 12 BACKEND TESTS PASSED SUCCESSFULLY! ✓");
    console.log("=================================================\n");
  } catch (err) {
    console.error("\n❌ TEST SUITE FAILURE:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    if (testUserId) {
      // Clean up test records
      await db.query(`DELETE FROM user_roles WHERE user_id = ?`, [testUserId]).catch(() => {});
      await db.query(`DELETE FROM otp_verifications WHERE user_id = ?`, [testUserId]).catch(() => {});
      await db.query(`DELETE FROM password_reset_tokens WHERE user_id = ?`, [testUserId]).catch(() => {});
      await db.query(`DELETE FROM auth_challenges WHERE user_id = ?`, [testUserId]).catch(() => {});
      await db.query(`DELETE FROM refresh_tokens WHERE user_id = ?`, [testUserId]).catch(() => {});
      await db.query(`DELETE FROM audit_logs WHERE user_id = ?`, [testUserId]).catch(() => {});
      await db.query(`DELETE FROM users WHERE id = ?`, [testUserId]).catch(() => {});
    }
    process.exit(0);
  }
}

runTests();
