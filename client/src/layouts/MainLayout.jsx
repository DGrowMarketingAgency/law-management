import React, { useState, useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  IconDashboard,
  IconScale,
  IconList,
  IconClock,
  IconFolder,
  IconChart,
  IconUsers,
  IconBriefcase,
  IconTarget,
  IconPhone,
  IconCalendar,
  IconCourthouse,
  IconBook,
  IconShield,
  IconLogout,
  IconUser,
  IconLock,
  IconMenu,
  IconClose,
  IconInvoice,
  IconPayment,
  IconRetainer,
  IconHourglass,
  IconChevronDown,
  IconLaptop,
  IconUserMinus,
  IconCheckSquare,
  IconUserCheck,
  IconDollarSign,
  IconFileText,
} from "../components/common/Icons";
import VaultStatusBadge from "../components/vault/VaultStatusBadge";

const MainLayout = () => {
  const { user, isAuthenticated, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openSection, setOpenSection] = useState(null);

  const toggleSection = (sectionKey) => {
    setOpenSection((prev) => (prev === sectionKey ? null : sectionKey));
  };

  // Auto-close sidebar drawer on route change on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };


  return (
    <div className="app-container">
      {/* Mobile Backdrop Overlay */}
      {isAuthenticated && sidebarOpen && (
        <div
          className="sidebar-backdrop active"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 1. FIXED / OFF-CANVAS SIDEBAR */}
      {isAuthenticated && (
        <aside className={`chambers-sidebar ${sidebarOpen ? "sidebar-mobile-open" : ""}`}>
          {/* Sidebar Brand Header in Pure Black & White with Mobile Close Button */}
          <div className="sidebar-header-wrapper">
            <Link to="/dashboard" className="sidebar-brand" onClick={() => setSidebarOpen(false)}>
              <img src="/law logo.png" alt="DG Legal Practice" className="brand-logo-img" />
              <div className="brand-text">
                <h2>Legal Practice</h2>
                <p>Chambers Platform</p>
              </div>
            </Link>
            <button
              type="button"
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar menu"
            >
              <IconClose size={20} />
            </button>
          </div>

          <div className="sidebar-scrollable-content">
            {/* 1. Core Operations */}
            <button
              type="button"
              className={`sidebar-section-header ${openSection === "core" ? "is-open" : ""}`}
              onClick={() => toggleSection("core")}
              aria-expanded={openSection === "core"}
            >
              <span>Core Operations</span>
              <span className={`sidebar-section-chevron ${openSection === "core" ? "open" : ""}`}>
                <IconChevronDown size={13} />
              </span>
            </button>
            {openSection === "core" && (
              <nav className="sidebar-nav">
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconDashboard />
                  </span>
                  <span>Dashboard</span>
                </NavLink>

                {hasPermission("CASE_VIEW") && (
                  <NavLink
                    to="/cases"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconScale />
                    </span>
                    <span>Cases & Matters</span>
                  </NavLink>
                )}

                {hasPermission("CAUSELIST_VIEW") && (
                  <NavLink
                    to="/cause-list"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconList />
                    </span>
                    <span>Cause List</span>
                  </NavLink>
                )}

                {hasPermission("DEADLINE_VIEW") && (
                  <NavLink
                    to="/deadlines"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconClock />
                    </span>
                    <span>Limitation Deadlines</span>
                  </NavLink>
                )}

                {hasPermission("DOCUMENT_VIEW") && (
                  <NavLink
                    to="/documents"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconFolder />
                    </span>
                    <span>Document Repository</span>
                  </NavLink>
                )}

                {hasPermission("DOCUMENT_VIEW") && (
                  <NavLink
                    to="/documents/templates"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconFileText />
                    </span>
                    <span>Legal Templates</span>
                  </NavLink>
                )}
              </nav>
            )}

            {/* 2. CRM & Practice */}
            <button
              type="button"
              className={`sidebar-section-header ${openSection === "crm" ? "is-open" : ""}`}
              onClick={() => toggleSection("crm")}
              aria-expanded={openSection === "crm"}
            >
              <span>CRM & Practice</span>
              <span className={`sidebar-section-chevron ${openSection === "crm" ? "open" : ""}`}>
                <IconChevronDown size={13} />
              </span>
            </button>
            {openSection === "crm" && (
              <nav className="sidebar-nav">
                <NavLink
                  to="/crm"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconChart />
                  </span>
                  <span>CRM Dashboard</span>
                </NavLink>

                <NavLink
                  to="/contacts"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconUsers />
                  </span>
                  <span>Contacts Directory</span>
                </NavLink>

                <NavLink
                  to="/clients"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconBriefcase />
                  </span>
                  <span>Clients</span>
                </NavLink>

                <NavLink
                  to="/leads"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconTarget />
                  </span>
                  <span>Inquiries & Leads</span>
                </NavLink>

                <NavLink
                  to="/follow-ups"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconPhone />
                  </span>
                  <span>Follow-ups</span>
                </NavLink>

                <NavLink
                  to="/appointments"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconCalendar />
                  </span>
                  <span>Chambers Calendar</span>
                </NavLink>
              </nav>
            )}

            {/* 3. Billing & Accounts */}
            {(hasPermission("INVOICE_VIEW") || hasPermission("FEE_ENTRY_VIEW") || hasPermission("PAYMENT_VIEW") || hasPermission("RETAINER_VIEW") || hasPermission("CLIENT_BILLING_VIEW")) && (
              <>
                <button
                  type="button"
                  className={`sidebar-section-header ${openSection === "billing" ? "is-open" : ""}`}
                  onClick={() => toggleSection("billing")}
                  aria-expanded={openSection === "billing"}
                >
                  <span>Billing & Accounts</span>
                  <span className={`sidebar-section-chevron ${openSection === "billing" ? "open" : ""}`}>
                    <IconChevronDown size={13} />
                  </span>
                </button>
                {openSection === "billing" && (
                  <nav className="sidebar-nav">
                    {hasPermission("INVOICE_VIEW") && (
                      <NavLink
                        to="/billing"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconInvoice />
                        </span>
                        <span>Billing Dashboard</span>
                      </NavLink>
                    )}

                    {hasPermission("INVOICE_VIEW") && (
                      <NavLink
                        to="/invoices"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconInvoice />
                        </span>
                        <span>Invoices & Fee Notes</span>
                      </NavLink>
                    )}

                    {hasPermission("FEE_ENTRY_VIEW") && (
                      <NavLink
                        to="/fee-entries"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconHourglass />
                        </span>
                        <span>Time & Appearances</span>
                      </NavLink>
                    )}

                    {hasPermission("PAYMENT_VIEW") && (
                      <NavLink
                        to="/payments"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconPayment />
                        </span>
                        <span>Receipts & Collections</span>
                      </NavLink>
                    )}

                    {hasPermission("RETAINER_VIEW") && (
                      <NavLink
                        to="/retainers"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconRetainer />
                        </span>
                        <span>Client Retainers</span>
                      </NavLink>
                    )}

                    {user?.role === 'CLIENT' && hasPermission("CLIENT_BILLING_VIEW") && (
                      <NavLink
                        to="/client-billing"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconInvoice />
                        </span>
                        <span>My Invoices & Dues</span>
                      </NavLink>
                    )}
                  </nav>
                )}
              </>
            )}

            {/* 4. Workforce & Chambers */}
            {(hasPermission("WORKFORCE_VIEW") || hasPermission("ATTENDANCE_VIEW") || hasPermission("LEAVE_VIEW") || hasPermission("TASK_VIEW") || hasPermission("PAYROLL_VIEW") || hasPermission("ASSET_VIEW") || user?.roles?.includes('ADMIN') || user?.role === 'ADMIN') && (
              <>
                <button
                  type="button"
                  className={`sidebar-section-header ${openSection === "workforce" ? "is-open" : ""}`}
                  onClick={() => toggleSection("workforce")}
                  aria-expanded={openSection === "workforce"}
                >
                  <span>Workforce & Chambers</span>
                  <span className={`sidebar-section-chevron ${openSection === "workforce" ? "open" : ""}`}>
                    <IconChevronDown size={13} />
                  </span>
                </button>
                {openSection === "workforce" && (
                  <nav className="sidebar-nav">
                    {(hasPermission("WORKFORCE_VIEW") || user?.role === 'ADMIN') && (
                      <NavLink
                        to="/workforce"
                        end
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconDashboard />
                        </span>
                        <span>Workforce Overview</span>
                      </NavLink>
                    )}

                    {(hasPermission("WORKFORCE_VIEW") || user?.role === 'ADMIN') && (
                      <NavLink
                        to="/workforce/directory"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconUsers />
                        </span>
                        <span>Members Directory</span>
                      </NavLink>
                    )}

                    {(hasPermission("WORKFORCE_RECRUITMENT") || user?.role === 'ADMIN') && (
                      <NavLink
                        to="/workforce/candidates"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconUserCheck />
                        </span>
                        <span>Candidate Pipeline</span>
                      </NavLink>
                    )}

                    {(hasPermission("ATTENDANCE_VIEW") || hasPermission("ATTENDANCE_PUNCH") || user?.role === 'ADMIN') && (
                      <NavLink
                        to="/workforce/attendance"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconClock />
                        </span>
                        <span>Daily Attendance</span>
                      </NavLink>
                    )}

                    {(hasPermission("LEAVE_VIEW") || hasPermission("LEAVE_APPLY") || user?.role === 'ADMIN') && (
                      <NavLink
                        to="/workforce/leaves"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconCalendar />
                        </span>
                        <span>Leave Management</span>
                      </NavLink>
                    )}

                    {(hasPermission("TASK_VIEW") || user?.role === 'ADMIN') && (
                      <NavLink
                        to="/workforce/tasks"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconCheckSquare />
                        </span>
                        <span>Chambers Tasks</span>
                      </NavLink>
                    )}

                    {(hasPermission("PAYROLL_VIEW") || user?.role === 'ADMIN') && (
                      <NavLink
                        to="/workforce/payroll"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconDollarSign />
                        </span>
                        <span>Payroll & Stipends</span>
                      </NavLink>
                    )}

                    {(hasPermission("ASSET_VIEW") || user?.role === 'ADMIN') && (
                      <NavLink
                        to="/workforce/assets"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconLaptop />
                        </span>
                        <span>Chambers Assets</span>
                      </NavLink>
                    )}

                    {(hasPermission("WORKFORCE_OFFBOARD") || user?.role === 'ADMIN') && (
                      <NavLink
                        to="/workforce/offboarding"
                        className={({ isActive }) =>
                          isActive ? "sidebar-link active" : "sidebar-link"
                        }
                      >
                        <span className="sidebar-icon">
                          <IconUserMinus />
                        </span>
                        <span>Offboarding & Alumni</span>
                      </NavLink>
                    )}
                  </nav>
                )}
              </>
            )}

            {/* 5. Administration */}
            <button
              type="button"
              className={`sidebar-section-header ${openSection === "admin" ? "is-open" : ""}`}
              onClick={() => toggleSection("admin")}
              aria-expanded={openSection === "admin"}
            >
              <span>Administration</span>
              <span className={`sidebar-section-chevron ${openSection === "admin" ? "open" : ""}`}>
                <IconChevronDown size={13} />
              </span>
            </button>
            {openSection === "admin" && (
              <nav className="sidebar-nav">
                {hasPermission("COURT_VIEW") && (
                  <NavLink
                    to="/courts"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconCourthouse />
                    </span>
                    <span>Courts & Benches</span>
                  </NavLink>
                )}

                {hasPermission("DEADLINE_RULE_MANAGE") && (
                  <NavLink
                    to="/deadline-rules"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconBook />
                    </span>
                    <span>Limitation Rules</span>
                  </NavLink>
                )}

                {hasPermission("USER_VIEW") && (
                  <NavLink
                    to="/users"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconShield />
                    </span>
                    <span>Users & Roles (RBAC)</span>
                  </NavLink>
                )}

                <NavLink
                  to="/settings/vault"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconLock />
                  </span>
                  <span>Document Vault</span>
                </NavLink>

                <NavLink
                  to="/settings/security"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconShield />
                  </span>
                  <span>Security & 2FA</span>
                </NavLink>

                {(hasPermission("EMAIL_VIEW") || user?.roles?.includes("OWNER") || user?.roles?.includes("ADMIN")) && (
                  <NavLink
                    to="/settings/email"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconFileText />
                    </span>
                    <span>Email & SMTP Engine</span>
                  </NavLink>
                )}

                {(hasPermission("EMAIL_TEMPLATE_VIEW") || user?.roles?.includes("OWNER") || user?.roles?.includes("ADMIN")) && (
                  <NavLink
                    to="/settings/email-templates"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconBook />
                    </span>
                    <span>Email Templates</span>
                  </NavLink>
                )}

                {(hasPermission("WHATSAPP_SETTINGS_VIEW") || user?.roles?.includes("OWNER") || user?.roles?.includes("ADMIN")) && (
                  <NavLink
                    to="/settings/whatsapp"
                    className={({ isActive }) =>
                      isActive ? "sidebar-link active" : "sidebar-link"
                    }
                  >
                    <span className="sidebar-icon">
                      <IconPhone />
                    </span>
                    <span>WhatsApp Reminders</span>
                  </NavLink>
                )}

                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    isActive ? "sidebar-link active" : "sidebar-link"
                  }
                >
                  <span className="sidebar-icon">
                    <IconUser />
                  </span>
                  <span>Account Profile</span>
                </NavLink>
              </nav>
            )}
          </div>
        </aside>
      )}

      {/* 2. MAIN CONTENT WRAPPER */}
      <div
        className={`content-wrapper ${isAuthenticated ? "has-sidebar" : ""}`}
      >
        {/* Sticky Top Navbar */}
        <header className="navbar">
          <div className="navbar-left">
            {isAuthenticated && (
              <button
                type="button"
                className="navbar-menu-toggle"
                onClick={() => setSidebarOpen((prev) => !prev)}
                aria-label="Toggle navigation menu"
              >
                <IconMenu size={22} />
              </button>
            )}

            {!isAuthenticated ? (
              <Link to="/" className="navbar-brand">
                <img src="/law logo.png" alt="DG Legal Practice" className="brand-logo-img" />
                <div className="brand-text">
                  <h1>Legal Practice</h1>
                  <p>Chambers Platform</p>
                </div>
              </Link>
            ) : (
              <div className="navbar-chambers-tag">
                <span className="navbar-chambers-dot"></span>
                <span className="navbar-chambers-title">
                  Advocate's Chambers Workspace
                </span>
              </div>
            )}
          </div>

          <div className="navbar-links">
            {isAuthenticated ? (
              <div className="navbar-user-actions">
                {/* Document Vault Status Badge */}
                <div className="navbar-vault-wrapper">
                  <VaultStatusBadge />
                </div>

                <Link
                  to="/profile"
                  className="navbar-profile-link"
                  title="View & Manage Account Profile"
                >
                  <span className="navbar-profile-avatar">
                    {user?.firstName?.[0] || "A"}
                  </span>
                  <div className="navbar-user-info">
                    <div className="navbar-user-name">
                      {user?.firstName} {user?.lastName}
                    </div>
                    <span className="navbar-user-role">
                      {user?.roles?.[0] || "Associate"}
                    </span>
                  </div>
                </Link>

                <button
                  onClick={handleLogout}
                  className="btn btn-secondary navbar-signout-btn"
                >
                  <IconLogout size={14} />
                  <span className="navbar-btn-text">Sign Out</span>
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="btn btn-primary"
                style={{ padding: "0.4rem 1rem", fontSize: "0.85rem" }}
              >
                Sign In
              </NavLink>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="main-content">
          <Outlet />
        </main>

        <footer className="footer">
          <div>
            Legal Practice Management Platform &copy; {new Date().getFullYear()}
          </div>
          <div>
            Powered by{" "}
            <a
              href="https://dgrowmarketing.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-agency-link"
            >
              Dgrow Marketing Agency
            </a>
          </div>
        </footer>

        {/* 3. MOBILE BOTTOM NAVIGATION BAR (< 768px) */}
        {isAuthenticated && (
          <nav className="mobile-bottom-nav">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                isActive ? "bottom-nav-item active" : "bottom-nav-item"
              }
            >
              <IconDashboard size={20} />
              <span>Dashboard</span>
            </NavLink>

            {hasPermission("CASE_VIEW") && (
              <NavLink
                to="/cases"
                className={({ isActive }) =>
                  isActive ? "bottom-nav-item active" : "bottom-nav-item"
                }
              >
                <IconScale size={20} />
                <span>Cases</span>
              </NavLink>
            )}

            {hasPermission("CAUSELIST_VIEW") && (
              <NavLink
                to="/cause-list"
                className={({ isActive }) =>
                  isActive ? "bottom-nav-item active" : "bottom-nav-item"
                }
              >
                <IconList size={20} />
                <span>Cause List</span>
              </NavLink>
            )}

            <NavLink
              to="/appointments"
              className={({ isActive }) =>
                isActive ? "bottom-nav-item active" : "bottom-nav-item"
              }
            >
              <IconCalendar size={20} />
              <span>Calendar</span>
            </NavLink>

            <button
              type="button"
              className={`bottom-nav-item ${sidebarOpen ? "active" : ""}`}
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Open full menu"
            >
              <IconMenu size={20} />
              <span>Menu</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
};

export default MainLayout;
