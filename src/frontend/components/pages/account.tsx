import React from "react";
import { Routes, Route } from "react-router-dom";
import MyAccount from "../my-account.js";
import MyNotifications from "../my-notifications.js";

export const Account = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <MyAccount />
            <MyNotifications />
          </>
        }
      />
    </Routes>
  );
};
