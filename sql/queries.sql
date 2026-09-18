USE moviedb;

-- 1. movies with enough ratings to not be a fluke
SELECT m.title, m.release_year,
       COUNT(*) AS n,
       ROUND(AVG(r.rating), 2) AS avg_rating
FROM movies m
JOIN ratings r ON r.movie_id = m.movie_id
GROUP BY m.movie_id, m.title, m.release_year
HAVING COUNT(*) >= 4
ORDER BY avg_rating DESC, n DESC;

-- 2. keyword averages (a movie with 2 keywords counts in both)
SELECT k.name, COUNT(DISTINCT mk.movie_id) AS movies,
       COUNT(r.rating_id) AS ratings,
       ROUND(AVG(r.rating), 2) AS avg_rating
FROM keywords k
JOIN movie_keywords mk ON mk.keyword_id = k.keyword_id
JOIN ratings r ON r.movie_id = mk.movie_id
GROUP BY k.keyword_id, k.name
ORDER BY avg_rating DESC;

-- 3. people who directed AND acted (in any film, not necessarily the same one)
SELECT p.name
FROM people p
WHERE p.person_id IN (SELECT person_id FROM movie_people WHERE role = 'director')
  AND p.person_id IN (SELECT person_id FROM movie_people WHERE role = 'actor');

-- 4. same person, multiple jobs on the same movie
SELECT p.name, m.title, GROUP_CONCAT(mp.role ORDER BY mp.role) AS jobs
FROM movie_people mp
JOIN people p ON p.person_id = mp.person_id
JOIN movies m ON m.movie_id = mp.movie_id
GROUP BY p.person_id, p.name, m.movie_id, m.title
HAVING COUNT(*) > 1
ORDER BY p.name;

-- 5. best movie of each year (window)
SELECT title, release_year, avg_rating
FROM (
    SELECT m.title, m.release_year,
           ROUND(AVG(r.rating), 2) AS avg_rating,
           RANK() OVER (PARTITION BY m.release_year ORDER BY AVG(r.rating) DESC) AS rk
    FROM movies m
    JOIN ratings r ON r.movie_id = m.movie_id
    GROUP BY m.movie_id, m.title, m.release_year
) t
WHERE rk = 1
ORDER BY release_year;

-- 6. users who tend to agree (rated at least 3 of the same movies)
SELECT u1.username AS u_a, u2.username AS u_b,
       COUNT(*) AS overlap,
       ROUND(AVG(ABS(r1.rating - r2.rating)), 2) AS avg_diff
FROM ratings r1
JOIN ratings r2 ON r1.movie_id = r2.movie_id AND r1.user_id < r2.user_id
JOIN users u1 ON u1.user_id = r1.user_id
JOIN users u2 ON u2.user_id = r2.user_id
GROUP BY r1.user_id, r2.user_id, u1.username, u2.username
HAVING COUNT(*) >= 3
ORDER BY avg_diff, overlap DESC;

-- 7. keyword pairs that show up together
SELECT k1.name AS keyword_a, k2.name AS keyword_b, COUNT(*) AS together
FROM movie_keywords a
JOIN movie_keywords b ON a.movie_id = b.movie_id AND a.keyword_id < b.keyword_id
JOIN keywords k1 ON k1.keyword_id = a.keyword_id
JOIN keywords k2 ON k2.keyword_id = b.keyword_id
GROUP BY k1.name, k2.name
ORDER BY together DESC, keyword_a, keyword_b;

-- 8. movies nobody rated
SELECT m.title, m.release_year
FROM movies m
WHERE NOT EXISTS (
    SELECT 1 FROM ratings r WHERE r.movie_id = m.movie_id
);

-- 9. rating histogram
SELECT rating, COUNT(*) AS n
FROM ratings
GROUP BY rating
ORDER BY rating;

-- 10. directors ordered by how their films scored
SELECT * FROM v_director_stats
WHERE films >= 1
ORDER BY avg_rating DESC, films DESC;

-- 11. who worked with Bong Joon-ho
SELECT DISTINCT p2.name, mp2.role, m.title
FROM movie_people mp1
JOIN movie_people mp2 ON mp1.movie_id = mp2.movie_id AND mp1.person_id <> mp2.person_id
JOIN people p1 ON p1.person_id = mp1.person_id
JOIN people p2 ON p2.person_id = mp2.person_id
JOIN movies m ON m.movie_id = mp1.movie_id
WHERE p1.name = 'Bong Joon-ho'
ORDER BY m.title, mp2.role, p2.name;

-- 12. users whose average is 9+ (easy graders)
SELECT u.username, COUNT(*) AS n, ROUND(AVG(r.rating), 2) AS avg_rating
FROM users u
JOIN ratings r ON r.user_id = u.user_id
GROUP BY u.user_id, u.username
HAVING AVG(r.rating) >= 9
ORDER BY avg_rating DESC;

-- 13. fulltext
SELECT movie_id, title
FROM movies
WHERE MATCH(title, description) AGAINST ('family dream' IN NATURAL LANGUAGE MODE);

-- 14. plan for the keyword average query
EXPLAIN ANALYZE
SELECT k.name, ROUND(AVG(r.rating), 2) AS avg_rating
FROM keywords k
JOIN movie_keywords mk ON mk.keyword_id = k.keyword_id
JOIN ratings r ON r.movie_id = mk.movie_id
GROUP BY k.keyword_id, k.name;

-- 15. audit trail (trigger output)
SELECT m.title, u.username, l.action, l.old_rating, l.new_rating, l.changed_at
FROM rating_log l
JOIN movies m ON m.movie_id = l.movie_id
JOIN users u ON u.user_id = l.user_id
ORDER BY l.changed_at DESC
LIMIT 20;

-- 16. CTE: movies above the overall mean
WITH overall AS (
    SELECT AVG(rating) AS mean_r FROM ratings
)
SELECT m.title, ROUND(AVG(r.rating), 2) AS avg_rating
FROM movies m
JOIN ratings r ON r.movie_id = m.movie_id
CROSS JOIN overall
GROUP BY m.movie_id, m.title, overall.mean_r
HAVING AVG(r.rating) > overall.mean_r
ORDER BY avg_rating DESC;

-- movies scoring above the average for a keyword they belong to
SELECT m.title, k.name AS keyword,
       ROUND(AVG(r.rating), 2) AS movie_avg,
       ks.avg_rating AS keyword_avg
FROM movies m
JOIN movie_keywords mk ON mk.movie_id = m.movie_id
JOIN keywords k ON k.keyword_id = mk.keyword_id
JOIN ratings r ON r.movie_id = m.movie_id
JOIN v_keyword_stats ks ON ks.keyword_id = k.keyword_id
GROUP BY m.movie_id, m.title, k.keyword_id, k.name, ks.avg_rating
HAVING AVG(r.rating) > ks.avg_rating
ORDER BY k.name, movie_avg DESC;
