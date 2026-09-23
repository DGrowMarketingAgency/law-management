import React from "react";
import { Routes, Route } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import Home from "../pages/Home";
import Login from "../pages/Login";
import Dashboard from "../pages/Dashboard";
import Users from "../pages/Users";
import CrmDashboard from "../pages/CrmDashboard";
import Contacts from "../pages/Contacts";
import ContactDetail from "../pages/ContactDetail";
import Clients from "../pages/Clients";
import ClientDetail from "../pages/ClientDetail";
import Leads from "../pages/Leads";
import LeadDetail from "../pages/LeadDetail";
import FollowUps from "../pages/FollowUps";
import Appointments from "../pages/Appointments";
import CourtsPage from "../pages/courts/CourtsPage";
import CasesPage from "../pages/cases/CasesPage";
import CaseCreatePage from "../pages/cases/CaseCreatePage";
import CaseDetailPage from "../pages/cases/CaseDetailPage";
import CauseListPage from "../pages/cause-list/CauseListPage";
import DeadlineDashboardPage from "../pages/deadlines/DeadlineDashboardPage";
import DeadlineRulesPage from "../pages/deadlines/DeadlineRulesPage";
import DocumentsPage from "../pages/documents/DocumentsPage";
import DocumentDetailPage from "../pages/documents/DocumentDetailPage";
import CreateDocumentPage from "../pages/documents/CreateDocumentPage";
import DocumentTemplatesPage from "../pages/documents/DocumentTemplatesPage";
import DocumentSettingsPage from "../pages/documents/DocumentSettingsPage";
import VaultSettingsPage from "../pages/vault/VaultSettingsPage";
import BillingDashboardPage from "../pages/billing/BillingDashboardPage";
import InvoicesPage from "../pages/billing/InvoicesPage";
import CreateInvoicePage from "../pages/billing/CreateInvoicePage";
import InvoiceDetailPage from "../pages/billing/InvoiceDetailPage";
import FeeEntriesPage from "../pages/billing/FeeEntriesPage";
import PaymentsPage from "../pages/billing/PaymentsPage";
import PaymentDetailPage from "../pages/billing/PaymentDetailPage";
import ClientPaymentPage from "../pages/billing/ClientPaymentPage";
import PaymentResultPage from "../pages/billing/PaymentResultPage";
import PaymentGatewaySettingsPage from "../pages/settings/PaymentGatewaySettingsPage";
import SecuritySettingsPage from "../pages/settings/SecuritySettingsPage";
import EmailSettingsPage from "../pages/settings/EmailSettingsPage";
import EmailTemplatesPage from "../pages/settings/EmailTemplatesPage";
import WhatsAppSettingsPage from "../pages/settings/WhatsAppSettingsPage";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import VerifyEmail from "../pages/VerifyEmail";
import RetainersPage from "../pages/billing/RetainersPage";
import ClientBillingPage from "../pages/billing/ClientBillingPage";
import ProfilePage from "../pages/ProfilePage";
import WorkforceDashboardPage from "../pages/workforce/WorkforceDashboardPage";
import WorkforceDirectoryPage from "../pages/workforce/WorkforceDirectoryPage";
import WorkforceDetailPage from "../pages/workforce/WorkforceDetailPage";
import WorkforceEditPage from "../pages/workforce/WorkforceEditPage";
import CandidatePipelinePage from "../pages/workforce/CandidatePipelinePage";
import AttendancePage from "../pages/workforce/AttendancePage";
import LeaveManagementPage from "../pages/workforce/LeaveManagementPage";
import WorkforceTasksPage from "../pages/workforce/WorkforceTasksPage";
import PayrollPage from "../pages/workforce/PayrollPage";
import AssetsPage from "../pages/workforce/AssetsPage";
import OffboardingPage from "../pages/workforce/OffboardingPage";
import FirstOwnerSetup from "../pages/FirstOwnerSetup";
import NotFound from "../pages/NotFound";
import ProtectedRoute from "../components/ProtectedRoute";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Home />} />
        <Route path="setup" element={<FirstOwnerSetup />} />
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />

        {/* Account Profile Page */}
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Foundation Dashboard */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Users & RBAC */}
        <Route
          path="users"
          element={
            <ProtectedRoute requiredPermission="USER_VIEW">
              <Users />
            </ProtectedRoute>
          }
        />

        {/* CRM Foundation Routes */}
        <Route
          path="crm"
          element={
            <ProtectedRoute requiredPermission="CONTACT_VIEW">
              <CrmDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="contacts"
          element={
            <ProtectedRoute requiredPermission="CONTACT_VIEW">
              <Contacts />
            </ProtectedRoute>
          }
        />

        <Route
          path="contacts/:id"
          element={
            <ProtectedRoute requiredPermission="CONTACT_VIEW">
              <ContactDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="clients"
          element={
            <ProtectedRoute requiredPermission="CONTACT_VIEW">
              <Clients />
            </ProtectedRoute>
          }
        />

        <Route
          path="clients/:id"
          element={
            <ProtectedRoute requiredPermission="CONTACT_VIEW">
              <ClientDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="leads"
          element={
            <ProtectedRoute requiredPermission="LEAD_VIEW">
              <Leads />
            </ProtectedRoute>
          }
        />

        <Route
          path="leads/:id"
          element={
            <ProtectedRoute requiredPermission="LEAD_VIEW">
              <LeadDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="follow-ups"
          element={
            <ProtectedRoute requiredPermission="FOLLOWUP_VIEW">
              <FollowUps />
            </ProtectedRoute>
          }
        />

        <Route
          path="appointments"
          element={
            <ProtectedRoute requiredPermission="APPOINTMENT_VIEW">
              <Appointments />
            </ProtectedRoute>
          }
        />

        {/* Prompt 5: Courts, Cases & Cause List Routes */}
        <Route
          path="courts"
          element={
            <ProtectedRoute requiredPermission="COURT_VIEW">
              <CourtsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="cases"
          element={
            <ProtectedRoute requiredPermission="CASE_VIEW">
              <CasesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="cases/new"
          element={
            <ProtectedRoute requiredPermission="CASE_CREATE">
              <CaseCreatePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="cases/:id"
          element={
            <ProtectedRoute requiredPermission="CASE_VIEW">
              <CaseDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="cause-list"
          element={
            <ProtectedRoute requiredPermission="CAUSELIST_VIEW">
              <CauseListPage />
            </ProtectedRoute>
          }
        />

        {/* Prompt 6: Limitation Act Deadlines & Rules Routes */}
        <Route
          path="deadlines"
          element={
            <ProtectedRoute requiredPermission="DEADLINE_VIEW">
              <DeadlineDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="deadline-rules"
          element={
            <ProtectedRoute requiredPermission="DEADLINE_RULE_VIEW">
              <DeadlineRulesPage />
            </ProtectedRoute>
          }
        />

        {/* Prompt 7 & Prompt 11: Document Management Routes */}
        <Route
          path="documents"
          element={
            <ProtectedRoute requiredPermission="DOCUMENT_VIEW">
              <DocumentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="documents/new"
          element={
            <ProtectedRoute requiredPermission="DOCUMENT_CREATE">
              <CreateDocumentPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="documents/templates"
          element={
            <ProtectedRoute requiredPermission="DOCUMENT_VIEW">
              <DocumentTemplatesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="documents/settings"
          element={
            <ProtectedRoute requiredPermission="DOCUMENT_VIEW">
              <DocumentSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="documents/:documentId"
          element={
            <ProtectedRoute requiredPermission="DOCUMENT_VIEW">
              <DocumentDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="cases/:caseId/documents"
          element={
            <ProtectedRoute requiredPermission="DOCUMENT_VIEW">
              <DocumentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="cases/:caseId/documents/:documentId"
          element={
            <ProtectedRoute requiredPermission="DOCUMENT_VIEW">
              <DocumentDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Prompt 7A: Document Vault & Security Settings */}
        <Route
          path="vault"
          element={
            <ProtectedRoute>
              <VaultSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="settings/vault"
          element={
            <ProtectedRoute>
              <VaultSettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Prompt 8: Billing, Invoicing, Retainers & Client Portal */}
        <Route
          path="billing"
          element={
            <ProtectedRoute requiredPermission="INVOICE_VIEW">
              <BillingDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="invoices"
          element={
            <ProtectedRoute requiredPermission="INVOICE_VIEW">
              <InvoicesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="invoices/new"
          element={
            <ProtectedRoute requiredPermission="INVOICE_CREATE">
              <CreateInvoicePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="invoices/:id"
          element={
            <ProtectedRoute requiredPermission="INVOICE_VIEW">
              <InvoiceDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="fee-entries"
          element={
            <ProtectedRoute requiredPermission="FEE_ENTRY_VIEW">
              <FeeEntriesPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="payments"
          element={
            <ProtectedRoute requiredPermission="PAYMENT_VIEW">
              <PaymentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="billing/payments"
          element={
            <ProtectedRoute requiredPermission="PAYMENT_VIEW">
              <PaymentsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="billing/payments/:id"
          element={
            <ProtectedRoute requiredPermission="PAYMENT_VIEW">
              <PaymentDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="payments/:id"
          element={
            <ProtectedRoute requiredPermission="PAYMENT_VIEW">
              <PaymentDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Client-facing Online Payment Portal & Callbacks */}
        <Route
          path="billing/pay/:invoiceId"
          element={<ClientPaymentPage />}
        />

        <Route
          path="billing/payment-result"
          element={<PaymentResultPage />}
        />

        {/* Firm Payment Gateway & Bank Account Settings */}
        <Route
          path="settings/payment-gateways"
          element={
            <ProtectedRoute requiredPermission="PAYMENT_GATEWAY_CONFIG">
              <PaymentGatewaySettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="retainers"
          element={
            <ProtectedRoute requiredPermission="RETAINER_VIEW">
              <RetainersPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="portal/billing"
          element={
            <ProtectedRoute requiredPermission="CLIENT_BILLING_VIEW">
              <ClientBillingPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="client-billing"
          element={
            <ProtectedRoute requiredPermission="CLIENT_BILLING_VIEW">
              <ClientBillingPage />
            </ProtectedRoute>
          }
        />

        {/* Prompt 10: Complete Employee & Internship Management Routes */}
        <Route
          path="workforce"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_VIEW">
              <WorkforceDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/directory"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_VIEW">
              <WorkforceDirectoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/members/:id"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_VIEW">
              <WorkforceDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/profiles/:id"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_VIEW">
              <WorkforceDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/:id"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_VIEW">
              <WorkforceDetailPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/members/:id/edit"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_UPDATE">
              <WorkforceEditPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/profiles/:id/edit"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_UPDATE">
              <WorkforceEditPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/:id/edit"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_UPDATE">
              <WorkforceEditPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/candidates"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_RECRUITMENT">
              <CandidatePipelinePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/attendance"
          element={
            <ProtectedRoute requiredPermission="ATTENDANCE_VIEW">
              <AttendancePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/leaves"
          element={
            <ProtectedRoute requiredPermission="LEAVE_VIEW">
              <LeaveManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/tasks"
          element={
            <ProtectedRoute requiredPermission="TASK_VIEW">
              <WorkforceTasksPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/payroll"
          element={
            <ProtectedRoute requiredPermission="PAYROLL_VIEW">
              <PayrollPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/assets"
          element={
            <ProtectedRoute requiredPermission="ASSET_VIEW">
              <AssetsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="workforce/offboarding"
          element={
            <ProtectedRoute requiredPermission="WORKFORCE_OFFBOARD">
              <OffboardingPage />
            </ProtectedRoute>
          }
        />

        {/* Prompt 12: Security & Email Administration Settings */}
        <Route
          path="settings/security"
          element={
            <ProtectedRoute>
              <SecuritySettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="settings/email"
          element={
            <ProtectedRoute requiredPermission="EMAIL_VIEW">
              <EmailSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="settings/email-templates"
          element={
            <ProtectedRoute requiredPermission="EMAIL_TEMPLATE_VIEW">
              <EmailTemplatesPage />
            </ProtectedRoute>
          }
        />

        {/* WhatsApp Hearing Reminder Settings */}
        <Route
          path="settings/whatsapp"
          element={
            <ProtectedRoute requiredPermission="WHATSAPP_SETTINGS_VIEW">
              <WhatsAppSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;
