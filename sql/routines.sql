USE moviedb;

DROP PROCEDURE IF EXISTS sp_upsert_rating;
DROP PROCEDURE IF EXISTS sp_movie_breakdown;
DROP FUNCTION IF EXISTS fn_avg_rating;

DELIMITER //

-- one rating per user/movie. insert or update inside a transaction
CREATE PROCEDURE sp_upsert_rating(
    IN p_user_id INT,
    IN p_movie_id INT,
    IN p_rating TINYINT
)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_rating < 1 OR p_rating > 10 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rating must be 1-10';
    END IF;

    START TRANSACTION;

    INSERT INTO ratings (user_id, movie_id, rating)
    VALUES (p_user_id, p_movie_id, p_rating)
    ON DUPLICATE KEY UPDATE
        rating = p_rating,
        rated_at = CURRENT_TIMESTAMP;

    COMMIT;
END//

-- dumps the relational side of a movie in one call
CREATE PROCEDURE sp_movie_breakdown(IN p_movie_id INT)
BEGIN
    SELECT m.movie_id, m.title, m.release_year, m.runtime, m.description,
           fn_avg_rating(m.movie_id) AS avg_rating
    FROM movies m
    WHERE m.movie_id = p_movie_id;

    SELECT k.keyword_id, k.name
    FROM keywords k
    JOIN movie_keywords mk ON mk.keyword_id = k.keyword_id
    WHERE mk.movie_id = p_movie_id
    ORDER BY k.name;

    SELECT p.person_id, p.name, mp.role, mp.character_name, mp.credit_order
    FROM movie_people mp
    JOIN people p ON p.person_id = mp.person_id
    WHERE mp.movie_id = p_movie_id
    ORDER BY mp.credit_order IS NULL, mp.credit_order, mp.role, p.name;

    SELECT u.username, r.rating, r.rated_at
    FROM ratings r
    JOIN users u ON u.user_id = r.user_id
    WHERE r.movie_id = p_movie_id
    ORDER BY r.rated_at DESC;
END//

CREATE FUNCTION fn_avg_rating(p_movie_id INT)
RETURNS DECIMAL(4,2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v DECIMAL(4,2);
    SELECT ROUND(AVG(rating), 2) INTO v
    FROM ratings
    WHERE movie_id = p_movie_id;
    RETURN v;
END//

DELIMITER ;
