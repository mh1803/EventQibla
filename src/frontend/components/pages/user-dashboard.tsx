import React from "react";
import { Routes, Route } from "react-router-dom";
import MyTickets from "../my-tickets.js";
import TicketPage from "../ticket-page.js";
import MyEvents from "../my-events.js";
import AttendeesPage from "../attendees-page.js";
import EditEventForm from "../edit-event-form.js";

export const UserDashboard = () => {
  return (
    <Routes>
      <Route path="/ticket/:ticketCode" element={<TicketPage />} />
      <Route path="/my-events/:id/attendees" element={<AttendeesPage />} />
      <Route path="/my-events/:id/edit" element={<EditEventForm />} />
      <Route
        path="/"
        element={
          <>
            <MyTickets />
            <MyEvents />
          </>
        }
      />
    </Routes>
  );
};
