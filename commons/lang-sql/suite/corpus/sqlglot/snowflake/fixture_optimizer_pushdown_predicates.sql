SELECT a.id, b.val FROM a ASOF JOIN b MATCH_CONDITION (a.ts >= b.ts) ON a.id = b.id WHERE b.val > 10;
