SELECT x.a, u.val FROM x AS x CROSS JOIN UNNEST(ARRAY[0, 1]) AS u("val") WHERE x.a > u.val;

SELECT x.a, u.val FROM UNNEST(ARRAY[0, 1]) AS u("val") CROSS JOIN x AS x WHERE x.a > u.val;
