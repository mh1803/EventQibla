import React, { useState, useEffect } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import { useAuth } from "../../frontend/hooks/useAuth";
import { useUser } from "../context/UserContext";
import "../../../public/css/navbar.css";

const DEFAULT_PROFILE_PIC = "/images/default_profile.png";

const ProfileWithBadge = React.memo(
  ({ src, count }: { src: string; count: number }) => (
    <div className="profile-badge-container">
      <img
        src={src}
        alt="Profile"
        className="profile-pic"
        onError={(e) => {
          (e.target as HTMLImageElement).src = DEFAULT_PROFILE_PIC;
        }}
      />
      {count > 0 && <span className="notification-badge">{count}</span>}
    </div>
  )
);

const Navbar = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { profilePicture } = useUser();
  const { notificationsCount } = useNotifications();
  const { isAuthenticated, isLoading, isBanned, logout, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleCreateClick = (e: React.MouseEvent) => {
    if (!isAuthenticated) {
      e.preventDefault();
      navigate("/login", { state: { from: location.pathname } });
    }
  };

  const handleLogout = () => {
    logout("/login?from=" + encodeURIComponent(location.pathname));
  };

  if (isLoading) return <div className="navbar-loading">Loading...</div>;
  if (isBanned) return <div className="navbar-banned">Account Banned</div>;

  return (
    <nav>
      <Link to="/" className="title">
        Event Qibla
        <img src="/images/logo.png" alt="Logo" className="logo" />
      </Link>

      <div className="menu-container">
        <div className="mobile-profile-container">
          <NavLink to={isAuthenticated ? "/account" : "/login"}>
            <ProfileWithBadge src={profilePicture} count={notificationsCount} />
          </NavLink>
        </div>
        <div
          className={`menu ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <ul className={menuOpen ? "open" : ""}>
        <li>
          <NavLink to="/">Home</NavLink>
        </li>
        <li>
          <NavLink to="/events">Browse</NavLink>
        </li>
        <li>
          <NavLink to="/create" onClick={handleCreateClick}>
            Create
          </NavLink>
        </li>

        {isAuthenticated && userData?.role === "admin" && (
          <li>
            <NavLink to="/admin/dashboard">Admin</NavLink>
          </li>
        )}

        {isAuthenticated ? (
          <>
            <li>
              <NavLink to="/user-dashboard">Events & Tickets</NavLink>
            </li>
            <li className="account-profile-container">
              <NavLink to="/account" className="account-link">
                Account
              </NavLink>
              <NavLink to="/account" className="profile-link">
                <ProfileWithBadge
                  src={profilePicture}
                  count={notificationsCount}
                />
              </NavLink>
            </li>
            <li>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </li>
          </>
        ) : (
          <>
            <li>
              <NavLink to="/login">Login</NavLink>
            </li>
            <li>
              <NavLink to="/register">Register</NavLink>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
