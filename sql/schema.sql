-- Movie Ratings DB
-- run this first

CREATE DATABASE IF NOT EXISTS moviedb;
USE moviedb;

-- drop in reverse dependency order if re-running
SET FOREIGN_KEY_CHECKS = 0;
DROP FUNCTION IF EXISTS fn_avg_rating;
DROP PROCEDURE IF EXISTS sp_upsert_rating;
DROP PROCEDURE IF EXISTS sp_movie_breakdown;
DROP VIEW IF EXISTS v_director_stats;
DROP VIEW IF EXISTS v_keyword_stats;
DROP VIEW IF EXISTS v_genre_stats;
DROP VIEW IF EXISTS v_movie_stats;
DROP TABLE IF EXISTS rating_log;
DROP TABLE IF EXISTS ratings;
DROP TABLE IF EXISTS movie_people;
DROP TABLE IF EXISTS movie_keywords;
DROP TABLE IF EXISTS movie_genres;
DROP TABLE IF EXISTS movies;
DROP TABLE IF EXISTS people;
DROP TABLE IF EXISTS keywords;
DROP TABLE IF EXISTS genres;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE movies (
    movie_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    release_year SMALLINT NOT NULL,
    runtime SMALLINT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_runtime CHECK (runtime > 0),
    CONSTRAINT chk_year CHECK (release_year BETWEEN 1888 AND 2100)
);

-- topics/keywords, not a 12-row genre lookup. 100 labels is normal here.
CREATE TABLE keywords (
    keyword_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- M:N movies <-> keywords
CREATE TABLE movie_keywords (
    movie_id INT NOT NULL,
    keyword_id INT NOT NULL,
    PRIMARY KEY (movie_id, keyword_id),
    CONSTRAINT fk_mk_movie FOREIGN KEY (movie_id) REFERENCES movies(movie_id) ON DELETE CASCADE,
    CONSTRAINT fk_mk_keyword FOREIGN KEY (keyword_id) REFERENCES keywords(keyword_id) ON DELETE RESTRICT
);

CREATE TABLE people (
    person_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    date_of_birth DATE,
    biography TEXT
);

-- M:N movies <-> people, role lives on the relationship
CREATE TABLE movie_people (
    movie_id INT NOT NULL,
    person_id INT NOT NULL,
    role VARCHAR(30) NOT NULL,
    character_name VARCHAR(120) NULL,
    credit_order TINYINT NULL,
    PRIMARY KEY (movie_id, person_id, role),
    CONSTRAINT fk_mp_movie FOREIGN KEY (movie_id) REFERENCES movies(movie_id) ON DELETE CASCADE,
    CONSTRAINT fk_mp_person FOREIGN KEY (person_id) REFERENCES people(person_id) ON DELETE RESTRICT,
    CONSTRAINT chk_role CHECK (role IN ('actor','director','writer','producer'))
);

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(120) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ratings (
    rating_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    movie_id INT NOT NULL,
    rating TINYINT NOT NULL,
    rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_rat_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_rat_movie FOREIGN KEY (movie_id) REFERENCES movies(movie_id) ON DELETE CASCADE,
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 10),
    CONSTRAINT uq_user_movie UNIQUE (user_id, movie_id)
);

-- filled by triggers, not by the app
CREATE TABLE rating_log (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    rating_id INT NULL,
    user_id INT NOT NULL,
    movie_id INT NOT NULL,
    old_rating TINYINT NULL,
    new_rating TINYINT NULL,
    action VARCHAR(10) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_movies_year ON movies(release_year);
CREATE INDEX idx_movies_title ON movies(title);
CREATE INDEX idx_mp_person ON movie_people(person_id);
CREATE INDEX idx_mp_role ON movie_people(role);
CREATE INDEX idx_mk_keyword ON movie_keywords(keyword_id);
CREATE INDEX idx_ratings_movie ON ratings(movie_id);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_ratings_rated_at ON ratings(rated_at);
CREATE INDEX idx_log_movie ON rating_log(movie_id);

ALTER TABLE movies ADD FULLTEXT INDEX ft_movies (title, description);

-- views

CREATE OR REPLACE VIEW v_movie_stats AS
SELECT m.movie_id,
       m.title,
       m.release_year,
       m.runtime,
       COUNT(r.rating_id) AS rating_count,
       ROUND(AVG(r.rating), 2) AS avg_rating,
       MIN(r.rating) AS min_rating,
       MAX(r.rating) AS max_rating
FROM movies m
LEFT JOIN ratings r ON r.movie_id = m.movie_id
GROUP BY m.movie_id, m.title, m.release_year, m.runtime;

CREATE OR REPLACE VIEW v_keyword_stats AS
SELECT k.keyword_id,
       k.name AS keyword,
       COUNT(DISTINCT mk.movie_id) AS movie_count,
       ROUND(AVG(r.rating), 2) AS avg_rating,
       COUNT(r.rating_id) AS rating_count
FROM keywords k
JOIN movie_keywords mk ON mk.keyword_id = k.keyword_id
LEFT JOIN ratings r ON r.movie_id = mk.movie_id
GROUP BY k.keyword_id, k.name;

CREATE OR REPLACE VIEW v_director_stats AS
SELECT p.person_id,
       p.name AS director,
       COUNT(DISTINCT mp.movie_id) AS films,
       ROUND(AVG(r.rating), 2) AS avg_rating
FROM people p
JOIN movie_people mp ON mp.person_id = p.person_id AND mp.role = 'director'
LEFT JOIN ratings r ON r.movie_id = mp.movie_id
GROUP BY p.person_id, p.name;

-- triggers (single statements so workbench doesn't need delimiter)

DROP TRIGGER IF EXISTS trg_ratings_ai;
DROP TRIGGER IF EXISTS trg_ratings_au;
DROP TRIGGER IF EXISTS trg_ratings_ad;

CREATE TRIGGER trg_ratings_ai
AFTER INSERT ON ratings
FOR EACH ROW
INSERT INTO rating_log (rating_id, user_id, movie_id, old_rating, new_rating, action)
VALUES (NEW.rating_id, NEW.user_id, NEW.movie_id, NULL, NEW.rating, 'INSERT');

CREATE TRIGGER trg_ratings_au
AFTER UPDATE ON ratings
FOR EACH ROW
INSERT INTO rating_log (rating_id, user_id, movie_id, old_rating, new_rating, action)
VALUES (NEW.rating_id, NEW.user_id, NEW.movie_id, OLD.rating, NEW.rating, 'UPDATE');

CREATE TRIGGER trg_ratings_ad
AFTER DELETE ON ratings
FOR EACH ROW
INSERT INTO rating_log (rating_id, user_id, movie_id, old_rating, new_rating, action)
VALUES (OLD.rating_id, OLD.user_id, OLD.movie_id, OLD.rating, NULL, 'DELETE');
