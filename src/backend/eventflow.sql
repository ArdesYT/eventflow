-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Gép: 127.0.0.1
-- Létrehozás ideje: 2026. Már 31. 08:31
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
  `color` varchar(10) NOT NULL DEFAULT 'blue'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- A tábla adatainak kiíratása `sessions`
--

INSERT INTO `sessions` (`id`, `title`, `description`, `start_time`, `end_time`, `room_id`, `speaker_id`, `color`) VALUES
(4, 'as', '', '2026-03-05 09:00:00', '2026-03-05 10:00:00', 1, 1, 'blue'),
(5, 'asd', '', '2026-03-07 09:00:00', '2026-03-07 10:00:00', 1, 1, 'blue'),
(6, 'asd', '', '2026-03-14 09:00:00', '2026-03-14 10:00:00', 1, 2, 'green'),
(8, 'asdasdasd', 'asdasdasd', '2026-03-04 09:00:00', '2026-03-04 12:23:00', 4, 3, 'red'),
(9, 'wasdasd', '', '2026-03-04 09:00:00', '2026-03-04 12:32:00', 1, 1, 'blue'),
(10, 'adasdasd', 'Kecske', '2026-03-06 09:00:00', '2026-03-06 10:00:00', 4, 3, 'green'),
(11, 'asd', '', '2026-03-19 09:00:00', '2026-03-19 10:00:00', 1, 1, 'blue'),
(12, 'asd', '', '2026-03-19 09:00:00', '2026-03-19 10:00:00', 1, 1, 'blue'),
(13, 'asd', '', '2026-03-12 09:00:00', '2026-03-12 10:00:00', 1, 1, 'blue'),
(14, 'asd', '', '0000-00-00 00:00:00', '0000-00-00 00:00:00', 1, 1, 'blue'),
(15, 'asd', '', '0000-00-00 00:00:00', '0000-00-00 00:00:00', 1, 1, 'blue'),
(16, 'asd', '', '0000-00-00 00:00:00', '0000-00-00 00:00:00', 1, 1, 'blue'),
(17, 'asd', '', '0000-00-00 00:00:00', '0000-00-00 00:00:00', 1, 1, 'blue'),
(18, 'asd', '', '0000-00-00 00:00:00', '0000-00-00 00:00:00', 1, 1, 'blue'),
(19, 'asd', '', '0000-00-00 00:00:00', '0000-00-00 00:00:00', 3, 1, 'blue'),
(20, 'asd', '', '0000-00-00 00:00:00', '0000-00-00 00:00:00', 1, 1, 'blue'),
(21, 'asd', '', '0000-00-00 00:00:00', '0000-00-00 00:00:00', 1, 1, 'blue');

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
(5, 'Multiple', NULL, NULL);

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
(6, 'admin', 'admin@example.com', '$2b$10$nkL0chNWlYSVZLAgSSf3Y.TCXYNP1a20fNYcNiTM2IIazWCEARo26', 'booker', '2026-03-26 08:39:14'),
(7, 'adam', 'adam@example.com', '$2b$10$CVmX6UKYN43hBDcXEIipgebtd3i89X8YuSZjqIbTXSyflLzvDl5Eq', 'booker', '2026-03-26 08:58:13'),
(8, 'attendee', 'attendee@example.com', '$2b$10$fi/bovd9.IPxu/mxCaRadOszltZwLvuLpjP7YK3BdtRBJJ8F.XkYi', 'attendee', '2026-03-26 11:05:42');

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT a táblához `speakers`
--
ALTER TABLE `speakers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT a táblához `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

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
