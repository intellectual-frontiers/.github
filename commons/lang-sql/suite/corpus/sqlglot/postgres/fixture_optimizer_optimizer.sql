SELECT u.user_id, l.log_date
FROM   users u
CROSS JOIN LATERAL (
    SELECT l.log_date
    FROM   logs l
    WHERE  l.user_id = u.user_id AND l.log_date <= 100
    ORDER  BY l.log_date DESC NULLS LAST
    LIMIT  1
) l;
