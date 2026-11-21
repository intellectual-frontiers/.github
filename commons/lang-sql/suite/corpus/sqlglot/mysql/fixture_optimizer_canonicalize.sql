SELECT `t`.`d` < '2023-01-01 00:00:01' AS `col` FROM `temporal` AS `t`;

SELECT CAST(`t`.`some_col` AS DATE) < CAST(`t`.`other_col` AS CHAR) AS `col` FROM `other_table` AS `t`;
