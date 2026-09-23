import React from "react";
import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { VaultProvider } from "./context/VaultContext";
import VaultUnlockModal from "./components/vault/VaultUnlockModal";

function App() {
  return (
    <AuthProvider>
      <VaultProvider>
        <AppRoutes />
        <VaultUnlockModal />
      </VaultProvider>
    </AuthProvider>
  );
}

export default App;
