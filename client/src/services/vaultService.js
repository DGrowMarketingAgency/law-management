import apiClient from "./api";

/**
 * Vault API Service
 * Coordinates with backend /api/v1/vault endpoints.
 * Session tokens are managed securely via HttpOnly cookies and never handled in plain JS.
 */
class VaultService {
  /**
   * Get current user vault status
   */
  async getStatus() {
    const response = await apiClient.get("/vault/status");
    return response.data?.data;
  }

  /**
   * Set up initial document vault password
   */
  async setup(vaultPassword) {
    const response = await apiClient.post("/vault/setup", {
      vault_password: vaultPassword,
    });
    return response.data;
  }

  /**
   * Unlock vault with document vault password
   */
  async unlock(vaultPassword) {
    const response = await apiClient.post("/vault/unlock", {
      vault_password: vaultPassword,
    });
    return response.data;
  }

  /**
   * Lock document vault and revoke current session
   */
  async lock() {
    const response = await apiClient.post("/vault/lock");
    return response.data;
  }

  /**
   * Change document vault password (rewraps master vault key)
   */
  async changePassword(currentPassword, newPassword) {
    const response = await apiClient.post("/vault/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  }

  /**
   * Revoke all active vault sessions for current user
   */
  async revokeAll() {
    const response = await apiClient.post("/vault/revoke-all");
    return response.data;
  }
}

export default new VaultService();
