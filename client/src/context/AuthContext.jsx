import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import apiClient, { setAccessToken as setGlobalAccessToken } from "../services/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Set access token both in state and in Axios client
  const updateAccessToken = (token) => {
    setAccessToken(token);
    setGlobalAccessToken(token);
  };

  // Attempt silent refresh on mount using the HttpOnly cookie
  const initAuth = useCallback(async () => {
    try {
      const res = await apiClient.post("/auth/refresh");
      if (res.data?.success && res.data?.data?.accessToken) {
        const token = res.data.data.accessToken;
        updateAccessToken(token);
        const meRes = await apiClient.get("/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.data?.success) {
          setUser(meRes.data.data.user);
        }
      }
    } catch {
      // User is not logged in / no active session
      setUser(null);
      updateAccessToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  /**
   * Log in with Email & Password
   */
  const login = async (email, password) => {
    const res = await apiClient.post("/auth/login", { email, password });
    if (res.data?.success) {
      if (res.data.data?.requires2FA) {
        return {
          requires2FA: true,
          challengeId: res.data.data.challengeId,
          tempToken: res.data.data.tempToken,
          maskedEmail: res.data.data.maskedEmail,
          method: res.data.data.method,
          message: res.data.message,
        };
      } else {
        updateAccessToken(res.data.data.accessToken);
        setUser(res.data.data.user);
        return { requires2FA: false, user: res.data.data.user };
      }
    }
    throw new Error(res.data?.message || "Login failed");
  };

  /**
   * Verify 2FA OTP to complete login
   */
  const verify2FA = async (challengeOrToken, otp) => {
    const payload = typeof challengeOrToken === "object"
      ? challengeOrToken
      : { challengeId: challengeOrToken, tempToken: challengeOrToken, otp };

    if (!payload.otp && otp) {
      payload.otp = otp;
    }

    const res = await apiClient.post("/auth/2fa/verify", payload);
    if (res.data?.success) {
      updateAccessToken(res.data.data.accessToken);
      setUser(res.data.data.user);
      return res.data.data.user;
    }
    throw new Error(res.data?.message || "OTP verification failed");
  };

  /**
   * Resend 2FA OTP code
   */
  const resend2FA = async (challengeId) => {
    const res = await apiClient.post("/auth/2fa/resend", { challengeId });
    return res.data;
  };

  /**
   * Log out and clear state
   */
  const logout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } catch (err) {
      console.warn("Logout error:", err.message);
    } finally {
      setUser(null);
      updateAccessToken(null);
    }
  };

  /**
   * Check if the authenticated user has a specific permission
   */
  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.isOwner || (user.roles && user.roles.includes("OWNER"))) return true;
    return user.permissions?.includes(permission) || false;
  };

  /**
   * Request 2FA enablement OTP
   */
  const requestEnable2FA = async () => {
    const res = await apiClient.post("/auth/2fa/enable");
    return res.data?.data;
  };

  /**
   * Confirm 2FA enablement
   */
  const confirmEnable2FA = async (otp) => {
    const res = await apiClient.post("/auth/2fa/confirm", { otp });
    if (res.data?.success) {
      setUser((prev) => (prev ? { ...prev, twoFactorEnabled: true } : prev));
    }
    return res.data;
  };

  /**
   * Disable 2FA
   */
  const disable2FA = async (password) => {
    const res = await apiClient.post("/auth/2fa/disable", { password });
    if (res.data?.success) {
      setUser((prev) => (prev ? { ...prev, twoFactorEnabled: false } : prev));
    }
    return res.data;
  };

  /**
   * Update Profile Details (First Name, Last Name, Phone)
   */
  const updateProfile = async ({ firstName, lastName, phone }) => {
    const res = await apiClient.put("/auth/me", { firstName, lastName, phone });
    if (res.data?.success && res.data.data?.user) {
      setUser((prev) => ({ ...prev, ...res.data.data.user }));
    }
    return res.data;
  };

  /**
   * Change Password
   */
  const changePassword = async (currentPassword, newPassword) => {
    const res = await apiClient.post("/auth/change-password", { currentPassword, newPassword });
    return res.data;
  };

  const value = {
    user,
    accessToken,
    loading,
    isAuthenticated: Boolean(user),
    login,
    verify2FA,
    resend2FA,
    logout,
    hasPermission,
    requestEnable2FA,
    confirmEnable2FA,
    disable2FA,
    updateProfile,
    changePassword,
    refreshUser: initAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
