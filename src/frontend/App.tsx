import React, { Suspense, lazy } from "react";
import Navbar from "./components/navbar.js";
import { Route, Routes } from "react-router-dom";
import { UserProvider } from "./context/UserContext.js";
import { NotificationProvider } from "./context/NotificationContext.js";
import { useAuth } from "../frontend/hooks/useAuth.js";
import { startTokenWatchdog } from "../frontend/utils/authHelpers.js";
import { ProtectedRoute } from "./components/routing/protected-route.js";
import ErrorBoundary from "./components/error-boundary.js";

type LazyComponent = React.LazyExoticComponent<React.ComponentType<any>>;

const Home = lazy(() =>
  import("./components/pages/home.js").then(
    (module): { default: React.ComponentType } => ({
      default: module.Home,
    })
  )
) as LazyComponent;

const Events = lazy(() =>
  import("./components/pages/events.js").then(
    (module): { default: React.ComponentType } => ({
      default: module.Events,
    })
  )
) as LazyComponent;

const Create = lazy(() =>
  import("./components/pages/create.js").then(
    (module): { default: React.ComponentType } => ({
      default: module.Create,
    })
  )
) as LazyComponent;

const Account = lazy(() =>
  import("./components/pages/account.js").then(
    (module): { default: React.ComponentType } => ({
      default: module.Account,
    })
  )
) as LazyComponent;

const Login = lazy(() =>
  import("./components/pages/login.js").then(
    (module): { default: React.ComponentType } => ({
      default: module.Login,
    })
  )
) as LazyComponent;

const Register = lazy(() =>
  import("./components/pages/register.js").then(
    (module): { default: React.ComponentType } => ({
      default: module.Register,
    })
  )
) as LazyComponent;

const UserDashboard = lazy(() =>
  import("./components/pages/user-dashboard").then(
    (module): { default: React.ComponentType } => ({
      default: module.UserDashboard,
    })
  )
) as LazyComponent;

const AdminDashboard = lazy(() =>
  import("./components/admin-dashboard.js").then(
    (module): { default: React.ComponentType } => ({
      default: module.AdminDashboard,
    })
  )
) as LazyComponent;

const App: React.FC = () => {
  const { isAuthenticated } = useAuth();

  React.useEffect(() => {
    const cleanupWatchdog = startTokenWatchdog();
    return () => cleanupWatchdog();
  }, []);

  return (
    <UserProvider>
      <NotificationProvider>
        <Navbar />
        <ErrorBoundary>
          <Suspense fallback={<div className="loading">Loading page...</div>}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/events/*" element={<Events />} />

              {/* Protected Routes */}
              <Route element={<ProtectedRoute isAllowed={isAuthenticated} />}>
                <Route path="/create" element={<Create />} />
                <Route path="/user-dashboard/*" element={<UserDashboard />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/account/*" element={<Account />} />
              </Route>

              {/* Auth Routes */}
              <Route
                path="/login"
                element={
                  <ProtectedRoute isAllowed={!isAuthenticated} redirectPath="/">
                    <Login />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <ProtectedRoute isAllowed={!isAuthenticated} redirectPath="/">
                    <Register />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </NotificationProvider>
    </UserProvider>
  );
};

export default App;
