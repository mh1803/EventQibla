import React from "react";
import { Routes, Route } from "react-router-dom";
import EventResults from "../event-results.js";
import EventProfile from "../event-profile.js";
import EventBooking from "../event-booking.js";
import BookingConfirmation from "../booking-confirmation.js";

export const Events: React.FC = () => {
  return (
    <Routes>
      <Route
        path="/:id/booking/confirmation"
        element={<BookingConfirmation />}
      />
      <Route path="/:id/booking" element={<EventBooking />} />
      <Route path="/:id" element={<EventProfile />} />
      <Route path="/" element={<EventResults />} />
    </Routes>
  );
};
