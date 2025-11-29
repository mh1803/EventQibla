-- Drop existing tables if they exist
DROP TABLE IF EXISTS event_reports CASCADE;
DROP TABLE IF EXISTS event_categories CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS event_waitlist CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Create enum type for user roles
CREATE TYPE user_role AS ENUM ('user', 'admin', 'banned');

-- Create users table 
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    profile_picture_url TEXT DEFAULT '/images/default_profile.png',
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT DEFAULT '/images/default_cover.png',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    address VARCHAR(255) NOT NULL, 
    city VARCHAR(100) NOT NULL, 
    post_code VARCHAR(20) NOT NULL, 
    latitude DECIMAL(9,6) NOT NULL,  
    longitude DECIMAL(9,6) NOT NULL,  
    price DECIMAL(10,2) CHECK (price >= 0), 
    capacity INT CHECK (capacity > 0),
    organiser_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gender_specific VARCHAR(10) CHECK (gender_specific IN ('all', 'men', 'women')) NOT NULL,
    status VARCHAR(10) CHECK (status IN ('active', 'completed', 'cancelled')) NOT NULL,
    flagged_count INT DEFAULT 0,
    last_flagged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create event_categories table
CREATE TABLE event_categories (
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    PRIMARY KEY (event_id, category)
);

-- Create event_reports table to track user flags
CREATE TABLE event_reports (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, user_id) 
);

-- Create tickets table
CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_code VARCHAR(100) UNIQUE NOT NULL,
    purchase_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) CHECK (status IN ('active', 'cancelled', 'completed')) NOT NULL,
    price DECIMAL(10,2) CHECK (price >= 0),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create reviews table for user ratings
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    reviewer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id INT REFERENCES events(id) ON DELETE SET NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (reviewer_id, reviewed_user_id, event_id) 
);

-- Create notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    related_entity_type VARCHAR(50),  
    related_entity_id INT            
);

-- Create waitlist table
CREATE TABLE event_waitlist (
    id SERIAL PRIMARY KEY,
    event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (event_id, user_id)
);

-- Create indexes
CREATE INDEX idx_events_id ON events(id);
CREATE INDEX idx_event_categories_event_id ON event_categories(event_id);
CREATE INDEX idx_events_status_end_time ON events(status, end_time);
CREATE INDEX idx_tickets_event_id_status ON tickets(event_id, status);
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_event_id ON tickets(event_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_reviews_reviewed_user_id ON reviews(reviewed_user_id);
CREATE INDEX idx_reviews_event_id ON reviews(event_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_waitlist_event ON event_waitlist(event_id);
CREATE INDEX idx_events_organiser_id ON events(organiser_id);
