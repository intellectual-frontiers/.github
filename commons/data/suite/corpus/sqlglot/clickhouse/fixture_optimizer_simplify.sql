SELECT t_bool.a AND (NOT t_bool.a OR t_bool.b) FROM t_bool;

SELECT (t_bool.a AND t_bool.b) OR (t_bool.a AND NOT t_bool.b) FROM t_bool;
