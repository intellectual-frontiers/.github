SELECT COALESCE(json_val.a /* sqlglot.meta case_sensitive */, json_val.A /* sqlglot.meta case_sensitive */) FROM tbl;

SELECT "FoÄ" FROM "BaÜ";
