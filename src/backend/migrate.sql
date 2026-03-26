-- Create the database
CREATE DATABASE IF NOT EXISTS eventflow;
USE eventflow;

-- 1. Table: rooms
CREATE TABLE rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    capacity INT
);

-- 2. Table: speakers
CREATE TABLE speakers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    bio TEXT NULL,
    image_path VARCHAR(255)
);

-- 3. Table: users
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('attendee', 'organizer', 'admin') DEFAULT 'attendee',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Table: sessions
CREATE TABLE sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    room_id INT,
    speaker_id INT,
    color VARCHAR(50) DEFAULT 'blue',
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    FOREIGN KEY (speaker_id) REFERENCES speakers(id) ON DELETE SET NULL
);

-- 5. Table: user_schedule (Many-to-Many junction table)
CREATE TABLE user_schedule (
    user_id INT NOT NULL,
    session_id INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Optional: Insert some dummy data for testing
INSERT INTO rooms (name, capacity) VALUES ('Main Hall', 100), ('Room A', 30);
INSERT INTO speakers (name, bio) VALUES ('John Doe', 'Tech Expert'), ('Jane Smith', 'Lead Developer');