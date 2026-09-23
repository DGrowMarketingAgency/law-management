import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import vaultApi from "../services/vaultService";
import { useAuth } from "./AuthContext";

const VaultContext = createContext(null);

export const VaultProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [vaultStatus, setVaultStatus] = useState({
    configured: false,
    locked: true,
    last_unlocked_at: null,
    auto_lock_minutes: 15,
    is_locked_out: false,
    locked_until: null,
    session_expires_at: null,
  });
  const [loading, setLoading] = useState(true);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [pendingCallback, setPendingCallback] = useState(null);

  const refreshVaultStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setVaultStatus({
        configured: false,
        locked: true,
        last_unlocked_at: null,
        auto_lock_minutes: 15,
        is_locked_out: false,
        locked_until: null,
        session_expires_at: null,
      });
      setLoading(false);
      return;
    }

    try {
      const status = await vaultApi.getStatus();
      if (status) {
        setVaultStatus(status);
      }
    } catch (err) {
      console.warn("Could not load vault status:", err.message);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refreshVaultStatus();
  }, [refreshVaultStatus]);

  // Periodic check to update auto-lock state when session expires
  useEffect(() => {
    if (!isAuthenticated || vaultStatus.locked) return;

    const interval = setInterval(() => {
      refreshVaultStatus();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [isAuthenticated, vaultStatus.locked, refreshVaultStatus]);

  const unlockVault = async (password) => {
    const res = await vaultApi.unlock(password);
    await refreshVaultStatus();
    if (pendingCallback && typeof pendingCallback === "function") {
      try {
        await pendingCallback();
      } catch (cbErr) {
        console.error("Post-unlock action error:", cbErr);
      }
      setPendingCallback(null);
    }
    setIsUnlockModalOpen(false);
    return res;
  };

  const lockVault = async () => {
    const res = await vaultApi.lock();
    await refreshVaultStatus();
    return res;
  };

  const setupVault = async (password) => {
    const res = await vaultApi.setup(password);
    await refreshVaultStatus();
    return res;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await vaultApi.changePassword(currentPassword, newPassword);
    await refreshVaultStatus();
    return res;
  };

  const revokeAllSessions = async () => {
    const res = await vaultApi.revokeAll();
    await refreshVaultStatus();
    return res;
  };

  const openUnlockModal = (callback = null) => {
    if (callback) {
      setPendingCallback(() => callback);
    } else {
      setPendingCallback(null);
    }
    setIsUnlockModalOpen(true);
  };

  const closeUnlockModal = () => {
    setIsUnlockModalOpen(false);
    setPendingCallback(null);
  };

  const value = {
    vaultStatus,
    isUnlocked: vaultStatus.configured && !vaultStatus.locked,
    isConfigured: vaultStatus.configured,
    isLockedOut: vaultStatus.is_locked_out,
    loading,
    isUnlockModalOpen,
    openUnlockModal,
    closeUnlockModal,
    unlockVault,
    lockVault,
    setupVault,
    changePassword,
    revokeAllSessions,
    refreshVaultStatus,
  };

  return (
    <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error("useVault must be used within a VaultProvider");
  }
  return context;
};
