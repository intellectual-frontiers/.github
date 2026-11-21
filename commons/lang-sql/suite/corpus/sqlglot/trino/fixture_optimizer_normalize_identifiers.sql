WITH Cte AS (SELECT 1) SELECT o.Amount, "Foo" FROM "my-proj".Sales.Orders AS O CROSS JOIN Cte;
