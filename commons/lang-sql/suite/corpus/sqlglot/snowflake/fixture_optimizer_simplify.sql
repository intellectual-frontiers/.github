SELECT * FROM o ASOF JOIN e MATCH_CONDITION (o.observed_date >= e.metric_date) ON o.id = e.id;
