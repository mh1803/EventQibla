import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "../../../frontend/hooks/useAuth.js";

interface ProtectedRouteProps {
  isAllowed?: boolean | null;
  redirectPath?: string;
  children?: ReactNode;
  allowDuringAuthCheck?: boolean;
  requiredRole?: string;
  currentRole?: string;
}

// Wrapper component: protects routes based on authentication and optional role requirements
export const ProtectedRoute = ({
  isAllowed = null,
  redirectPath = "/login",
  children,
  allowDuringAuthCheck = false,
  requiredRole,
  currentRole,
}: ProtectedRouteProps) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  const resolvedAllowed = isAllowed !== null ? isAllowed : isAuthenticated;
  const hasRequiredRole = !requiredRole || requiredRole === currentRole;

  if (isLoading && allowDuringAuthCheck) {
    return children ? <>{children}</> : <Outlet />;
  }

  if (!resolvedAllowed || !hasRequiredRole) {
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
};
