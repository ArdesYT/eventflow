-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Gép: 127.0.0.1
-- Létrehozás ideje: 2026. Máj 26. 10:17
-- Kiszolgáló verziója: 10.4.32-MariaDB
-- PHP verzió: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Adatbázis: `eventflow`
--

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `rooms`
--

CREATE TABLE `rooms` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `capacity` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- A tábla adatainak kiíratása `rooms`
--

INSERT INTO `rooms` (`id`, `name`, `capacity`) VALUES
(1, 'Main Hall', 0),
(2, 'Room A', 0),
(3, 'Room B', 0),
(4, 'Workshop', 0),
(5, 'Outdoor Stage', 0);

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `sessions`
--

CREATE TABLE `sessions` (
  `id` int(11) NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `start_time` datetime NOT NULL,
  `end_time` datetime NOT NULL,
  `room_id` int(11) DEFAULT NULL,
  `speaker_id` int(11) DEFAULT NULL,
  `color` varchar(10) NOT NULL DEFAULT 'blue',
  `status` enum('scheduled','cancelled') NOT NULL DEFAULT 'scheduled'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `user_rooms`
--

CREATE TABLE `user_rooms` (
  `user_id` int(11) NOT NULL,
  `room_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `activity_log`
--

CREATE TABLE `activity_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `action` varchar(64) NOT NULL,
  `entity_type` varchar(64) NOT NULL,
  `entity_id` int(11) DEFAULT NULL,
  `details` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_activity_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- A tábla adatainak kiíratása `sessions`
--

INSERT INTO `sessions` (`id`, `title`, `description`, `start_time`, `end_time`, `room_id`, `speaker_id`, `color`) VALUES
(1, 'Opening Keynote', 'Kickoff of EventFlow 2026.', '2026-03-20 09:00:00', '2026-03-20 10:30:00', 1, 1, 'blue'),
(2, 'AI & Society Panel', '', '2026-03-20 11:00:00', '2026-03-20 12:00:00', 2, 2, 'amber'),
(3, 'Workshop: Design Sys.', 'Hands-on workshop.', '2026-03-21 13:00:00', '2026-03-21 15:00:00', 4, 3, 'green'),
(4, 'Startup Pitches', '', '2026-03-22 14:00:00', '2026-03-22 16:00:00', 1, 5, 'red'),
(5, 'Closing Ceremony', '', '2026-03-25 17:00:00', '2026-03-25 18:00:00', 1, 1, 'blue'),
(6, 'Tech Talk: Web3', '', '2026-03-23 10:00:00', '2026-03-23 11:00:00', 3, 4, 'amber'),
(7, 'EventFlow Expo', 'Többnapos kiállítás és networking.', '2026-03-20 10:00:00', '2026-03-22 18:00:00', 1, 1, 'green');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `speakers`
--

CREATE TABLE `speakers` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `bio` text DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- A tábla adatainak kiíratása `speakers`
--

INSERT INTO `speakers` (`id`, `name`, `bio`, `image_path`) VALUES
(1, 'Dr. Anna Kovács', NULL, NULL),
(2, 'Péter Nagy', NULL, NULL),
(3, 'Eszter Molnár', NULL, NULL),
(4, 'Balázs Kiss', NULL, NULL),
(5, 'Multiple', NULL, NULL),
(6, 'Booker', NULL, NULL),
(7, 'Booker', NULL, NULL),
(8, 'Booker', NULL, NULL),
(9, 'Booker', NULL, NULL);

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','user','booker','attendee') DEFAULT 'attendee',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- A tábla adatainak kiíratása `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password_hash`, `role`, `created_at`) VALUES
(6, 'Admin', 'admin@example.com', '$2b$10$/tW497xbkxGN0zXt9r2CcuMNTQYa6AT9WWsCd1sC2uwnS/yoX2PKy', 'admin', '2026-03-26 08:39:14'),
(8, 'Attendee', 'attendee@example.com', '$2b$10$Pw44lc0cuHhfPLcy/hSA4OFuZ8Uptv8C0jbSUFsPkkm5jYjZWIkui', 'attendee', '2026-03-26 11:05:42'),
(9, 'Booker', 'booker@example.com', '$2b$10$sCFplBpRDnDJs45K5BrfeOuXPUOsX5Dvw8rxX74UzrDTQ1IiS3MZ2', 'booker', '2026-05-26 06:49:20'),
(10, 'Kovács Ádám', 'adam@eventflow.com', '$2b$10$xlUGdR5a1XxfUqKwiyqpC.4IiMn0kBLsGDWQDN7kXNuvlSRXOew3G', 'booker', '2026-05-26 07:31:04');

-- --------------------------------------------------------

--
-- Tábla szerkezet ehhez a táblához `user_schedule`
--

CREATE TABLE `user_schedule` (
  `user_id` int(11) NOT NULL,
  `session_id` int(11) NOT NULL,
  `added_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexek a kiírt táblákhoz
--

--
-- A tábla indexei `rooms`
--
ALTER TABLE `rooms`
  ADD PRIMARY KEY (`id`);

--
-- A tábla indexei `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_session_room` (`room_id`),
  ADD KEY `fk_session_speaker` (`speaker_id`);

--
-- A tábla indexei `speakers`
--
ALTER TABLE `speakers`
  ADD PRIMARY KEY (`id`);

--
-- A tábla indexei `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `email_2` (`email`);

--
-- A tábla indexei `user_schedule`
--
ALTER TABLE `user_schedule`
  ADD PRIMARY KEY (`user_id`,`session_id`),
  ADD KEY `fk_session` (`session_id`);

--
-- A kiírt táblák AUTO_INCREMENT értéke
--

--
-- AUTO_INCREMENT a táblához `rooms`
--
ALTER TABLE `rooms`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT a táblához `sessions`
--
ALTER TABLE `sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT a táblához `speakers`
--
ALTER TABLE `speakers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT a táblához `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- Megkötések a kiírt táblákhoz
--

--
-- Megkötések a táblához `sessions`
--
ALTER TABLE `sessions`
  ADD CONSTRAINT `fk_session_room` FOREIGN KEY (`room_id`) REFERENCES `rooms` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_session_speaker` FOREIGN KEY (`speaker_id`) REFERENCES `speakers` (`id`) ON DELETE SET NULL;

--
-- Megkötések a táblához `user_schedule`
--
ALTER TABLE `user_schedule`
  ADD CONSTRAINT `fk_session` FOREIGN KEY (`session_id`) REFERENCES `sessions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
