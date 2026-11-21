CREATE TABLE tab0(pk INTEGER PRIMARY KEY, col0 INTEGER, col1 FLOAT, col2 TEXT, col3 INTEGER, col4 FLOAT, col5 TEXT);

SELECT pk, col0 FROM view_2_tab4_153;

SELECT pk, col0 FROM tab0 WHERE ((col4 >= 74.79) OR col3 > 93 AND col0 < 27 OR (col0 >= 22)) UNION ALL SELECT pk, col0 FROM tab0 WHERE NOT (((col4 >= 74.79) OR col3 > 93 AND col0 < 27 OR (col0 >= 22)));

SELECT pk, col0 FROM view_1_tab1_156 UNION ALL SELECT pk, col0 FROM view_2_tab1_156;

SELECT pk, col0 FROM tab2 WHERE (col0 IN (SELECT col3 FROM tab2 WHERE ((col0 IS NULL) OR col3 > 5 OR col3 <= 50 OR col1 < 83.11))) OR col0 > 75 UNION SELECT pk, col0 FROM tab2 WHERE NOT ((col0 IN (SELECT col3 FROM tab2 WHERE ((col0 IS NULL) OR col3 > 5 OR col3 <= 50 OR col1 < 83.11))) OR col0 > 75);

SELECT pk, col0 FROM view_1_tab3_158 UNION SELECT pk, col0 FROM view_2_tab3_158;

SELECT pk FROM ( SELECT pk, col0 FROM tab4 WHERE (col3 < 75) AND ((col0 >= 55 AND ((col3 < 14)))) ) AS tab4_159;

SELECT * FROM view_3_tab0_162;

SELECT pk FROM tab1 WHERE col3 > 63 AND col0 <= 85;

DROP VIEW view_1_tab2_164;

DROP VIEW view_2_tab3_165;

DROP VIEW view_3_tab4_166;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab1_168') DROP VIEW view_1_tab1_168;

DROP VIEW IF EXISTS view_1_tab2_169;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab3_170') DROP VIEW view_2_tab3_170;

DROP VIEW IF EXISTS view_2_tab4_171;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab0_173') DROP VIEW view_3_tab0_173;

DROP VIEW IF EXISTS view_3_tab1_174;

CREATE VIEW view_1_tab2_175 AS SELECT pk, col0 FROM tab2 WHERE col0 IS NULL OR col3 = 32 OR (col0 > 89);

CREATE VIEW view_2_tab3_176 AS SELECT pk, col0 FROM tab3 WHERE NOT (col0 > 89);

CREATE VIEW view_3_tab4_177 AS SELECT pk FROM view_1_tab4_177;

SELECT pk, col0 FROM tab0 WHERE (col0 >= 82);

SELECT pk, col0 FROM tab1 WHERE NOT (col3 > 8);

SELECT pk, col0 FROM view_1_tab2_181;

SELECT pk, col0 FROM view_2_tab3_182;

SELECT pk, col0 FROM tab4 WHERE ((col1 < 73.59 AND (col4 > 98.28 OR (col0 >= 41 AND col1 IS NULL AND col0 < 97 AND (col0 < 62)) OR (((((col1 > 80.99) AND (col4 = 53.19)) AND col0 > 35 AND (col0 <= 41 OR col0 BETWEEN 6 AND 91 AND col1 >= 33.73 OR col3 > 79 AND (col4 > 47.38) AND (col0 > 75 AND col4 = 89.83) AND ((col3 <= 53)) AND col3 < 20) AND ((col3 >= 9)) OR col3 < 54 OR col3 > 39 OR ((col0 < 25 OR col0 IS NULL AND col1 IN (21.49,0.7) AND (col3 <= 86) OR (col1 IS NULL) OR col4 IS NULL) AND col1 >= 12.50) AND (col3 > 6)))) AND (col0 < 29) OR (col3 > 54))) OR (col1 > 3.50)) UNION ALL SELECT pk, col0 FROM tab4 WHERE NOT (((col1 < 73.59 AND (col4 > 98.28 OR (col0 >= 41 AND col1 IS NULL AND col0 < 97 AND (col0 < 62)) OR (((((col1 > 80.99) AND (col4 = 53.19)) AND col0 > 35 AND (col0 <= 41 OR col0 BETWEEN 6 AND 91 AND col1 >= 33.73 OR col3 > 79 AND (col4 > 47.38) AND (col0 > 75 AND col4 = 89.83) AND ((col3 <= 53)) AND col3 < 20) AND ((col3 >= 9)) OR col3 < 54 OR col3 > 39 OR ((col0 < 25 OR col0 IS NULL AND col1 IN (21.49,0.7) AND (col3 <= 86) OR (col1 IS NULL) OR col4 IS NULL) AND col1 >= 12.50) AND (col3 > 6)))) AND (col0 < 29) OR (col3 > 54))) OR (col1 > 3.50)));

SELECT pk, col0 FROM view_1_tab0_185 UNION ALL SELECT pk, col0 FROM view_2_tab0_185;

SELECT pk, col0 FROM tab1 WHERE ((col4 >= 29.76)) UNION SELECT pk, col0 FROM tab1 WHERE NOT (((col4 >= 29.76)));

SELECT pk, col0 FROM view_1_tab2_187 UNION SELECT pk, col0 FROM view_2_tab2_187;

SELECT pk FROM ( SELECT pk, col0 FROM tab3 WHERE col4 = 69.29 ) AS tab3_188;

SELECT * FROM view_3_tab4_189;

SELECT pk FROM tab0 WHERE col0 < 85;

DROP VIEW view_1_tab1_192;

DROP VIEW view_2_tab2_193;

DROP VIEW view_3_tab3_194;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab0_196') DROP VIEW view_1_tab0_196;

DROP VIEW IF EXISTS view_1_tab1_197;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab2_198') DROP VIEW view_2_tab2_198;

DROP VIEW IF EXISTS view_2_tab3_199;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab4_200') DROP VIEW view_3_tab4_200;

DROP VIEW IF EXISTS view_3_tab0_202;

CREATE VIEW view_1_tab1_203 AS SELECT pk, col0 FROM tab1 WHERE ((col3 IN (68,13,21,16,87) OR (col1 = 12.25) AND col1 < 59.31 OR ((col0 <= 69) OR col4 >= 51.39 AND col0 < 87)) OR (col0 > 84 AND (col1 < 17.99)) OR (col4 > 60.65 AND col3 > 18 OR col1 BETWEEN 7.6 AND 32.59 AND (col0 IS NULL) OR (col3 IS NULL)));

CREATE VIEW view_2_tab2_205 AS SELECT pk, col0 FROM tab2 WHERE NOT ((((col3 < 34 AND (col3 > 22))) AND ((col0 > 52 AND col3 > 69 AND col3 IS NULL AND ((col3 > 60) AND col0 < 11) AND (col3 = 8))) OR col1 = 45.79 AND col0 IS NULL AND (col0 = 41)));

CREATE VIEW view_3_tab3_206 AS SELECT pk FROM view_1_tab3_206;

SELECT pk, col0 FROM tab4 WHERE col0 <= 29 AND ((col3 < 44)) AND (col0 >= 26);

SELECT pk, col0 FROM tab0 WHERE NOT (col4 > 11.79);

SELECT pk, col0 FROM view_1_tab1_210;

SELECT pk, col0 FROM view_2_tab2_211;

SELECT pk, col0 FROM tab3 WHERE (col3 > 9) UNION ALL SELECT pk, col0 FROM tab3 WHERE NOT ((col3 > 9));

SELECT pk, col0 FROM view_1_tab4_213 UNION ALL SELECT pk, col0 FROM view_2_tab4_213;

SELECT pk, col0 FROM tab0 WHERE col0 = 15 UNION SELECT pk, col0 FROM tab0 WHERE NOT (col0 = 15);

SELECT pk, col0 FROM view_1_tab1_216 UNION SELECT pk, col0 FROM view_2_tab1_216;

SELECT pk FROM ( SELECT pk, col0 FROM tab2 WHERE col3 < 53 OR (col3 < 53 AND col4 > 90.43 AND col4 <= 46.27 OR col0 BETWEEN 71 AND 1 AND col1 > 20.97 OR (col4 > 63.25) AND col0 >= 45 AND col3 IN (37) OR col0 > 88 OR col4 > 29.65 OR col3 >= 49 AND (col0 < 37 AND col4 > 4.54) AND col0 > 6 AND col4 BETWEEN 82.58 AND 45.84 AND col1 <= 4.61 OR (col3 IS NULL)) ) AS tab2_217;

SELECT * FROM view_3_tab3_218;

SELECT pk FROM tab4 WHERE col0 > 34;

DROP VIEW view_1_tab0_221;

DROP VIEW view_2_tab1_222;

DROP VIEW view_3_tab2_223;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab4_224') DROP VIEW view_1_tab4_224;

INSERT INTO tab0 VALUES(1,6,79.28,'zeqcc',82,39.99,'fdcys');

CREATE VIEW view_2_tab0_303 AS SELECT pk, col0 FROM tab0 WHERE NOT (col4 < 22.92 AND (col3 = 16));

CREATE VIEW view_3_tab1_304 AS SELECT pk FROM view_1_tab1_304;

SELECT pk, col0 FROM tab2 WHERE col0 < 41 OR (col1 < 93.66) AND col3 >= 21 AND col1 = 30.28 OR ((col4 <= 61.6));

SELECT pk, col0 FROM tab3 WHERE NOT (col4 >= 36.7 AND col3 >= 6);

SELECT pk, col0 FROM view_1_tab4_307;

SELECT pk, col0 FROM view_2_tab0_309;

SELECT pk, col0 FROM tab1 WHERE col3 = 5 OR ((col0 <= 93 AND ((col4 = 42.93))) AND col0 <= 62) OR ((col0 < 78)) UNION ALL SELECT pk, col0 FROM tab1 WHERE NOT (col3 = 5 OR ((col0 <= 93 AND ((col4 = 42.93))) AND col0 <= 62) OR ((col0 < 78)));

SELECT pk, col0 FROM view_1_tab2_311 UNION ALL SELECT pk, col0 FROM view_2_tab2_311;

SELECT pk, col0 FROM tab3 WHERE (col3 <= 3) AND col3 > 38 OR col1 BETWEEN 15.33 AND 89.29 UNION SELECT pk, col0 FROM tab3 WHERE NOT ((col3 <= 3) AND col3 > 38 OR col1 BETWEEN 15.33 AND 89.29);

SELECT pk, col0 FROM view_1_tab4_313 UNION SELECT pk, col0 FROM view_2_tab4_313;

SELECT pk FROM ( SELECT pk, col0 FROM tab0 WHERE (col0 = 85) ) AS tab0_315;

SELECT * FROM view_3_tab1_316;

SELECT pk FROM tab2 WHERE col0 < 89 OR col1 < 1.95 AND col4 >= 75.40 OR col0 >= 69;

DROP VIEW view_1_tab3_319;

DROP VIEW view_2_tab4_320;

DROP VIEW view_3_tab0_322;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab2_323') DROP VIEW view_1_tab2_323;

DROP VIEW IF EXISTS view_1_tab3_324;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab4_325') DROP VIEW view_2_tab4_325;

DROP VIEW IF EXISTS view_2_tab0_327;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab1_328') DROP VIEW view_3_tab1_328;

DROP VIEW IF EXISTS view_3_tab2_329;

CREATE VIEW view_1_tab3_330 AS SELECT pk, col0 FROM tab3 WHERE col0 = 51;

CREATE VIEW view_2_tab4_331 AS SELECT pk, col0 FROM tab4 WHERE NOT (col1 > 56.82);

CREATE VIEW view_3_tab0_333 AS SELECT pk FROM view_1_tab0_333;

SELECT pk, col0 FROM tab1 WHERE col4 < 62.6;

SELECT pk, col0 FROM tab2 WHERE NOT (col3 > 40);

SELECT pk, col0 FROM view_1_tab3_336;

SELECT pk, col0 FROM view_2_tab4_337;

SELECT pk, col0 FROM tab0 WHERE col4 > 67.67 AND col3 IN (52,47,10,34,16,83) UNION ALL SELECT pk, col0 FROM tab0 WHERE NOT (col4 > 67.67 AND col3 IN (52,47,10,34,16,83));

SELECT pk, col0 FROM view_1_tab1_340 UNION ALL SELECT pk, col0 FROM view_2_tab1_340;

SELECT pk, col0 FROM tab2 WHERE (col0 IN (99,27,88,27,16,64)) AND col4 > 10.42 OR col4 > 72.68 UNION SELECT pk, col0 FROM tab2 WHERE NOT ((col0 IN (99,27,88,27,16,64)) AND col4 > 10.42 OR col4 > 72.68);

SELECT pk, col0 FROM view_1_tab3_342 UNION SELECT pk, col0 FROM view_2_tab3_342;

SELECT pk FROM ( SELECT pk, col0 FROM tab4 WHERE col0 < 38 ) AS tab4_343;

SELECT * FROM view_3_tab0_345;

SELECT pk FROM tab1 WHERE col1 IS NULL OR col4 < 0.19 OR col0 IS NULL OR (col0 > 0 OR (col3 > 5 AND col3 >= 45 AND (col3 = 12) OR (col1 < 24.59 OR ((col3 < 58))) OR (col0 <= 61 AND col0 > 90 OR col0 >= 10 AND col3 IS NULL) AND ((col3 < 65) OR col0 = 77 AND (col1 > 79.51 AND col0 IS NULL OR (col3 < 68) AND col1 IN (53.72,23.28,18.20,47.87) AND col1 >= 40.51 OR col4 >= 63.27 AND (col3 >= 54) OR (col0 > 4) AND col3 BETWEEN 74 AND 96 OR col0 > 85 AND col0 = 96 OR (col0 >= 18 AND col3 > 19 OR col0 <= 30 OR col0 >= 88) OR col0 < 12 AND col0 = 26 OR (((col3 > 29))) AND col0 BETWEEN 46 AND 85 AND col3 > 92 AND col1 < 72.30 AND col1 > 19.47))) AND ((col0 > 6)) OR (col4 > 75.55));

DROP VIEW view_1_tab2_347;

DROP VIEW view_2_tab3_348;

DROP VIEW view_3_tab4_349;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab1_351') DROP VIEW view_1_tab1_351;

DROP VIEW IF EXISTS view_1_tab2_352;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab3_353') DROP VIEW view_2_tab3_353;

DROP VIEW IF EXISTS view_2_tab4_354;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab0_356') DROP VIEW view_3_tab0_356;

DROP VIEW IF EXISTS view_3_tab1_357;

CREATE VIEW view_1_tab2_358 AS SELECT pk, col0 FROM tab2 WHERE col3 < 64;

CREATE VIEW view_2_tab3_359 AS SELECT pk, col0 FROM tab3 WHERE NOT (col3 = 29);

CREATE VIEW view_3_tab4_360 AS SELECT pk FROM view_1_tab4_360;

SELECT pk, col0 FROM tab0 WHERE col0 < 84;

SELECT pk, col0 FROM tab1 WHERE NOT ((col1 >= 43.31) OR (((col3 < 28 OR col0 <= 11) AND col0 < 52 OR ((col0 < 62)))));

SELECT pk, col0 FROM view_1_tab2_364;

SELECT pk, col0 FROM view_2_tab3_365;

SELECT pk, col0 FROM tab4 WHERE (col4 = 69.90) UNION ALL SELECT pk, col0 FROM tab4 WHERE NOT ((col4 = 69.90));

SELECT pk, col0 FROM view_1_tab0_368 UNION ALL SELECT pk, col0 FROM view_2_tab0_368;

SELECT pk, col0 FROM tab1 WHERE ((col4 < 72.64) AND col1 < 16.25 OR col3 < 19 AND (col3 IN (24)) AND col3 < 60 OR ((col1 BETWEEN 40.43 AND 51.72) AND ((col4 >= 59.48)) AND ((col0 >= 48))) OR (col0 > 72 OR col4 <= 83.87 OR (((((col0 > 94)))) OR col3 IS NULL) AND col1 > 25.18 OR col3 < 33) AND (((col1 = 54.49) OR col3 < 37)) OR col0 <= 80 AND col3 <= 68 AND ((col0 = 1 OR col3 > 67))) UNION SELECT pk, col0 FROM tab1 WHERE NOT (((col4 < 72.64) AND col1 < 16.25 OR col3 < 19 AND (col3 IN (24)) AND col3 < 60 OR ((col1 BETWEEN 40.43 AND 51.72) AND ((col4 >= 59.48)) AND ((col0 >= 48))) OR (col0 > 72 OR col4 <= 83.87 OR (((((col0 > 94)))) OR col3 IS NULL) AND col1 > 25.18 OR col3 < 33) AND (((col1 = 54.49) OR col3 < 37)) OR col0 <= 80 AND col3 <= 68 AND ((col0 = 1 OR col3 > 67))));

SELECT pk, col0 FROM view_1_tab2_370 UNION SELECT pk, col0 FROM view_2_tab2_370;

SELECT pk FROM ( SELECT pk, col0 FROM tab3 WHERE (col0 > 78) OR col4 <= 17.11 ) AS tab3_371;

SELECT * FROM view_3_tab4_372;

SELECT pk FROM tab0 WHERE col1 > 71.95;

DROP VIEW view_1_tab1_375;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab2_376') DROP VIEW view_2_tab2_376;

DROP VIEW IF EXISTS view_2_tab3_377;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab4_378') DROP VIEW view_3_tab4_378;

DROP VIEW IF EXISTS view_3_tab0_380;

CREATE VIEW view_1_tab1_381 AS SELECT pk, col0 FROM tab1 WHERE col0 >= 14 AND ((col4 > 68.52)) AND (((col1 IN (20.80,16.93,55.21,10.11) AND col1 > 40.68 AND (col1 > 60.87 AND col0 <= 99 AND col1 < 27.46 AND col0 > 81 OR (col3 BETWEEN 67 AND 78)) OR ((col0 IN (35,37,68,83,4))) OR ((col3 > 62))) AND (col0 > 38) OR (col3 IN (40,6,38,61,46))));

CREATE VIEW view_2_tab2_382 AS SELECT pk, col0 FROM tab2 WHERE NOT (col0 BETWEEN 27 AND 50 AND col1 > 18.58 AND col4 > 13.94);

CREATE VIEW view_3_tab3_383 AS SELECT pk FROM view_1_tab3_383;

SELECT pk, col0 FROM tab4 WHERE (((col0 < 73 AND col1 > 96.67 OR col3 < 2)));

SELECT pk, col0 FROM tab0 WHERE NOT ((col3 >= 31));

SELECT pk, col0 FROM view_1_tab1_387;

SELECT pk, col0 FROM view_2_tab2_388;

SELECT pk, col0 FROM tab3 WHERE col0 >= 46 UNION ALL SELECT pk, col0 FROM tab3 WHERE NOT (col0 >= 46);

SELECT pk, col0 FROM view_1_tab4_390 UNION ALL SELECT pk, col0 FROM view_2_tab4_390;

SELECT pk, col0 FROM tab0 WHERE col4 <= 71.46 UNION SELECT pk, col0 FROM tab0 WHERE NOT (col4 <= 71.46);

SELECT pk, col0 FROM view_1_tab1_393 UNION SELECT pk, col0 FROM view_2_tab1_393;

SELECT pk FROM ( SELECT pk, col0 FROM tab2 WHERE ((col1 >= 63.83)) OR (col3 BETWEEN 55 AND 81 OR (col4 >= 55.67) AND (col0 IN (88,39,49)) OR (col4 <= 42.90)) ) AS tab2_394;

SELECT * FROM view_3_tab3_395;

SELECT pk FROM tab4 WHERE (((col0 = 78)));

DROP VIEW view_1_tab0_398;

DROP VIEW view_2_tab1_399;

DROP VIEW view_3_tab2_400;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab4_402') DROP VIEW view_1_tab4_402;

DROP VIEW IF EXISTS view_1_tab0_404;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab1_405') DROP VIEW view_2_tab1_405;

DROP VIEW IF EXISTS view_2_tab2_406;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab3_407') DROP VIEW view_3_tab3_407;

DROP VIEW IF EXISTS view_3_tab4_408;

CREATE VIEW view_1_tab0_410 AS SELECT pk, col0 FROM tab0 WHERE col3 <= 67 AND ((col4 < 56.31 AND (col3 < 40) AND (col0 > 12 OR ((col0 > 16 AND (col3 < 4)) AND (((((col1 = 27.19)) AND (col0 <= 96 OR ((col3 = 28))) AND (((col3 >= 57 AND (col3 <= 88)))) AND (col4 = 54.2))) OR col1 > 15.58) AND (((((col0 IN (41,52,87,23,92) AND (((((col4 >= 0.42))) AND (col3 < 48)))))) AND col0 >= 85)) AND col0 < 48)) OR (col3 < 1 OR (((col0 IS NULL OR col0 <= 19 OR col0 > 47 AND (col4 < 16.27) AND col4 > 36.78 AND col3 = 86 AND col0 > 68) AND col0 > 37) OR (col3 < 54) AND col3 <= 90 OR (col1 > 17.61) OR col3 <= 95 AND col3 BETWEEN 39 AND 15) AND (col3 = 76)) AND col3 > 59 AND (((col1 < 16.27))))) AND col3 > 49 AND ((col0 <= 34 AND col0 > 65)) AND (col4 >= 15.10) OR col1 <= 80.69 OR (col0 = 8) AND col1 IN (48.30) OR col1 < 44.95 OR col3 < 15 AND (col3 <= 98 OR col4 < 64.94) OR ((col4 >= 60.48)) AND col3 IN (17,13,81,2) AND col0 > 92 AND col0 > 57 AND (col4 = 88.82 OR col3 IN (SELECT col0 FROM tab0 WHERE col4 < 67.97)) AND col0 < 58 OR (col0 > 85 OR col0 = 48 OR (((col0 IN (77,78,25) OR col4 < 62.60 OR (col0 < 90))) AND (((col3 < 9) AND col1 = 17.55) AND col3 > 10 AND ((col1 >= 31.81 AND col0 BETWEEN 31 AND 70)) OR (col1 >= 52.28 AND col0 >= 61)) AND (col0 >= 48) AND col0 IS NULL AND (col1 <= 44.89) OR col3 < 26 OR col0 <= 71) AND ((col3 = 83 OR col3 = 0 OR (col0 >= 37 OR col3 > 5 AND col0 > 14 OR col4 = 20.74) AND col1 = 35.38))) OR col0 < 73 OR col3 IN (2,59) OR (col4 = 49.45) AND col4 >= 96.0 OR col1 <= 72.38 OR col4 > 46.20 OR (col1 IS NULL) OR ((col3 IN (SELECT col0 FROM tab0 WHERE (col0 <= 30) OR (((col0 >= 46 OR col0 = 9)) AND col0 >= 3)))) AND ((col3 > 67) OR col4 < 69.51) OR ((col0 IN (10,79,35)) OR col0 = 77 OR col3 <= 41 OR col3 > 19 AND (col0 <= 58));

CREATE VIEW view_2_tab1_411 AS SELECT pk, col0 FROM tab1 WHERE NOT ((((col0 > 57 OR col1 <= 75.61))));

CREATE VIEW view_3_tab2_412 AS SELECT pk FROM view_1_tab2_412;

SELECT pk, col0 FROM tab3 WHERE (col1 <= 40.38);

SELECT pk, col0 FROM tab4 WHERE NOT (col1 < 57.24);

SELECT pk, col0 FROM view_1_tab0_416;

SELECT pk, col0 FROM view_2_tab1_417;

SELECT pk, col0 FROM tab2 WHERE (col1 < 28.37) UNION ALL SELECT pk, col0 FROM tab2 WHERE NOT ((col1 < 28.37));

SELECT pk, col0 FROM view_1_tab3_419 UNION ALL SELECT pk, col0 FROM view_2_tab3_419;

SELECT pk, col0 FROM tab4 WHERE col4 > 18.48 AND (col4 <= 77.3) AND col3 > 22 UNION SELECT pk, col0 FROM tab4 WHERE NOT (col4 > 18.48 AND (col4 <= 77.3) AND col3 > 22);

SELECT pk, col0 FROM view_1_tab0_422 UNION SELECT pk, col0 FROM view_2_tab0_422;

SELECT pk FROM ( SELECT pk, col0 FROM tab1 WHERE ((col1 BETWEEN 55.18 AND 10.36 AND col3 >= 11)) ) AS tab1_423;

SELECT * FROM view_3_tab2_424;

SELECT pk FROM tab3 WHERE col3 > 37 AND ((col3 BETWEEN 83 AND 89)) AND col0 > 23 AND col1 > 1.35;

DROP VIEW view_1_tab4_426;

DROP VIEW view_2_tab0_428;

DROP VIEW view_3_tab1_429;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab3_430') DROP VIEW view_1_tab3_430;

DROP VIEW IF EXISTS view_1_tab4_431;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab0_433') DROP VIEW view_2_tab0_433;

DROP VIEW IF EXISTS view_2_tab1_434;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab2_435') DROP VIEW view_3_tab2_435;

DROP VIEW IF EXISTS view_3_tab3_436;

CREATE VIEW view_1_tab4_437 AS SELECT pk, col0 FROM tab4 WHERE col3 > 24;

CREATE VIEW view_2_tab0_439 AS SELECT pk, col0 FROM tab0 WHERE NOT (col3 < 91);

CREATE VIEW view_3_tab1_440 AS SELECT pk FROM view_1_tab1_440;

SELECT pk, col0 FROM tab2 WHERE col3 < 33 AND col3 < 29;

SELECT pk, col0 FROM tab3 WHERE NOT ((col3 >= 40));

SELECT pk, col0 FROM view_1_tab4_443;

SELECT pk, col0 FROM view_1_tab4_444 UNION ALL SELECT pk, col0 FROM view_2_tab4_444;

SELECT pk, col0 FROM tab0 WHERE (col3 >= 85) AND (col1 < 55.36) OR (col1 IN (91.93,48.61,57.4,26.33,57.8,94.13)) AND col1 >= 80.99 AND col0 < 41 OR ((col0 IN (56,73,62,63,40) OR col1 <= 61.7)) OR (col3 <= 57) AND col4 IS NULL AND col4 > 98.78 OR col3 <= 17 UNION SELECT pk, col0 FROM tab0 WHERE NOT ((col3 >= 85) AND (col1 < 55.36) OR (col1 IN (91.93,48.61,57.4,26.33,57.8,94.13)) AND col1 >= 80.99 AND col0 < 41 OR ((col0 IN (56,73,62,63,40) OR col1 <= 61.7)) OR (col3 <= 57) AND col4 IS NULL AND col4 > 98.78 OR col3 <= 17);

SELECT pk, col0 FROM view_1_tab1_447 UNION SELECT pk, col0 FROM view_2_tab1_447;

SELECT pk FROM ( SELECT pk, col0 FROM tab2 WHERE ((col1 <= 25.93)) ) AS tab2_448;

SELECT * FROM view_3_tab3_449;

SELECT pk FROM tab4 WHERE (col0 >= 25 AND col0 > 73 AND col3 = 70 AND col0 = 84 AND col0 IS NULL);

DROP VIEW view_1_tab0_452;

DROP VIEW view_2_tab1_453;

DROP VIEW view_3_tab2_454;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab4_455') DROP VIEW view_1_tab4_455;

DROP VIEW IF EXISTS view_1_tab0_457;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab1_458') DROP VIEW view_2_tab1_458;

DROP VIEW IF EXISTS view_2_tab2_459;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab3_460') DROP VIEW view_3_tab3_460;

DROP VIEW IF EXISTS view_3_tab4_461;

CREATE VIEW view_1_tab0_463 AS SELECT pk, col0 FROM tab0 WHERE col0 > 27 OR col3 > 67 AND col3 IS NULL OR (col0 IN (40,49));

CREATE VIEW view_2_tab1_464 AS SELECT pk, col0 FROM tab1 WHERE NOT (col0 = 79);

CREATE VIEW view_3_tab2_465 AS SELECT pk FROM view_1_tab2_465;

SELECT pk, col0 FROM tab3 WHERE ((col0 = 27)) AND col0 > 35 AND col4 > 45.46 OR (col4 >= 72.5) AND (col0 BETWEEN 44 AND 43) AND (col1 > 41.36 AND col1 >= 86.41);

SELECT pk, col0 FROM tab4 WHERE NOT (col1 > 57.87);

SELECT pk, col0 FROM view_1_tab0_469;

SELECT pk, col0 FROM view_2_tab1_470;

SELECT pk, col0 FROM tab2 WHERE col0 < 10 UNION ALL SELECT pk, col0 FROM tab2 WHERE NOT (col0 < 10);

SELECT pk, col0 FROM view_1_tab3_472 UNION ALL SELECT pk, col0 FROM view_2_tab3_472;

SELECT pk, col0 FROM tab4 WHERE col4 < 55.35 UNION SELECT pk, col0 FROM tab4 WHERE NOT (col4 < 55.35);

SELECT pk, col0 FROM view_1_tab0_475 UNION SELECT pk, col0 FROM view_2_tab0_475;

SELECT pk FROM ( SELECT pk, col0 FROM tab1 WHERE col4 > 65.10 ) AS tab1_476;

SELECT * FROM view_3_tab2_477;

SELECT pk FROM tab3 WHERE col1 = 6.62;

DROP VIEW view_1_tab4_479;

DROP VIEW view_2_tab0_481;

DROP VIEW view_3_tab1_482;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab3_483') DROP VIEW view_1_tab3_483;

DROP VIEW IF EXISTS view_1_tab4_484;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab0_486') DROP VIEW view_2_tab0_486;

DROP VIEW IF EXISTS view_2_tab1_487;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab2_488') DROP VIEW view_3_tab2_488;

DROP VIEW IF EXISTS view_3_tab3_489;

CREATE VIEW view_1_tab4_490 AS SELECT pk, col0 FROM tab4 WHERE col3 = 10;

CREATE VIEW view_2_tab0_492 AS SELECT pk, col0 FROM tab0 WHERE NOT (col3 <= 83 OR col0 IS NULL AND col0 < 9);

CREATE VIEW view_3_tab1_493 AS SELECT pk FROM view_1_tab1_493;

SELECT pk, col0 FROM tab2 WHERE (col1 > 58.64);

SELECT pk, col0 FROM tab3 WHERE NOT (col3 <= 41);

SELECT pk, col0 FROM view_1_tab4_496;

SELECT pk, col0 FROM view_2_tab0_499;

SELECT pk, col0 FROM tab1 WHERE col3 >= 17 UNION ALL SELECT pk, col0 FROM tab1 WHERE NOT (col3 >= 17);

SELECT pk, col0 FROM view_1_tab2_502 UNION ALL SELECT pk, col0 FROM view_2_tab2_502;

SELECT pk, col0 FROM tab3 WHERE col1 <= 39.69 UNION SELECT pk, col0 FROM tab3 WHERE NOT (col1 <= 39.69);

SELECT pk, col0 FROM view_1_tab4_504 UNION SELECT pk, col0 FROM view_2_tab4_504;

SELECT pk FROM ( SELECT pk, col0 FROM tab0 WHERE col0 > 16 AND (col4 > 55.94) ) AS tab0_506;

SELECT * FROM view_3_tab1_507;

SELECT pk FROM tab2 WHERE ((((col0 > 91 OR col1 > 30.39) OR (col3 > 59)) AND col3 < 74 AND ((col0 <= 32) AND col4 <= 63.88 OR col4 = 31.49) OR ((col3 > 37 AND col3 >= 66)) AND (col3 IS NULL)));

DROP VIEW view_1_tab3_509;

DROP VIEW view_2_tab4_510;

DROP VIEW view_3_tab0_512;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab2_513') DROP VIEW view_1_tab2_513;

DROP VIEW IF EXISTS view_1_tab3_514;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab4_515') DROP VIEW view_2_tab4_515;

DROP VIEW IF EXISTS view_2_tab0_517;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab1_518') DROP VIEW view_3_tab1_518;

DROP VIEW IF EXISTS view_3_tab2_519;

CREATE VIEW view_1_tab3_520 AS SELECT pk, col0 FROM tab3 WHERE (col3 < 63 AND col3 = 71 OR (col0 <= 3));

CREATE VIEW view_3_tab3_660 AS SELECT pk FROM view_1_tab3_660;

SELECT pk, col0 FROM tab4 WHERE col0 < 47 AND col0 >= 59 AND col3 > 28 AND col0 < 26 AND col0 = 48 OR (col0 >= 51 OR (col3 <= 34) OR col3 = 51 AND (col4 <= 36.25) AND col0 > 57 AND ((col3 > 48))) AND ((((col3 > 33 OR col0 < 57 OR col1 >= 64.11 OR col4 >= 97.82) AND col0 >= 40 AND col1 < 80.88) OR col4 >= 25.47));

SELECT pk, col0 FROM tab0 WHERE NOT ((((((col3 = 22)))) AND col3 BETWEEN 60 AND 24));

SELECT pk, col0 FROM view_1_tab1_665;

SELECT pk, col0 FROM view_2_tab2_666;

SELECT pk, col0 FROM tab3 WHERE col4 > 68.32 AND col3 >= 23 UNION ALL SELECT pk, col0 FROM tab3 WHERE NOT (col4 > 68.32 AND col3 >= 23);

SELECT pk, col0 FROM view_1_tab4_668 UNION ALL SELECT pk, col0 FROM view_2_tab4_668;

SELECT pk, col0 FROM tab0 WHERE col0 = 4 UNION SELECT pk, col0 FROM tab0 WHERE NOT (col0 = 4);

SELECT pk, col0 FROM view_1_tab1_671 UNION SELECT pk, col0 FROM view_2_tab1_671;

SELECT pk FROM ( SELECT pk, col0 FROM tab2 WHERE col0 <= 22 AND col3 > 44 OR ((col0 >= 59 AND col0 < 57 AND (col1 > 29.57) OR col3 <= 15 OR col1 < 71.72 OR (((col3 < 25))) AND (col0 = 28 AND (((col1 <= 12.9 AND col3 < 5))) OR col3 > 9 AND (((col1 IS NULL OR (col1 < 44.63 OR col0 = 71)))) OR col0 = 10) AND col4 IS NULL AND (col4 = 0.83) AND ((col3 >= 85)))) AND (col1 > 23.89) AND col0 > 17 OR (col0 <= 63) ) AS tab2_673;

SELECT * FROM view_3_tab3_674;

SELECT pk FROM tab4 WHERE col0 IS NULL AND col3 <= 74 OR col0 >= 22 OR col3 > 96 AND (col1 = 36.28) AND col4 <= 78.78;

DROP VIEW view_1_tab0_677;

DROP VIEW view_2_tab1_678;

DROP VIEW view_3_tab2_679;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab4_680') DROP VIEW view_1_tab4_680;

DROP VIEW IF EXISTS view_1_tab0_682;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab1_684') DROP VIEW view_2_tab1_684;

DROP VIEW IF EXISTS view_2_tab2_685;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab3_686') DROP VIEW view_3_tab3_686;

DROP VIEW IF EXISTS view_3_tab4_687;

CREATE VIEW view_1_tab0_689 AS SELECT pk, col0 FROM tab0 WHERE ((col1 IN (62.28,87.70,48.87)));

CREATE VIEW view_2_tab1_690 AS SELECT pk, col0 FROM tab1 WHERE NOT (col3 >= 46);

CREATE VIEW view_3_tab2_691 AS SELECT pk FROM view_1_tab2_691;

SELECT pk, col0 FROM tab3 WHERE col1 > 5.53 AND col0 > 60;

SELECT pk, col0 FROM tab4 WHERE NOT ((((col3 < 17 OR col1 > 64.64 AND (col1 IS NULL) OR (col1 IS NULL)))));

SELECT pk, col0 FROM view_1_tab0_696;

SELECT pk, col0 FROM view_2_tab1_697;

SELECT pk, col0 FROM tab2 WHERE ((col1 <= 14.36 OR col4 < 55.29) OR col3 <= 66 OR col3 >= 77 AND (col0 > 42) OR ((col3 > 54))) OR col0 = 9 UNION ALL SELECT pk, col0 FROM tab2 WHERE NOT (((col1 <= 14.36 OR col4 < 55.29) OR col3 <= 66 OR col3 >= 77 AND (col0 > 42) OR ((col3 > 54))) OR col0 = 9);

SELECT pk, col0 FROM view_1_tab3_699 UNION ALL SELECT pk, col0 FROM view_2_tab3_699;

SELECT pk, col0 FROM tab4 WHERE (col0 >= 18 AND (col1 > 39.63 AND col0 IS NULL)) UNION SELECT pk, col0 FROM tab4 WHERE NOT ((col0 >= 18 AND (col1 > 39.63 AND col0 IS NULL)));

SELECT pk, col0 FROM view_1_tab0_702 UNION SELECT pk, col0 FROM view_2_tab0_702;

SELECT pk FROM ( SELECT pk, col0 FROM tab1 WHERE col1 >= 92.4 ) AS tab1_703;

SELECT * FROM view_3_tab2_704;

SELECT pk FROM tab3 WHERE col3 > 74;

DROP VIEW view_1_tab4_706;

DROP VIEW view_2_tab0_708;

DROP VIEW view_3_tab1_709;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab3_710') DROP VIEW view_1_tab3_710;

DROP VIEW IF EXISTS view_1_tab4_711;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab0_713') DROP VIEW view_2_tab0_713;

DROP VIEW IF EXISTS view_2_tab1_714;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab2_715') DROP VIEW view_3_tab2_715;

DROP VIEW IF EXISTS view_3_tab3_716;

CREATE VIEW view_1_tab4_717 AS SELECT pk, col0 FROM tab4 WHERE col3 = 26;

CREATE VIEW view_2_tab0_719 AS SELECT pk, col0 FROM tab0 WHERE NOT (col3 > 96);

CREATE VIEW view_3_tab1_720 AS SELECT pk FROM view_1_tab1_720;

SELECT pk, col0 FROM tab2 WHERE ((col4 <= 20.52));

SELECT pk, col0 FROM tab3 WHERE NOT ((col3 >= 70 OR ((col3 <= 46 OR col0 IN (50,97,52)))));

SELECT pk, col0 FROM view_1_tab4_723;

SELECT pk, col0 FROM view_2_tab0_725;

SELECT pk, col0 FROM tab1 WHERE col0 > 84 AND col4 <= 74.98 AND col1 IN (SELECT col4 FROM tab1 WHERE (col4 > 35.62) AND ((col3 > 33) AND (((((col3 > 1))) AND (col0 = 21 OR (((col3 > 79))) AND (col1 < 18.85) AND ((col3 > 26)) OR ((col3 > 73) AND col3 <= 84)))) OR ((((col3 <= 35))) AND col1 > 16.74) AND col4 <= 51.42 AND (col1 > 97.18))) UNION ALL SELECT pk, col0 FROM tab1 WHERE NOT (col0 > 84 AND col4 <= 74.98 AND col1 IN (SELECT col4 FROM tab1 WHERE (col4 > 35.62) AND ((col3 > 33) AND (((((col3 > 1))) AND (col0 = 21 OR (((col3 > 79))) AND (col1 < 18.85) AND ((col3 > 26)) OR ((col3 > 73) AND col3 <= 84)))) OR ((((col3 <= 35))) AND col1 > 16.74) AND col4 <= 51.42 AND (col1 > 97.18))));

SELECT pk, col0 FROM view_1_tab2_727 UNION ALL SELECT pk, col0 FROM view_2_tab2_727;

SELECT pk, col0 FROM tab3 WHERE (col1 > 51.38 AND col3 < 6) UNION SELECT pk, col0 FROM tab3 WHERE NOT ((col1 > 51.38 AND col3 < 6));

SELECT pk, col0 FROM view_1_tab4_729 UNION SELECT pk, col0 FROM view_2_tab4_729;

SELECT pk FROM ( SELECT pk, col0 FROM tab0 WHERE ((col4 <= 56.89 AND col1 > 25.36)) AND col1 = 59.84 ) AS tab0_731;

SELECT * FROM view_3_tab1_732;

SELECT pk FROM tab2 WHERE col3 >= 99 AND (col0 >= 55 OR ((((col0 <= 16 AND (col0 > 71) AND ((col3 > 30 AND (col1 BETWEEN 87.15 AND 70.68) OR col1 > 45.55 OR col0 IS NULL OR (((col3 >= 72))))) OR (((col4 > 4.10))) AND (col0 IS NULL) OR (col3 > 73) OR col3 >= 35 AND col3 > 64 AND col1 IN (97.79,44.87,16.74,36.37,20.54,76.30) OR ((col1 IN (94.85,37.24,19.70) AND col0 > 25 AND (col3 > 42))) AND col0 = 17 OR (col0 < 55 AND col3 IS NULL) AND col1 = 60.16 OR col4 < 22.38 OR (col4 >= 74.10) OR (col0 > 79) AND col3 >= 59 AND (col4 >= 74.72 AND col3 > 62 OR ((col1 > 42.46))))) AND (col3 < 66)))) AND col3 >= 30;

DROP VIEW view_1_tab3_734;

DROP VIEW view_2_tab4_736;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab0_947') DROP VIEW view_2_tab0_947;

DROP VIEW IF EXISTS view_2_tab1_948;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab2_949') DROP VIEW view_3_tab2_949;

DROP VIEW IF EXISTS view_3_tab3_950;

CREATE VIEW view_1_tab4_951 AS SELECT pk, col0 FROM tab4 WHERE col1 = 21.5;

CREATE VIEW view_2_tab0_953 AS SELECT pk, col0 FROM tab0 WHERE NOT (col0 > 55);

CREATE VIEW view_3_tab1_954 AS SELECT pk FROM view_1_tab1_954;

SELECT pk, col0 FROM tab2 WHERE (col1 = 6.67);

SELECT pk, col0 FROM tab3 WHERE NOT ((col0 IN (36,50,61) OR col4 <= 91.8));

SELECT pk, col0 FROM view_1_tab4_957;

SELECT pk, col0 FROM view_2_tab0_960;

SELECT pk, col0 FROM tab1 WHERE (col0 > 33) UNION ALL SELECT pk, col0 FROM tab1 WHERE NOT ((col0 > 33));

SELECT pk, col0 FROM view_1_tab2_962 UNION ALL SELECT pk, col0 FROM view_2_tab2_962;

SELECT pk, col0 FROM tab3 WHERE (col0 < 56) AND col1 < 34.71 UNION SELECT pk, col0 FROM tab3 WHERE NOT ((col0 < 56) AND col1 < 34.71);

SELECT pk, col0 FROM view_1_tab4_964 UNION SELECT pk, col0 FROM view_2_tab4_964;

SELECT pk FROM ( SELECT pk, col0 FROM tab0 WHERE col0 IS NULL OR col3 < 54 ) AS tab0_966;

SELECT * FROM view_3_tab1_967;

SELECT pk FROM tab2 WHERE (col4 = 10.83);

DROP VIEW view_1_tab3_969;

DROP VIEW view_2_tab4_970;

DROP VIEW view_3_tab0_972;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab2_973') DROP VIEW view_1_tab2_973;

DROP VIEW IF EXISTS view_1_tab3_974;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab4_975') DROP VIEW view_2_tab4_975;

DROP VIEW IF EXISTS view_2_tab0_977;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab1_978') DROP VIEW view_3_tab1_978;

DROP VIEW IF EXISTS view_3_tab2_979;

CREATE VIEW view_1_tab3_980 AS SELECT pk, col0 FROM tab3 WHERE col4 < 69.53 OR col3 IS NULL;

CREATE VIEW view_2_tab4_981 AS SELECT pk, col0 FROM tab4 WHERE NOT (col1 <= 24.39);

CREATE VIEW view_3_tab0_983 AS SELECT pk FROM view_1_tab0_983;

SELECT pk, col0 FROM tab1 WHERE (col0 > 42) AND ((col1 IS NULL)) OR ((((col3 > 72)))) OR (((col3 <= 90) AND ((col0 > 68)) AND (col0 IN (45,3,50,1) OR col4 < 9.99 OR col3 IN (76,97,24) AND col1 > 8.58 AND (col0 = 3) AND (col0 >= 50 AND col0 IN (SELECT col3 FROM tab1 WHERE ((col3 <= 60)))) OR (col0 > 40) OR col0 < 72) AND (col3 <= 99)) AND ((col3 IS NULL) OR ((((((col4 >= 86.47) OR ((col0 < 99) AND col3 IS NULL)))))) OR col1 < 21.99)) AND col4 < 9.77 AND col4 = 9.91;

SELECT pk, col0 FROM tab2 WHERE NOT (col0 < 69);

SELECT pk, col0 FROM view_1_tab3_986;

SELECT pk, col0 FROM view_2_tab4_987;

SELECT pk, col0 FROM tab0 WHERE col3 > 33 UNION ALL SELECT pk, col0 FROM tab0 WHERE NOT (col3 > 33);

SELECT pk, col0 FROM view_1_tab1_990 UNION ALL SELECT pk, col0 FROM view_2_tab1_990;

SELECT pk, col0 FROM tab2 WHERE (col0 < 4 OR col0 IN (2,19,4,56)) UNION SELECT pk, col0 FROM tab2 WHERE NOT ((col0 < 4 OR col0 IN (2,19,4,56)));

SELECT pk, col0 FROM view_1_tab3_993 UNION SELECT pk, col0 FROM view_2_tab3_993;

SELECT pk FROM ( SELECT pk, col0 FROM tab4 WHERE ((col4 >= 49.48 AND col3 < 75)) ) AS tab4_994;

SELECT * FROM view_3_tab0_996;

SELECT pk FROM tab1 WHERE col0 = 52 OR col3 >= 30 AND col1 < 12.24 AND col3 > 61;

DROP VIEW view_1_tab2_998;

DROP VIEW view_2_tab3_999;

DROP VIEW view_3_tab4_1000;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab1_1002') DROP VIEW view_1_tab1_1002;

DROP VIEW IF EXISTS view_1_tab2_1003;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab3_1004') DROP VIEW view_2_tab3_1004;

DROP VIEW IF EXISTS view_2_tab4_1005;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab0_1007') DROP VIEW view_3_tab0_1007;

DROP VIEW IF EXISTS view_3_tab1_1008;

CREATE VIEW view_3_tab1_1009 AS SELECT pk FROM view_1_tab1_1009;

SELECT pk, col0 FROM tab2 WHERE col0 < 50;

SELECT pk, col0 FROM tab3 WHERE NOT (col0 < 78);

SELECT pk, col0 FROM view_1_tab4_1014;

SELECT pk, col0 FROM view_2_tab0_1016;

SELECT pk, col0 FROM tab1 WHERE (col0 >= 2) UNION ALL SELECT pk, col0 FROM tab1 WHERE NOT ((col0 >= 2));

SELECT pk, col0 FROM view_1_tab2_1018 UNION ALL SELECT pk, col0 FROM view_2_tab2_1018;

SELECT pk, col0 FROM tab3 WHERE col0 IN (93,81,44,3,48,11) UNION SELECT pk, col0 FROM tab3 WHERE NOT (col0 IN (93,81,44,3,48,11));

SELECT pk, col0 FROM view_1_tab4_1020 UNION SELECT pk, col0 FROM view_2_tab4_1020;

SELECT pk FROM ( SELECT pk, col0 FROM tab0 WHERE col0 > 22 OR col4 <= 27.14 ) AS tab0_1023;

SELECT * FROM view_3_tab1_1024;

SELECT pk FROM tab2 WHERE col3 <= 88 OR col4 <= 84.5;

DROP VIEW view_1_tab3_1026;

DROP VIEW view_2_tab4_1027;

DROP VIEW view_3_tab0_1029;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab2_1030') DROP VIEW view_1_tab2_1030;

DROP VIEW IF EXISTS view_1_tab3_1031;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab4_1032') DROP VIEW view_2_tab4_1032;

DROP VIEW IF EXISTS view_2_tab0_1035;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab1_1036') DROP VIEW view_3_tab1_1036;

DROP VIEW IF EXISTS view_3_tab2_1037;

CREATE VIEW view_1_tab3_1038 AS SELECT pk, col0 FROM tab3 WHERE (((col3 IS NULL) AND col3 > 51 OR col3 >= 87));

CREATE VIEW view_2_tab4_1039 AS SELECT pk, col0 FROM tab4 WHERE NOT (col4 = 51.56);

CREATE VIEW view_3_tab0_1041 AS SELECT pk FROM view_1_tab0_1041;

SELECT pk, col0 FROM tab1 WHERE ((col0 > 16 OR ((col0 < 9 OR col3 IN (SELECT col0 FROM tab1 WHERE (col0 < 94) AND col0 <= 61))) AND col3 = 18 OR col3 < 55 AND col3 IN (76,76) OR col3 >= 86 AND ((((((col0 < 9)))) AND col0 = 70 OR col1 IS NULL) AND (col3 IN (31,92,0))))) AND col1 > 29.45 OR col4 < 19.59;

SELECT pk, col0 FROM tab2 WHERE NOT (col1 > 21.41);

SELECT pk, col0 FROM view_1_tab3_1045;

SELECT pk, col0 FROM view_2_tab4_1046;

SELECT pk, col0 FROM tab0 WHERE col0 <= 13 UNION ALL SELECT pk, col0 FROM tab0 WHERE NOT (col0 <= 13);

SELECT pk, col0 FROM view_1_tab1_1050 UNION ALL SELECT pk, col0 FROM view_2_tab1_1050;

SELECT pk, col0 FROM tab2 WHERE col1 > 35.69 UNION SELECT pk, col0 FROM tab2 WHERE NOT (col1 > 35.69);

SELECT pk, col0 FROM view_1_tab3_1052 UNION SELECT pk, col0 FROM view_2_tab3_1052;

SELECT pk FROM ( SELECT pk, col0 FROM tab4 WHERE (col1 >= 88.90 AND (col0 = 56)) AND ((col1 >= 39.62)) ) AS tab4_1053;

SELECT * FROM view_3_tab0_1055;

SELECT pk FROM tab1 WHERE col1 > 2.15 OR ((col1 <= 28.98 AND (col3 <= 90) OR col1 > 29.76 OR col3 BETWEEN 51 AND 95)) AND ((col1 < 34.52 AND col3 <= 48) OR col3 IS NULL OR col3 >= 92 AND col3 = 66 AND (col3 >= 0));

DROP VIEW view_1_tab2_1057;

DROP VIEW view_2_tab3_1058;

DROP VIEW view_3_tab4_1060;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab1_1062') DROP VIEW view_1_tab1_1062;

DROP VIEW IF EXISTS view_1_tab2_1063;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab3_1064') DROP VIEW view_2_tab3_1064;

DROP VIEW IF EXISTS view_2_tab4_1065;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab0_1067') DROP VIEW view_3_tab0_1067;

DROP VIEW IF EXISTS view_3_tab1_1068;

CREATE VIEW view_1_tab2_1069 AS SELECT pk, col0 FROM tab2 WHERE col3 >= 30;

CREATE VIEW view_2_tab3_1070 AS SELECT pk, col0 FROM tab3 WHERE NOT (((col0 >= 30)) AND col1 <= 34.36 OR (col4 >= 14.91) AND ((((col0 < 22))) OR ((col0 <= 27 AND (col0 >= 19) AND (col4 >= 96.82) AND (col3 > 29) OR (col0 >= 29) AND (col0 IN (77,15)) AND col1 >= 2.18 AND col3 > 21))));

CREATE VIEW view_3_tab4_1071 AS SELECT pk FROM view_1_tab4_1071;

SELECT pk, col0 FROM tab0 WHERE col1 < 2.58 AND col3 < 75;

SELECT pk, col0 FROM tab1 WHERE NOT (col0 IS NULL AND ((col3 > 72)) AND (((((((col1 < 93.76)))))) OR (((col3 < 60)) OR col0 <= 79 OR col0 > 52 AND (col0 = 55 OR col3 < 35 AND ((col4 < 7.4)) AND col4 > 3.23 OR (col4 < 12.88) OR col1 = 57.74 AND col3 > 64 AND col3 > 41 OR col1 IS NULL AND (col3 BETWEEN 1 AND 98) AND (col3 >= 18) OR (col1 > 95.22) OR col3 IS NULL AND col4 > 8.41 OR col3 < 15 OR col4 >= 66.17 OR col0 < 86 AND (((col3 IN (0,12,82,91,56,80)))) AND col1 > 64.56 AND col0 < 53 AND col3 <= 84 AND ((col3 <= 18) OR col1 > 80.0)) OR ((col0 >= 96)) AND (col4 IS NULL) OR col3 > 73) AND col1 = 26.89 OR ((col3 > 30 OR (col3 >= 59)))) AND ((col3 >= 92) AND (((((col3 < 65)))))));

SELECT pk, col0 FROM view_1_tab2_1075;

SELECT pk, col0 FROM view_2_tab3_1076;

SELECT pk, col0 FROM tab4 WHERE col3 < 53 UNION ALL SELECT pk, col0 FROM tab4 WHERE NOT (col3 < 53);

SELECT pk, col0 FROM view_1_tab0_1079 UNION ALL SELECT pk, col0 FROM view_2_tab0_1079;

SELECT pk, col0 FROM tab1 WHERE col3 >= 24 UNION SELECT pk, col0 FROM tab1 WHERE NOT (col3 >= 24);

SELECT pk, col0 FROM view_1_tab2_1081 UNION SELECT pk, col0 FROM view_2_tab2_1081;

SELECT pk FROM ( SELECT pk, col0 FROM tab3 WHERE (col3 = 24) ) AS tab3_1082;

SELECT * FROM view_3_tab4_1083;

INSERT INTO tab0 VALUES(19,627,227.90,'nvozb',383,245.81,'nfivv');

DROP VIEW IF EXISTS view_2_tab2_77;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab3_78') DROP VIEW view_3_tab3_78;

DROP VIEW IF EXISTS view_3_tab4_79;

CREATE VIEW view_1_tab0_81 AS SELECT pk, col0 FROM tab0 WHERE col0 < 230;

CREATE VIEW view_2_tab1_82 AS SELECT pk, col0 FROM tab1 WHERE NOT ((col1 < 654.68 OR col1 > 91.43 AND (col3 > 136 AND col3 < 286)));

CREATE VIEW view_3_tab2_83 AS SELECT pk FROM view_1_tab2_83;

SELECT pk, col0 FROM tab3 WHERE col0 > 979;

SELECT pk, col0 FROM tab4 WHERE NOT (col4 < 377.40);

SELECT pk, col0 FROM view_1_tab0_87;

SELECT pk, col0 FROM view_2_tab1_88;

SELECT pk, col0 FROM tab2 WHERE col1 <= 38.96 AND col4 IN (717.97,930.23,946.43,274.22,960.73) OR col3 <= 746 UNION ALL SELECT pk, col0 FROM tab2 WHERE NOT (col1 <= 38.96 AND col4 IN (717.97,930.23,946.43,274.22,960.73) OR col3 <= 746);

SELECT pk, col0 FROM view_1_tab3_90 UNION ALL SELECT pk, col0 FROM view_2_tab3_90;

SELECT pk, col0 FROM tab4 WHERE col0 BETWEEN 426 AND 515 UNION SELECT pk, col0 FROM tab4 WHERE NOT (col0 BETWEEN 426 AND 515);

SELECT pk, col0 FROM view_1_tab0_93 UNION SELECT pk, col0 FROM view_2_tab0_93;

SELECT pk FROM ( SELECT pk, col0 FROM tab1 WHERE (col4 > 594.73) ) AS tab1_94;

SELECT * FROM view_3_tab2_95;

SELECT pk FROM tab3 WHERE col0 > 890;

DROP VIEW view_1_tab4_97;

DROP VIEW view_2_tab0_99;

DROP VIEW view_3_tab1_100;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab3_101') DROP VIEW view_1_tab3_101;

DROP VIEW IF EXISTS view_1_tab4_102;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab0_104') DROP VIEW view_2_tab0_104;

DROP VIEW IF EXISTS view_2_tab1_105;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab2_106') DROP VIEW view_3_tab2_106;

DROP VIEW IF EXISTS view_3_tab3_107;

CREATE VIEW view_1_tab4_108 AS SELECT pk, col0 FROM tab4 WHERE (col1 IS NULL);

CREATE VIEW view_2_tab0_110 AS SELECT pk, col0 FROM tab0 WHERE NOT (col0 > 241 OR col0 >= 539 AND (col4 < 975.45) AND col3 >= 543 AND col0 < 29);

CREATE VIEW view_3_tab1_111 AS SELECT pk FROM view_1_tab1_111;

SELECT pk, col0 FROM tab2 WHERE (col0 IN (90,830,168,405,662) AND ((col0 > 840)) OR col3 > 985 OR ((col3 BETWEEN 794 AND 802) AND col0 = 488 OR col0 > 74) OR col4 <= 292.98 AND col3 > 425 AND ((col3 = 498) AND col3 IS NULL) AND (col3 > 689));

SELECT pk, col0 FROM tab3 WHERE NOT (col1 < 482.39);

SELECT pk, col0 FROM view_1_tab4_114;

SELECT pk, col0 FROM view_2_tab0_116;

SELECT pk, col0 FROM tab1 WHERE ((col3 < 151)) UNION ALL SELECT pk, col0 FROM tab1 WHERE NOT (((col3 < 151)));

SELECT pk, col0 FROM view_1_tab2_118 UNION ALL SELECT pk, col0 FROM view_2_tab2_118;

SELECT pk, col0 FROM tab3 WHERE (col3 < 731 OR (col0 > 218 AND col0 > 858 AND col3 > 697 AND col1 IN (103.75,858.78) AND ((col0 <= 629)))) UNION SELECT pk, col0 FROM tab3 WHERE NOT ((col3 < 731 OR (col0 > 218 AND col0 > 858 AND col3 > 697 AND col1 IN (103.75,858.78) AND ((col0 <= 629)))));

SELECT pk, col0 FROM view_1_tab4_120 UNION SELECT pk, col0 FROM view_2_tab4_120;

SELECT pk FROM ( SELECT pk, col0 FROM tab0 WHERE col3 < 635 ) AS tab0_122;

SELECT * FROM view_3_tab1_123;

SELECT pk FROM tab2 WHERE (col0 > 82);

DROP VIEW view_1_tab3_125;

DROP VIEW view_2_tab4_126;

DROP VIEW view_3_tab0_128;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab2_129') DROP VIEW view_1_tab2_129;

DROP VIEW IF EXISTS view_1_tab3_130;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab4_131') DROP VIEW view_2_tab4_131;

DROP VIEW IF EXISTS view_2_tab0_133;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab1_134') DROP VIEW view_3_tab1_134;

DROP VIEW IF EXISTS view_3_tab2_135;

CREATE VIEW view_1_tab3_136 AS SELECT pk, col0 FROM tab3 WHERE ((col0 <= 556));

CREATE VIEW view_2_tab4_137 AS SELECT pk, col0 FROM tab4 WHERE NOT (((((col0 < 272 OR col4 > 825.1 OR col0 < 851) OR ((col0 >= 274 AND col4 = 221.59)) AND col0 < 394))) AND col1 IS NULL);

CREATE VIEW view_3_tab0_139 AS SELECT pk FROM view_1_tab0_139;

SELECT pk, col0 FROM tab1 WHERE (col3 > 909);

SELECT pk, col0 FROM tab2 WHERE NOT ((col1 > 474.94));

SELECT pk, col0 FROM view_1_tab3_142;

SELECT pk, col0 FROM view_2_tab4_143;

SELECT pk, col0 FROM tab0 WHERE col3 = 980 AND col4 > 70.95 AND ((col0 = 807)) UNION ALL SELECT pk, col0 FROM tab0 WHERE NOT (col3 = 980 AND col4 > 70.95 AND ((col0 = 807)));

SELECT pk, col0 FROM view_1_tab1_146 UNION ALL SELECT pk, col0 FROM view_2_tab1_146;

SELECT pk, col0 FROM tab2 WHERE (col1 > 684.6) UNION SELECT pk, col0 FROM tab2 WHERE NOT ((col1 > 684.6));

SELECT pk, col0 FROM view_1_tab3_148 UNION SELECT pk, col0 FROM view_2_tab3_148;

SELECT pk FROM ( SELECT pk, col0 FROM tab4 WHERE (col0 BETWEEN 831 AND 838) ) AS tab4_149;

SELECT * FROM view_3_tab0_151;

SELECT pk FROM tab1 WHERE col1 > 343.72;

INSERT INTO tab0 VALUES(66,282,845.89,'inlpc',994,890.37,'oezot');

CREATE VIEW view_3_tab4_226 AS SELECT pk FROM view_1_tab4_226;

SELECT pk, col0 FROM tab0 WHERE ((((col4 IN (962.87,413.75,599.80))) AND col0 IN (165,818,88) AND col3 < 934 AND (col3 <= 220) OR col3 < 269));

SELECT pk, col0 FROM tab1 WHERE NOT (col1 >= 58.87 OR col0 > 203 OR (col3 IS NULL));

SELECT pk, col0 FROM view_1_tab2_230;

SELECT pk, col0 FROM view_2_tab3_231;

SELECT pk, col0 FROM tab4 WHERE (((col1 <= 384.28))) AND (col3 >= 446 AND (((col0 = 750 AND (col3 > 874) OR ((col3 >= 247) AND ((col0 >= 716)))) OR (col1 < 535.60 AND col3 IN (811,704,477) AND ((col3 > 50 OR (col1 = 468.42 OR col4 > 399.87))))))) AND col1 < 887.39 OR col3 = 379 UNION ALL SELECT pk, col0 FROM tab4 WHERE NOT ((((col1 <= 384.28))) AND (col3 >= 446 AND (((col0 = 750 AND (col3 > 874) OR ((col3 >= 247) AND ((col0 >= 716)))) OR (col1 < 535.60 AND col3 IN (811,704,477) AND ((col3 > 50 OR (col1 = 468.42 OR col4 > 399.87))))))) AND col1 < 887.39 OR col3 = 379);

SELECT pk, col0 FROM view_1_tab0_234 UNION ALL SELECT pk, col0 FROM view_2_tab0_234;

SELECT pk, col0 FROM tab1 WHERE col1 < 454.34 UNION SELECT pk, col0 FROM tab1 WHERE NOT (col1 < 454.34);

SELECT pk, col0 FROM view_1_tab2_236 UNION SELECT pk, col0 FROM view_2_tab2_236;

SELECT pk FROM ( SELECT pk, col0 FROM tab3 WHERE col4 < 750.37 OR ((col0 > 876 AND col0 > 638 AND (col0 >= 42))) ) AS tab3_237;

SELECT * FROM view_3_tab4_239;

SELECT pk FROM tab0 WHERE (col3 < 776);

DROP VIEW view_1_tab1_243;

DROP VIEW view_2_tab2_245;

DROP VIEW view_3_tab3_246;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab0_248') DROP VIEW view_1_tab0_248;

DROP VIEW IF EXISTS view_1_tab1_249;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab2_250') DROP VIEW view_2_tab2_250;

DROP VIEW IF EXISTS view_2_tab3_251;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab4_252') DROP VIEW view_3_tab4_252;

DROP VIEW IF EXISTS view_3_tab0_254;

CREATE VIEW view_1_tab1_255 AS SELECT pk, col0 FROM tab1 WHERE col3 = 72 AND (col0 IN (34,203) AND col1 < 655.0);

CREATE VIEW view_2_tab2_256 AS SELECT pk, col0 FROM tab2 WHERE NOT ((col3 <= 457) OR col0 < 688);

CREATE VIEW view_3_tab3_257 AS SELECT pk FROM view_1_tab3_257;

SELECT pk, col0 FROM tab4 WHERE ((col0 >= 11));

SELECT pk, col0 FROM tab0 WHERE NOT ((col1 IN (344.84,326.40,509.8,263.0)));

SELECT pk, col0 FROM view_1_tab1_262;

SELECT pk, col0 FROM view_2_tab2_263;

SELECT pk, col0 FROM tab3 WHERE col0 = 161 UNION ALL SELECT pk, col0 FROM tab3 WHERE NOT (col0 = 161);

SELECT pk, col0 FROM view_1_tab4_265 UNION ALL SELECT pk, col0 FROM view_2_tab4_265;

SELECT pk, col0 FROM tab0 WHERE (col3 IN (163,887,124,808,198) OR col4 > 490.27 OR col4 = 640.57 AND col0 < 258 AND col1 >= 674.98 OR col0 IS NULL AND (col0 >= 677) OR col0 < 331 AND col0 < 163 AND (col0 <= 470) OR col0 <= 431 OR col0 < 642 AND (col0 IS NULL)) UNION SELECT pk, col0 FROM tab0 WHERE NOT ((col3 IN (163,887,124,808,198) OR col4 > 490.27 OR col4 = 640.57 AND col0 < 258 AND col1 >= 674.98 OR col0 IS NULL AND (col0 >= 677) OR col0 < 331 AND col0 < 163 AND (col0 <= 470) OR col0 <= 431 OR col0 < 642 AND (col0 IS NULL)));

SELECT pk, col0 FROM view_1_tab1_268 UNION SELECT pk, col0 FROM view_2_tab1_268;

SELECT pk FROM ( SELECT pk, col0 FROM tab2 WHERE col1 < 641.78 ) AS tab2_269;

SELECT * FROM view_3_tab3_270;

SELECT pk FROM tab4 WHERE (col0 = 850 OR col3 = 474);

DROP VIEW view_1_tab0_273;

DROP VIEW view_2_tab1_274;

DROP VIEW view_3_tab2_275;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab4_276') DROP VIEW view_1_tab4_276;

DROP VIEW IF EXISTS view_1_tab0_278;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab1_279') DROP VIEW view_2_tab1_279;

DROP VIEW IF EXISTS view_2_tab2_280;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab3_282') DROP VIEW view_3_tab3_282;

DROP VIEW IF EXISTS view_3_tab4_283;

CREATE VIEW view_1_tab0_286 AS SELECT pk, col0 FROM tab0 WHERE (col1 = 664.28 AND col0 = 338 AND (col3 = 35 AND ((col4 > 778.22))));

CREATE VIEW view_2_tab1_287 AS SELECT pk, col0 FROM tab1 WHERE NOT (col0 > 722);

CREATE VIEW view_3_tab2_288 AS SELECT pk FROM view_1_tab2_288;

SELECT pk, col0 FROM tab3 WHERE col0 <= 642 AND col3 > 287 OR col1 <= 864.75 OR ((col0 <= 374) AND col0 < 948 AND ((col4 >= 641.11 OR col0 BETWEEN 55 AND 643)) OR (col3 <= 64) AND (col3 IN (191,792) AND col0 = 634 AND ((((col3 >= 591))))) AND col1 >= 554.71) AND (((((col3 > 747)))) OR (col3 < 837));

SELECT pk, col0 FROM tab4 WHERE NOT ((((col3 <= 612) OR (((col3 IS NULL)) OR col0 >= 43) AND col0 >= 977 OR (col4 = 341.48 OR (col4 = 376.78) AND (col1 > 719.86) OR ((col0 = 234 OR col3 >= 213)) OR (col3 IS NULL)) OR (col4 BETWEEN 832.17 AND 882.42) AND col4 < 158.51)));

SELECT pk, col0 FROM view_1_tab0_292;

SELECT pk, col0 FROM view_2_tab1_293;

SELECT pk, col0 FROM tab2 WHERE col3 <= 687 AND col3 >= 393 OR col1 = 192.1 UNION ALL SELECT pk, col0 FROM tab2 WHERE NOT (col3 <= 687 AND col3 >= 393 OR col1 = 192.1);

SELECT pk, col0 FROM view_1_tab3_295 UNION ALL SELECT pk, col0 FROM view_2_tab3_295;

SELECT pk, col0 FROM tab4 WHERE col4 >= 265.28 UNION SELECT pk, col0 FROM tab4 WHERE NOT (col4 >= 265.28);

SELECT pk, col0 FROM view_1_tab0_298 UNION SELECT pk, col0 FROM view_2_tab0_298;

SELECT pk FROM ( SELECT pk, col0 FROM tab1 WHERE col3 < 424 ) AS tab1_299;

SELECT * FROM view_3_tab2_300;

SELECT pk FROM tab3 WHERE col3 < 503 OR col3 IN (327,997) AND col0 >= 541 AND (col0 > 495 AND (col4 >= 258.46 AND col4 IS NULL AND col0 >= 747 OR (col3 < 676) AND col3 < 649 OR (col1 >= 839.72 AND ((col0 > 444 OR col3 = 316 AND (((col3 < 241) AND (col4 > 37.76 AND col3 <= 594))) OR (((col1 < 107.89))) AND col3 >= 235)) AND col3 = 643 OR col3 >= 341 OR col1 < 842.48 AND col0 < 202) AND col3 >= 500 OR (col0 < 84 AND col0 >= 371) OR (col0 BETWEEN 440 AND 778 AND (col1 IN (527.40,784.55,103.64)) AND col3 < 825)));

DROP VIEW IF EXISTS view_3_tab0_521;

CREATE VIEW view_1_tab1_523 AS SELECT pk, col0 FROM tab1 WHERE (col0 > 333);

CREATE VIEW view_2_tab2_524 AS SELECT pk, col0 FROM tab2 WHERE NOT (col3 > 693 OR col0 > 732 OR col3 IS NULL OR col4 >= 538.47);

CREATE VIEW view_3_tab3_525 AS SELECT pk FROM view_1_tab3_525;

SELECT pk, col0 FROM tab4 WHERE (col4 = 717.55 OR col3 >= 156 AND col0 < 727 OR col3 <= 697);

SELECT pk, col0 FROM tab0 WHERE NOT (col3 < 340);

SELECT pk, col0 FROM view_1_tab1_530;

SELECT pk, col0 FROM view_2_tab2_531;

SELECT pk, col0 FROM tab3 WHERE col0 > 264 UNION ALL SELECT pk, col0 FROM tab3 WHERE NOT (col0 > 264);

SELECT pk, col0 FROM view_1_tab4_533 UNION ALL SELECT pk, col0 FROM view_2_tab4_533;

SELECT pk, col0 FROM tab0 WHERE col1 > 649.69 UNION SELECT pk, col0 FROM tab0 WHERE NOT (col1 > 649.69);

SELECT pk, col0 FROM view_1_tab1_536 UNION SELECT pk, col0 FROM view_2_tab1_536;

SELECT pk FROM ( SELECT pk, col0 FROM tab2 WHERE col3 > 964 ) AS tab2_537;

SELECT * FROM view_3_tab3_538;

SELECT pk FROM tab4 WHERE ((((col4 IN (272.1,413.34) AND col0 < 382) OR col0 >= 385 OR (col3 <= 508)) OR col0 < 11));

DROP VIEW view_1_tab0_541;

DROP VIEW view_2_tab1_542;

DROP VIEW view_3_tab2_543;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab4_544') DROP VIEW view_1_tab4_544;

DROP VIEW IF EXISTS view_1_tab0_546;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab1_547') DROP VIEW view_2_tab1_547;

DROP VIEW IF EXISTS view_2_tab2_548;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab3_549') DROP VIEW view_3_tab3_549;

DROP VIEW IF EXISTS view_3_tab4_550;

CREATE VIEW view_1_tab0_552 AS SELECT pk, col0 FROM tab0 WHERE (col3 IS NULL AND (col0 >= 558) AND col4 IS NULL AND col3 = 239 OR col0 IS NULL);

CREATE VIEW view_2_tab1_554 AS SELECT pk, col0 FROM tab1 WHERE NOT (col1 < 94.39);

CREATE VIEW view_3_tab2_555 AS SELECT pk FROM view_1_tab2_555;

SELECT pk, col0 FROM tab3 WHERE col3 BETWEEN 132 AND 850;

SELECT pk, col0 FROM tab4 WHERE NOT ((((col3 > 799))));

SELECT pk, col0 FROM view_1_tab0_559;

SELECT pk, col0 FROM view_2_tab1_560;

SELECT pk, col0 FROM tab2 WHERE col0 = 548 UNION ALL SELECT pk, col0 FROM tab2 WHERE NOT (col0 = 548);

SELECT pk, col0 FROM view_1_tab3_562 UNION ALL SELECT pk, col0 FROM view_2_tab3_562;

SELECT pk, col0 FROM tab4 WHERE col0 < 680 UNION SELECT pk, col0 FROM tab4 WHERE NOT (col0 < 680);

SELECT pk, col0 FROM view_1_tab0_565 UNION SELECT pk, col0 FROM view_2_tab0_565;

SELECT pk FROM ( SELECT pk, col0 FROM tab1 WHERE (col3 > 999 AND col1 = 524.55) OR col3 > 124 ) AS tab1_566;

SELECT * FROM view_3_tab2_567;

SELECT pk FROM tab3 WHERE (col0 > 569);

DROP VIEW view_1_tab4_569;

DROP VIEW view_2_tab0_572;

DROP VIEW view_3_tab1_573;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab3_574') DROP VIEW view_1_tab3_574;

DROP VIEW IF EXISTS view_1_tab4_575;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab0_577') DROP VIEW view_2_tab0_577;

DROP VIEW IF EXISTS view_2_tab1_578;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab2_579') DROP VIEW view_3_tab2_579;

DROP VIEW IF EXISTS view_3_tab3_580;

CREATE VIEW view_1_tab4_581 AS SELECT pk, col0 FROM tab4 WHERE (col1 > 315.20 OR col0 < 855) AND col3 > 496;

CREATE VIEW view_2_tab0_583 AS SELECT pk, col0 FROM tab0 WHERE NOT (((col0 <= 976)));

CREATE VIEW view_3_tab1_584 AS SELECT pk FROM view_1_tab1_584;

SELECT pk, col0 FROM tab2 WHERE col1 < 353.14;

SELECT pk, col0 FROM tab3 WHERE NOT ((col0 >= 683));

SELECT pk, col0 FROM view_1_tab4_587;

SELECT pk, col0 FROM view_2_tab0_589;

SELECT pk, col0 FROM tab1 WHERE col4 BETWEEN 76.99 AND 316.5 AND col3 > 298 UNION ALL SELECT pk, col0 FROM tab1 WHERE NOT (col4 BETWEEN 76.99 AND 316.5 AND col3 > 298);

SELECT pk, col0 FROM view_1_tab2_591 UNION ALL SELECT pk, col0 FROM view_2_tab2_591;

SELECT pk, col0 FROM tab3 WHERE (col1 >= 234.10) UNION SELECT pk, col0 FROM tab3 WHERE NOT ((col1 >= 234.10));

SELECT pk, col0 FROM view_1_tab4_593 UNION SELECT pk, col0 FROM view_2_tab4_593;

SELECT pk FROM ( SELECT pk, col0 FROM tab0 WHERE (col4 IN (952.5,438.34,33.7,993.81) OR (col0 >= 112)) AND col0 > 519 AND col4 = 861.3 ) AS tab0_595;

SELECT * FROM view_3_tab1_596;

INSERT INTO tab0 VALUES(65,853,120.84,'kcswt',623,919.41,'wvygj');

CREATE VIEW view_1_tab4_597 AS SELECT pk, col0 FROM tab4 WHERE ((col1 >= 565.79)) AND col0 > 948 AND (col4 > 207.27 OR col3 = 331);

CREATE VIEW view_2_tab0_599 AS SELECT pk, col0 FROM tab0 WHERE NOT (col4 > 663.95);

CREATE VIEW view_3_tab1_600 AS SELECT pk FROM view_1_tab1_600;

SELECT pk, col0 FROM tab2 WHERE col3 <= 671;

SELECT pk, col0 FROM tab3 WHERE NOT (col0 IN (SELECT col3 FROM tab3 WHERE col0 >= 795) OR col3 >= 543 OR col3 > 991 AND (((col3 < 927 OR (col3 < 430)) AND (col0 > 590) OR (col0 >= 449 AND col4 > 729.35 OR (((col3 >= 745 AND col0 IN (376,260))) AND col0 = 742 OR ((col3 < 407))) AND col0 IN (SELECT col3 FROM tab3 WHERE (col4 = 553.85) AND (((col0 < 112)) OR (col3 > 499 AND (col1 < 892.72 OR col1 = 45.15 AND (col4 > 325.92 OR ((col3 > 799) AND col3 >= 373 AND (((((col3 <= 742)) AND col3 > 837))) AND col0 > 431 OR col0 > 614 OR ((col4 IN (128.97,578.47,613.81))) AND col0 = 579 AND col0 > 141) AND (col0 <= 50 AND ((col3 <= 640) OR (col0 = 347) AND (col0 >= 814) AND col3 > 355 OR col3 >= 216 OR col0 <= 695 AND ((col3 < 786 OR col3 > 720)) AND col3 > 646) AND col3 >= 67 OR (col3 < 139 AND col4 = 865.77 AND col3 BETWEEN 954 AND 133 OR col3 IN (SELECT col0 FROM tab3 WHERE col0 < 261 AND col0 > 477 OR col0 > 148 AND (col1 < 285.10) AND (col0 = 144) AND col3 IS NULL AND col1 > 284.82 AND col1 <= 217.12 OR col1 >= 690.53 AND col4 > 967.41 OR col0 BETWEEN 657 AND 38 AND (col1 > 833.26) OR col4 IS NULL OR (col0 IS NULL) AND (col3 < 419) AND col4 > 56.14 OR col0 < 971 AND (col0 >= 325) AND (col1 >= 333.69 AND col4 < 115.0) OR (col0 = 769) AND (col0 >= 302) AND col1 >= 948.69 OR (col1 < 488.22) AND col1 > 366.35 AND (col3 > 100) AND (col1 > 318.25 OR col3 > 322) AND ((col1 > 106.75)) OR col0 < 27 OR col0 >= 667) OR col0 < 840))) AND col4 IN (SELECT col1 FROM tab3 WHERE ((((col3 BETWEEN 846 AND 251)))))) OR (((col3 < 66 AND col4 = 146.82 AND ((((((col1 >= 404.9) AND col0 >= 148 AND (col0 >= 22) AND col0 >= 925 OR col0 >= 765 OR (col3 < 526))))))))) AND (col4 > 575.86 AND (col3 <= 62)) AND col1 > 494.37)) OR col3 < 544) OR (col0 >= 974) AND col1 < 631.39 OR col4 IN (200.63,43.35,782.64,301.38,958.13,883.69) OR col0 < 820))));

SELECT pk, col0 FROM view_1_tab4_603;

SELECT pk, col0 FROM view_2_tab0_605;

SELECT pk, col0 FROM tab1 WHERE (col3 > 274 AND col0 >= 182) UNION ALL SELECT pk, col0 FROM tab1 WHERE NOT ((col3 > 274 AND col0 >= 182));

SELECT pk, col0 FROM view_1_tab2_607 UNION ALL SELECT pk, col0 FROM view_2_tab2_607;

SELECT pk, col0 FROM tab3 WHERE col0 <= 627 UNION SELECT pk, col0 FROM tab3 WHERE NOT (col0 <= 627);

SELECT pk, col0 FROM view_1_tab4_609 UNION SELECT pk, col0 FROM view_2_tab4_609;

SELECT pk FROM ( SELECT pk, col0 FROM tab0 WHERE col0 > 873 ) AS tab0_611;

SELECT * FROM view_3_tab1_612;

SELECT pk FROM tab2 WHERE (col3 > 677 AND (col3 < 952) OR col0 = 444 AND col0 >= 499 OR col0 > 868);

DROP VIEW view_1_tab3_614;

DROP VIEW view_2_tab4_615;

DROP VIEW view_3_tab0_617;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab2_618') DROP VIEW view_1_tab2_618;

DROP VIEW IF EXISTS view_1_tab3_619;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab4_620') DROP VIEW view_2_tab4_620;

DROP VIEW IF EXISTS view_2_tab0_622;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab1_623') DROP VIEW view_3_tab1_623;

DROP VIEW IF EXISTS view_3_tab2_624;

CREATE VIEW view_1_tab3_625 AS SELECT pk, col0 FROM tab3 WHERE col1 = 954.53;

CREATE VIEW view_2_tab4_626 AS SELECT pk, col0 FROM tab4 WHERE NOT ((col0 > 811));

CREATE VIEW view_3_tab0_628 AS SELECT pk FROM view_1_tab0_628;

SELECT pk, col0 FROM tab1 WHERE (col4 BETWEEN 408.57 AND 368.80 AND col4 IS NULL AND col0 < 643 OR col3 IS NULL);

SELECT pk, col0 FROM tab2 WHERE NOT (col0 <= 161 AND ((col3 > 572)) OR col1 > 635.39);

SELECT pk, col0 FROM view_1_tab3_631;

SELECT pk, col0 FROM view_2_tab4_632;

SELECT pk, col0 FROM tab0 WHERE col3 < 934 AND col4 < 836.19 AND ((col3 > 574)) AND col0 > 647 OR ((col3 <= 548)) UNION ALL SELECT pk, col0 FROM tab0 WHERE NOT (col3 < 934 AND col4 < 836.19 AND ((col3 > 574)) AND col0 > 647 OR ((col3 <= 548)));

SELECT pk, col0 FROM view_1_tab1_635 UNION ALL SELECT pk, col0 FROM view_2_tab1_635;

SELECT pk, col0 FROM tab2 WHERE col4 >= 838.84 OR col0 > 864 UNION SELECT pk, col0 FROM tab2 WHERE NOT (col4 >= 838.84 OR col0 > 864);

SELECT pk, col0 FROM view_1_tab3_637 UNION SELECT pk, col0 FROM view_2_tab3_637;

SELECT pk FROM ( SELECT pk, col0 FROM tab4 WHERE col0 <= 632 AND (col0 > 947) AND col0 < 824 AND ((col3 > 207) OR ((col0 < 913))) ) AS tab4_638;

SELECT * FROM view_3_tab0_641;

SELECT pk FROM tab1 WHERE col0 <= 213;

DROP VIEW view_1_tab2_643;

DROP VIEW view_2_tab3_644;

DROP VIEW view_3_tab4_645;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab1_647') DROP VIEW view_1_tab1_647;

DROP VIEW IF EXISTS view_1_tab2_648;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab3_649') DROP VIEW view_2_tab3_649;

DROP VIEW IF EXISTS view_2_tab4_650;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab0_652') DROP VIEW view_3_tab0_652;

DROP VIEW IF EXISTS view_3_tab1_653;

CREATE VIEW view_1_tab2_654 AS SELECT pk, col0 FROM tab2 WHERE col3 < 766 OR col4 >= 95.44;

CREATE VIEW view_2_tab3_655 AS SELECT pk, col0 FROM tab3 WHERE NOT (col0 > 298);

CREATE VIEW view_3_tab4_656 AS SELECT pk FROM view_1_tab4_656;

SELECT pk, col0 FROM tab0 WHERE col3 > 930;

SELECT pk, col0 FROM tab1 WHERE NOT (((col0 >= 575)));

INSERT INTO tab0 VALUES(57,527,84.24,'pnser',327,47.34,'bpxul');

DROP VIEW view_1_tab3_798;

DROP VIEW view_2_tab4_799;

DROP VIEW view_3_tab0_801;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab2_802') DROP VIEW view_1_tab2_802;

DROP VIEW IF EXISTS view_1_tab3_803;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab4_804') DROP VIEW view_2_tab4_804;

DROP VIEW IF EXISTS view_2_tab0_806;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab1_807') DROP VIEW view_3_tab1_807;

DROP VIEW IF EXISTS view_3_tab2_808;

CREATE VIEW view_1_tab3_810 AS SELECT pk, col0 FROM tab3 WHERE ((col3 < 745 AND col1 >= 529.81 OR col1 > 630.95 OR (col3 <= 912) OR col3 > 347 AND col1 BETWEEN 300.31 AND 315.36 AND col0 < 165 AND (col0 < 348) AND (col4 >= 792.27) OR col3 = 791 OR (col4 IS NULL)) AND (col0 IS NULL) OR col0 >= 389);

CREATE VIEW view_2_tab4_811 AS SELECT pk, col0 FROM tab4 WHERE NOT ((col3 <= 515 AND (((col3 IN (25,177,820,947,826,625) OR col1 >= 765.0 AND (col3 > 529) OR col0 > 185 OR ((col3 >= 232 OR (col0 IS NULL)))) AND (((col0 < 904) OR col0 > 850 AND col0 < 967) AND col0 > 111) AND (((col0 >= 284))))) OR col3 > 206) OR ((col0 <= 824) AND (col3 >= 441)) AND (((col4 = 857.8))) OR (((col4 <= 104.32 OR col1 IS NULL))) OR col0 < 569 OR col1 > 235.47 AND ((col0 >= 555) OR col3 < 586 AND col3 > 450 AND ((col1 <= 868.0 OR col4 > 817.49)) AND col0 <= 749 AND ((col0 < 685 AND (col3 < 5) AND col3 >= 82 OR col0 < 434 OR (col0 > 552) AND col4 < 148.58 OR col0 = 277 AND col3 IS NULL AND (((col3 BETWEEN 841 AND 145 OR col0 IS NULL OR col1 >= 235.0))) AND col1 > 917.90 OR (((col1 >= 981.81) AND col0 > 786))) OR col1 < 697.4 AND col3 = 550 OR col1 > 459.64 AND (col3 IN (968,528,218,911,440))) AND col3 IS NULL AND col0 < 314) AND ((col3 > 502)) OR (col0 > 148) AND col3 >= 676 AND ((((col0 < 118)))) AND (col0 > 971) OR ((col1 < 648.23 OR col3 > 882 AND col3 > 769 AND col0 < 997)) AND ((col1 IN (267.98,875.27,137.71) OR col3 <= 716) AND ((((col3 > 58) OR col4 <= 924.21))) AND col0 <= 291) OR (col3 = 727 AND (col0 BETWEEN 410 AND 352) AND col4 >= 832.88 OR col4 <= 951.21 AND col0 < 448 AND col3 <= 166 OR col3 >= 639) AND col1 > 670.21 AND col3 IN (917));

CREATE VIEW view_3_tab0_814 AS SELECT pk FROM view_1_tab0_814;

SELECT pk, col0 FROM tab1 WHERE col4 >= 54.81 AND (col0 < 14) AND (col3 IS NULL OR (col1 > 729.12 AND (col3 < 655 AND col3 IS NULL)) OR col3 < 898) AND col0 >= 977;

SELECT pk, col0 FROM tab2 WHERE NOT (col0 BETWEEN 404 AND 372);

SELECT pk, col0 FROM view_1_tab3_817;

SELECT pk, col0 FROM view_2_tab4_818;

SELECT pk, col0 FROM tab0 WHERE col3 < 234 AND ((col3 >= 356) AND col4 > 37.42 OR (col1 > 221.55) OR col4 > 828.6) UNION ALL SELECT pk, col0 FROM tab0 WHERE NOT (col3 < 234 AND ((col3 >= 356) AND col4 > 37.42 OR (col1 > 221.55) OR col4 > 828.6));

SELECT pk, col0 FROM view_1_tab1_821 UNION ALL SELECT pk, col0 FROM view_2_tab1_821;

SELECT pk, col0 FROM tab2 WHERE col3 <= 656 UNION SELECT pk, col0 FROM tab2 WHERE NOT (col3 <= 656);

SELECT pk, col0 FROM view_1_tab3_823 UNION SELECT pk, col0 FROM view_2_tab3_823;

SELECT pk FROM ( SELECT pk, col0 FROM tab4 WHERE (col1 >= 499.38 AND col4 >= 64.68) ) AS tab4_824;

SELECT * FROM view_3_tab0_826;

SELECT pk FROM tab1 WHERE col0 < 914 AND col1 < 446.23;

DROP VIEW view_1_tab2_828;

DROP VIEW view_2_tab3_829;

DROP VIEW view_3_tab4_830;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab1_832') DROP VIEW view_1_tab1_832;

DROP VIEW IF EXISTS view_1_tab2_833;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab3_834') DROP VIEW view_2_tab3_834;

DROP VIEW IF EXISTS view_2_tab4_835;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab0_837') DROP VIEW view_3_tab0_837;

DROP VIEW IF EXISTS view_3_tab1_838;

CREATE VIEW view_1_tab2_839 AS SELECT pk, col0 FROM tab2 WHERE col1 = 987.33 OR ((col0 < 781 AND (col0 < 934 AND col3 IN (211,625,799)))) AND (col0 <= 459 AND col1 < 710.96);

CREATE VIEW view_2_tab3_840 AS SELECT pk, col0 FROM tab3 WHERE NOT (col3 > 761);

CREATE VIEW view_3_tab4_841 AS SELECT pk FROM view_1_tab4_841;

SELECT pk, col0 FROM tab0 WHERE col4 <= 776.29;

SELECT pk, col0 FROM tab1 WHERE NOT (col3 > 216 AND ((col3 >= 345)));

SELECT pk, col0 FROM view_1_tab2_845;

SELECT pk, col0 FROM view_2_tab3_846;

SELECT pk, col0 FROM tab4 WHERE col1 <= 772.59 UNION ALL SELECT pk, col0 FROM tab4 WHERE NOT (col1 <= 772.59);

SELECT pk, col0 FROM view_1_tab0_850 UNION ALL SELECT pk, col0 FROM view_2_tab0_850;

SELECT pk, col0 FROM tab1 WHERE ((col0 IN (710,284,533,621,126,972) OR ((col3 = 723)) AND col3 IS NULL AND ((col1 < 438.5 AND col1 > 795.30 OR col0 > 601 AND (col3 <= 972)) AND col0 >= 369) AND ((col0 >= 631)) AND col3 >= 961 AND col3 < 450 AND col1 = 591.94)) UNION SELECT pk, col0 FROM tab1 WHERE NOT (((col0 IN (710,284,533,621,126,972) OR ((col3 = 723)) AND col3 IS NULL AND ((col1 < 438.5 AND col1 > 795.30 OR col0 > 601 AND (col3 <= 972)) AND col0 >= 369) AND ((col0 >= 631)) AND col3 >= 961 AND col3 < 450 AND col1 = 591.94)));

SELECT pk, col0 FROM view_1_tab2_852 UNION SELECT pk, col0 FROM view_2_tab2_852;

SELECT pk FROM ( SELECT pk, col0 FROM tab3 WHERE ((col3 >= 580)) ) AS tab3_853;

SELECT * FROM view_3_tab4_854;

SELECT pk FROM tab0 WHERE (col3 = 847);

DROP VIEW view_1_tab1_858;

DROP VIEW view_2_tab2_859;

DROP VIEW view_3_tab3_860;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab0_862') DROP VIEW view_1_tab0_862;

DROP VIEW IF EXISTS view_1_tab1_863;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab2_864') DROP VIEW view_2_tab2_864;

DROP VIEW IF EXISTS view_2_tab3_865;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab4_866') DROP VIEW view_3_tab4_866;

DROP VIEW IF EXISTS view_3_tab0_868;

CREATE VIEW view_1_tab1_869 AS SELECT pk, col0 FROM tab1 WHERE (((col0 > 796 OR ((((col0 < 642)) AND (((((col1 < 435.47 AND col0 = 220)) AND (col0 > 695) AND col3 > 66 AND (col4 > 262.50))) OR col0 > 828 AND ((col0 >= 606 AND col1 <= 821.18)) OR (col0 > 561) AND col4 < 21.23 OR col0 <= 506 AND col3 = 647 AND (((col3 < 600) OR col4 >= 381.63) AND col3 < 685)))) AND ((((col3 > 693 AND ((col1 > 86.26) OR col3 <= 633 OR (col1 > 453.63)) AND col0 <= 685 AND col0 >= 283)) AND (col3 IN (SELECT col0 FROM tab1 WHERE col3 > 326)) OR col3 >= 867 AND col4 = 806.41 AND (col3 < 145)) OR (col4 >= 417.94) AND col0 BETWEEN 227 AND 570) AND ((((col4 > 907.48)))) OR col4 BETWEEN 177.84 AND 289.37 OR (col3 <= 136) OR ((col3 IN (130,69,508,303,449,320))) OR (col3 = 929) OR (col0 <= 169) AND col1 < 968.44 AND (col3 > 353 AND col3 <= 894 OR ((col0 > 57) AND col3 = 981 OR col3 >= 800 AND col0 IN (61,974,624,210,227,193) AND col1 = 547.18 AND ((col3 < 735 AND col4 >= 544.20))) OR col3 = 801 AND col3 > 236 AND ((((col3 < 778 OR (col0 < 528) OR col1 >= 826.57)))) OR (col4 IS NULL) AND col3 IN (169,105,122,265) OR col3 >= 318 OR col3 < 55 AND col3 >= 6 OR (col0 < 319) OR col3 = 459 AND ((col3 < 236)) AND col1 IS NULL AND ((col4 <= 213.11)))) OR ((col3 IS NULL))));

INSERT INTO tab0 VALUES(53,588,993.72,'ourid',967,760.73,'qjpci');

SELECT * FROM view_3_tab3_870;

SELECT pk FROM tab4 WHERE (col3 > 439) AND col3 > 529;

DROP VIEW view_1_tab0_873;

DROP VIEW view_2_tab1_874;

DROP VIEW view_3_tab2_875;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab4_876') DROP VIEW view_1_tab4_876;

DROP VIEW IF EXISTS view_1_tab0_879;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab1_880') DROP VIEW view_2_tab1_880;

DROP VIEW IF EXISTS view_2_tab2_881;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab3_882') DROP VIEW view_3_tab3_882;

DROP VIEW IF EXISTS view_3_tab4_883;

CREATE VIEW view_1_tab0_885 AS SELECT pk, col0 FROM tab0 WHERE col3 < 419;

CREATE VIEW view_2_tab1_886 AS SELECT pk, col0 FROM tab1 WHERE NOT (col1 < 85.65 OR col0 <= 401 AND col1 > 37.94 OR (col3 < 42));

CREATE VIEW view_3_tab2_887 AS SELECT pk FROM view_1_tab2_887;

SELECT pk, col0 FROM tab3 WHERE col0 >= 192;

SELECT pk, col0 FROM tab4 WHERE NOT ((col0 < 813) AND col0 < 594 AND (col4 > 398.52) OR (col4 <= 200.26));

SELECT pk, col0 FROM view_1_tab0_891;

SELECT pk, col0 FROM view_2_tab1_892;

SELECT pk, col0 FROM tab2 WHERE ((((col0 = 348 OR (col3 >= 649 AND (col4 = 215.89)) OR col3 > 336) AND col0 <= 792 AND col3 = 283)) AND col3 >= 109 AND (col3 <= 499) OR (col3 > 68) OR (col0 IN (741,45,659,642,505))) UNION ALL SELECT pk, col0 FROM tab2 WHERE NOT (((((col0 = 348 OR (col3 >= 649 AND (col4 = 215.89)) OR col3 > 336) AND col0 <= 792 AND col3 = 283)) AND col3 >= 109 AND (col3 <= 499) OR (col3 > 68) OR (col0 IN (741,45,659,642,505))));

SELECT pk, col0 FROM view_1_tab3_894 UNION ALL SELECT pk, col0 FROM view_2_tab3_894;

SELECT pk, col0 FROM tab4 WHERE (col0 < 625) UNION SELECT pk, col0 FROM tab4 WHERE NOT ((col0 < 625));

SELECT pk, col0 FROM view_1_tab0_897 UNION SELECT pk, col0 FROM view_2_tab0_897;

SELECT pk FROM ( SELECT pk, col0 FROM tab1 WHERE (col0 > 830) ) AS tab1_898;

SELECT * FROM view_3_tab2_899;

SELECT pk FROM tab3 WHERE col4 > 857.31;

DROP VIEW view_1_tab4_901;

DROP VIEW view_2_tab0_903;

DROP VIEW view_3_tab1_904;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab3_905') DROP VIEW view_1_tab3_905;

DROP VIEW IF EXISTS view_1_tab4_906;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab0_908') DROP VIEW view_2_tab0_908;

DROP VIEW IF EXISTS view_2_tab1_909;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab2_910') DROP VIEW view_3_tab2_910;

DROP VIEW IF EXISTS view_3_tab3_911;

CREATE VIEW view_1_tab4_912 AS SELECT pk, col0 FROM tab4 WHERE (col4 >= 519.79 AND (col3 BETWEEN 191 AND 743 AND col1 > 917.4 AND col3 < 182) AND col0 IS NULL AND col3 < 501 OR col4 > 142.27 AND col4 >= 575.10 OR ((col3 = 268 OR col3 > 9 AND col3 > 108 AND (col4 > 12.90 AND (((col3 IN (214,449,447,353,412,967))) OR col3 > 415 AND col4 >= 677.63 AND col0 >= 152 AND (col1 > 503.18 OR ((col4 >= 922.77 OR col3 >= 542)) AND col3 > 299)) OR col4 > 920.36 AND (col3 IN (796)) AND col3 > 902 OR (col1 IN (738.37,932.58,876.90,489.75)) AND (((col1 >= 366.53))) AND col1 <= 742.34) AND (col3 >= 760) AND ((col3 IN (501,468) OR (col4 > 279.22 AND (col3 >= 615) AND ((col4 >= 84.56)) AND col0 >= 893 OR col3 < 487))) OR ((((col0 > 795) OR col3 <= 617))) AND ((col0 > 932)))));

CREATE VIEW view_2_tab0_915 AS SELECT pk, col0 FROM tab0 WHERE NOT ((col1 < 475.85) AND col4 >= 839.81 AND col0 IN (310,914,625) OR col0 >= 720 AND (col0 > 345) OR col4 < 958.31);

CREATE VIEW view_3_tab1_916 AS SELECT pk FROM view_1_tab1_916;

SELECT pk, col0 FROM tab2 WHERE col3 < 292;

SELECT pk, col0 FROM tab3 WHERE NOT ((col1 > 862.52));

SELECT pk, col0 FROM view_1_tab4_920;

SELECT pk, col0 FROM view_2_tab0_922;

SELECT pk, col0 FROM tab1 WHERE col3 >= 981 UNION ALL SELECT pk, col0 FROM tab1 WHERE NOT (col3 >= 981);

SELECT pk, col0 FROM view_1_tab2_924 UNION ALL SELECT pk, col0 FROM view_2_tab2_924;

SELECT pk, col0 FROM tab3 WHERE col1 < 792.60 UNION SELECT pk, col0 FROM tab3 WHERE NOT (col1 < 792.60);

SELECT pk, col0 FROM view_1_tab4_926 UNION SELECT pk, col0 FROM view_2_tab4_926;

SELECT pk FROM ( SELECT pk, col0 FROM tab0 WHERE col4 IN (402.10,610.41,438.86,448.19,101.25) ) AS tab0_928;

SELECT * FROM view_3_tab1_929;

SELECT pk FROM tab2 WHERE col4 < 943.67;

DROP VIEW view_1_tab3_931;

DROP VIEW view_2_tab4_932;

DROP VIEW view_3_tab0_934;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab2_935') DROP VIEW view_1_tab2_935;

DROP VIEW IF EXISTS view_1_tab3_936;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab4_938') DROP VIEW view_2_tab4_938;

DROP VIEW IF EXISTS view_2_tab0_940;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab1_941') DROP VIEW view_3_tab1_941;

DROP VIEW IF EXISTS view_3_tab2_942;

CREATE VIEW view_1_tab3_943 AS SELECT pk, col0 FROM tab3 WHERE ((col3 >= 982)) OR (col0 > 522);

CREATE VIEW view_2_tab4_944 AS SELECT pk, col0 FROM tab4 WHERE NOT (col1 < 588.74 AND ((((col4 = 278.77 AND col4 < 697.53) AND (col3 > 257)))) OR col0 IN (163,321,381));

INSERT INTO tab0 VALUES(8,8463,7397.19,'typda',4917,1654.53,'shlyo');

INSERT INTO tab0 VALUES(147,4338,3130.89,'clwqw',7908,8919.66,'wwxtx');

INSERT INTO tab0 VALUES(286,1302,5256.28,'bnsmq',7731,1123.18,'tbluv');

INSERT INTO tab0 VALUES(425,2307,7092.70,'plvdz',7763,323.81,'dqpfd');

INSERT INTO tab0 VALUES(564,9862,3307.10,'uxymz',4055,551.69,'qzxhr');

INSERT INTO tab0 VALUES(703,4776,3663.89,'kwalf',4085,1561.23,'xahfg');

INSERT INTO tab0 VALUES(842,4907,6774.84,'ehqai',5507,2582.2,'fehyj');

INSERT INTO tab0 VALUES(981,3913,3847.92,'agmzg',4900,6062.66,'sasgk');

DROP VIEW view_2_tab4_737;

DROP VIEW view_3_tab0_740;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab2_741') DROP VIEW view_1_tab2_741;

DROP VIEW IF EXISTS view_1_tab3_742;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab4_743') DROP VIEW view_2_tab4_743;

DROP VIEW IF EXISTS view_2_tab0_745;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab1_746') DROP VIEW view_3_tab1_746;

DROP VIEW IF EXISTS view_3_tab2_747;

CREATE VIEW view_1_tab3_748 AS SELECT pk, col0 FROM tab3 WHERE col3 >= 4479 OR col3 <= 9248 OR (col0 IS NULL);

CREATE VIEW view_2_tab4_749 AS SELECT pk, col0 FROM tab4 WHERE NOT ((col3 > 2858));

CREATE VIEW view_3_tab0_751 AS SELECT pk FROM view_1_tab0_751;

SELECT pk, col0 FROM tab1 WHERE col3 = 7888;

SELECT pk, col0 FROM tab2 WHERE NOT ((((((col0 < 94))))));

SELECT pk, col0 FROM view_1_tab3_754;

SELECT pk, col0 FROM view_2_tab4_755;

SELECT pk, col0 FROM tab0 WHERE col3 > 8150 UNION ALL SELECT pk, col0 FROM tab0 WHERE NOT (col3 > 8150);

SELECT pk, col0 FROM view_1_tab1_758 UNION ALL SELECT pk, col0 FROM view_2_tab1_758;

SELECT pk, col0 FROM tab2 WHERE col3 = 7402 UNION SELECT pk, col0 FROM tab2 WHERE NOT (col3 = 7402);

SELECT pk, col0 FROM view_1_tab3_760 UNION SELECT pk, col0 FROM view_2_tab3_760;

SELECT pk FROM ( SELECT pk, col0 FROM tab4 WHERE col0 > 7359 ) AS tab4_761;

SELECT * FROM view_3_tab0_763;

SELECT pk FROM tab1 WHERE (col0 < 6636);

DROP VIEW view_1_tab2_765;

DROP VIEW view_2_tab3_766;

DROP VIEW view_3_tab4_767;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_1_tab1_769') DROP VIEW view_1_tab1_769;

DROP VIEW IF EXISTS view_1_tab2_770;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab3_771') DROP VIEW view_2_tab3_771;

DROP VIEW IF EXISTS view_2_tab4_772;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab0_774') DROP VIEW view_3_tab0_774;

DROP VIEW IF EXISTS view_3_tab1_775;

CREATE VIEW view_1_tab2_776 AS SELECT pk, col0 FROM tab2 WHERE (col1 < 8775.46 AND col0 < 2151) OR col4 = 2911.36 AND col0 < 2063 OR col0 > 6911;

CREATE VIEW view_2_tab3_778 AS SELECT pk, col0 FROM tab3 WHERE NOT (col3 >= 2704 OR col3 >= 413);

CREATE VIEW view_3_tab4_779 AS SELECT pk FROM view_1_tab4_779;

SELECT pk, col0 FROM tab0 WHERE col1 = 7089.83;

SELECT pk, col0 FROM tab1 WHERE NOT ((((col0 IN (5925,9789)) AND (col1 <= 5378.37 AND col0 IS NULL) AND (col0 < 2689)) OR col1 <= 5556.3 AND col3 <= 7971 OR col3 > 5189 AND col0 > 7 AND ((col1 > 5103.31)) OR col0 < 630 AND (((col0 <= 2635) OR col3 = 7624 AND ((((col0 IN (6163,2022,4720,9473,670) AND ((((((col0 < 298 OR (col4 > 9327.60))) AND ((col3 >= 2809))) AND ((col3 <= 1547)) OR (col4 < 8374.94) AND (((col0 > 6645 AND (col4 > 2874.0) AND col1 > 740.39 OR (col0 > 5035) AND col0 >= 5207 AND col3 <= 7098)) AND ((col3 IS NULL)))) AND col0 >= 6016 OR ((col0 IS NULL) AND col4 >= 5611.20) AND (col3 < 6387)))) OR (col3 > 4109))) AND col0 < 1737 OR (((col3 = 9884)))) AND col0 > 3647 AND ((((((((col4 > 6152.55)))))) AND (col0 <= 6441 OR col0 > 6481) AND (((col3 < 7932))) AND col0 > 9467)) AND col4 IN (4407.9,1177.3,6814.27,6241.37,9284.25) AND col0 BETWEEN 1184 AND 4256 AND col0 >= 5560) OR (col3 > 4591 AND (col0 <= 753) OR ((col0 > 1641 OR (col3 >= 2723) OR (col3 < 9191) OR col3 = 498 AND (col0 <= 2766) AND ((col3 < 4235) OR col0 IS NULL AND (col3 <= 2910 AND col4 > 8399.49)) AND (((col0 < 6421 AND col0 >= 5298 AND ((col4 <= 8878.68 OR (col0 >= 3739) AND col0 < 3211 OR col4 IN (948.73,9156.77) AND col0 = 5654 OR col4 > 5805.68 AND col4 < 8049.91 AND col1 >= 2357.25 AND col1 IN (7807.46,9265.52,6202.37,7062.8) AND (col0 > 26) OR col0 >= 9595 OR col0 >= 2506 AND (col1 < 5842.19) AND col1 <= 1777.93 OR (col3 >= 5739)))))) OR col0 < 8050)) OR col3 > 1442)) OR ((col0 < 703 OR (col4 >= 8775.3) OR col1 < 9606.76 OR (col3 < 2186) OR col3 IS NULL) OR col1 > 5475.35)) AND col0 < 4571 AND col3 < 7485);

SELECT pk, col0 FROM view_1_tab2_783;

SELECT pk, col0 FROM view_2_tab3_784;

SELECT pk, col0 FROM tab4 WHERE col0 < 3061 OR col0 <= 3225 UNION ALL SELECT pk, col0 FROM tab4 WHERE NOT (col0 < 3061 OR col0 <= 3225);

SELECT pk, col0 FROM view_1_tab0_787 UNION ALL SELECT pk, col0 FROM view_2_tab0_787;

SELECT pk, col0 FROM tab1 WHERE col3 < 7244 UNION SELECT pk, col0 FROM tab1 WHERE NOT (col3 < 7244);

SELECT pk, col0 FROM view_1_tab2_790 UNION SELECT pk, col0 FROM view_2_tab2_790;

SELECT pk FROM ( SELECT pk, col0 FROM tab3 WHERE col0 > 8958 ) AS tab3_791;

SELECT * FROM view_3_tab4_792;

SELECT pk FROM tab0 WHERE col0 > 8362;

DROP VIEW view_1_tab1_795;

DROP VIEW view_2_tab2_796;

DROP VIEW view_3_tab3_797;

INSERT INTO tab0 VALUES(115,15960,43569.81,'yvduy',69659,23266.43,'hdmbc');

INSERT INTO tab0 VALUES(254,27032,85922.39,'hnpfs',89486,86679.71,'ihxjt');

INSERT INTO tab0 VALUES(393,30300,37658.60,'mahol',20117,73992.8,'djcbq');

INSERT INTO tab0 VALUES(532,70446,61630.67,'oxydp',47137,25305.44,'tdkrk');

INSERT INTO tab0 VALUES(671,20462,35726.34,'aropj',65713,51998.53,'szyni');

INSERT INTO tab0 VALUES(810,69165,90380.80,'aqqzw',68075,74252.85,'ebxow');

INSERT INTO tab0 VALUES(949,8685,46057.51,'vuqnp',31033,58526.49,'qwafu');

INSERT INTO tab0 VALUES(1088,21984,50762.15,'gsiow',3454,55081.5,'alvit');

INSERT INTO tab0 VALUES(1227,70336,17544.41,'vkdhb',93786,35452.47,'ezfbr');

INSERT INTO tab0 VALUES(1366,80841,61990.92,'lfowe',57540,29971.92,'iupqy');

INSERT INTO tab0 VALUES(1505,33908,39721.9,'nqobz',84808,65264.72,'gglky');

INSERT INTO tab0 VALUES(1644,50781,83898.4,'ngwho',87738,1736.13,'xomlj');

INSERT INTO tab0 VALUES(1783,81018,42733.41,'eojjp',88058,71084.31,'msiup');

INSERT INTO tab0 VALUES(1922,89990,16958.26,'ayolw',4565,13803.13,'dhqyd');

INSERT INTO tab0 VALUES(2061,46401,97357.98,'qjwxk',40621,16662.8,'bkobw');

INSERT INTO tab0 VALUES(2200,9768,2252.10,'ckzfd',71670,50231.14,'cndqo');

INSERT INTO tab0 VALUES(2339,17930,14999.22,'kdhta',32711,6365.64,'xkrjc');

INSERT INTO tab0 VALUES(2478,74545,21496.85,'rwgup',5825,35705.17,'nxagb');

INSERT INTO tab0 VALUES(2617,36590,47680.31,'rdtgf',7656,85186.40,'ovcdv');

INSERT INTO tab0 VALUES(2756,1870,97030.59,'fonro',76925,35531.2,'tydwf');

INSERT INTO tab0 VALUES(2895,96505,88058.23,'ipjax',61923,38748.54,'ftear');

INSERT INTO tab0 VALUES(3034,62429,91818.19,'xrtpn',7998,55639.25,'vjivu');

INSERT INTO tab0 VALUES(3173,44909,69403.73,'vuaxe',45089,93295.2,'tkfan');

INSERT INTO tab0 VALUES(3312,80023,9445.28,'oowof',75192,42590.22,'mwhsr');

INSERT INTO tab0 VALUES(3451,82175,65618.34,'izqcg',59872,15699.58,'qyijh');

INSERT INTO tab0 VALUES(3590,31579,94128.30,'qlswj',7772,83569.6,'bcrmy');

INSERT INTO tab0 VALUES(3729,61785,91229.37,'qnxao',62100,13449.75,'dqqqe');

INSERT INTO tab0 VALUES(3868,47155,30709.43,'ityea',88140,6378.69,'mvygv');

INSERT INTO tab0 VALUES(4007,90365,1393.92,'etolq',60739,34674.83,'arbpl');

INSERT INTO tab0 VALUES(4146,9924,44644.68,'jvfhh',51818,79449.81,'mvonr');

INSERT INTO tab0 VALUES(4285,27652,91876.87,'dcejf',17871,68113.92,'ujnkp');

INSERT INTO tab0 VALUES(4424,56192,2029.81,'gcbkl',87454,11846.90,'jwwab');

INSERT INTO tab0 VALUES(4563,86511,99087.88,'gxfcd',48706,43136.87,'pcuke');

INSERT INTO tab0 VALUES(4702,75387,9576.36,'ayyyy',36822,53247.20,'cwctp');

INSERT INTO tab0 VALUES(4841,32931,51.37,'zsbel',21579,29742.35,'fdpgy');

INSERT INTO tab0 VALUES(4980,10067,14620.68,'nxeqk',94815,93963.78,'hqkae');

INSERT INTO tab0 VALUES(5119,86035,12420.59,'kzanh',57949,38546.79,'dxmxx');

INSERT INTO tab0 VALUES(5258,55905,5130.85,'ckzlo',9460,64923.43,'gbwku');

INSERT INTO tab0 VALUES(5397,18061,94470.52,'ffifa',32403,20800.38,'luapa');

INSERT INTO tab0 VALUES(5536,61710,9692.79,'wapri',81901,37683.78,'xckvp');

INSERT INTO tab0 VALUES(5675,54373,45098.94,'xybrd',72650,68368.14,'xhpuq');

INSERT INTO tab0 VALUES(5814,29403,97521.16,'niawt',66412,24432.21,'wsxjx');

INSERT INTO tab0 VALUES(5953,73464,3836.44,'lugqh',59524,13749.84,'yvnjb');

INSERT INTO tab0 VALUES(6092,14048,78458.42,'lxgxc',70392,77975.87,'jwdme');

INSERT INTO tab0 VALUES(6231,6954,50833.34,'phubg',26986,30059.2,'rxbhw');

INSERT INTO tab0 VALUES(6370,23815,2960.81,'tjewt',54357,91741.72,'iqtwa');

INSERT INTO tab0 VALUES(6509,39578,6866.77,'teofa',62122,31048.3,'vdhyu');

INSERT INTO tab0 VALUES(6648,20010,62121.34,'bjnef',31964,99792.49,'hzkng');

INSERT INTO tab0 VALUES(6787,9204,33338.65,'xagrr',5142,71081.99,'tahzq');

INSERT INTO tab0 VALUES(6926,17065,87655.80,'tpanf',69979,76809.68,'mcott');

INSERT INTO tab0 VALUES(7065,6826,32269.67,'sqnfn',49377,45157.80,'nezhl');

INSERT INTO tab0 VALUES(7204,82531,51901.79,'vugwo',88302,38101.59,'vapas');

INSERT INTO tab0 VALUES(7343,76557,46317.28,'orxzy',41290,88894.14,'wggcj');

INSERT INTO tab0 VALUES(7482,37089,67822.66,'zrtlh',59955,39596.28,'vywgg');

INSERT INTO tab0 VALUES(7621,15638,58755.75,'kxxio',80468,78540.47,'cwvvt');

INSERT INTO tab0 VALUES(7760,54538,89004.55,'nbwuo',11083,77856.62,'qbnnx');

INSERT INTO tab0 VALUES(7899,74438,93487.11,'xevyd',19619,30963.3,'hukgb');

INSERT INTO tab0 VALUES(8038,61810,9667.39,'ksyss',20963,90067.23,'enrfd');

INSERT INTO tab0 VALUES(8177,56449,15039.17,'khyun',64575,3660.86,'crnlz');

INSERT INTO tab0 VALUES(8316,38958,64645.89,'hnfie',21987,54025.54,'wpkas');

INSERT INTO tab0 VALUES(8455,18280,28562.53,'vblcu',74301,94745.75,'virrg');

INSERT INTO tab0 VALUES(8594,19161,29403.52,'mjuap',99682,88174.73,'ypqxm');

INSERT INTO tab0 VALUES(8733,69680,79828.56,'vmkie',60880,42968.30,'mnfov');

INSERT INTO tab0 VALUES(8872,88726,20028.55,'xcrju',92698,51568.79,'etecm');

INSERT INTO tab0 VALUES(9011,73514,55242.43,'qjujz',89521,27700.88,'sbmaw');

INSERT INTO tab0 VALUES(9150,87075,93241.4,'erwjr',92797,43887.48,'blucy');

INSERT INTO tab0 VALUES(9289,45770,81832.6,'gsnft',78555,68936.62,'vvrdp');

INSERT INTO tab0 VALUES(9428,6765,46372.82,'ocegj',44888,5443.33,'rbcud');

INSERT INTO tab0 VALUES(9567,55563,27251.19,'enkgf',99450,27294.48,'trvll');

INSERT INTO tab0 VALUES(9706,93480,17388.49,'yjjlc',46984,17163.67,'wyrep');

INSERT INTO tab0 VALUES(9845,25140,99765.31,'sucde',76788,4019.15,'doaoz');

INSERT INTO tab0 VALUES(9984,46011,84881.44,'ymbui',50241,610.61,'bpaqz');

DROP VIEW IF EXISTS view_1_tab0_2;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_2_tab1_3') DROP VIEW view_2_tab1_3;

DROP VIEW IF EXISTS view_2_tab2_4;

IF EXISTS (SELECT TABLE_NAME FROM INFORMATION_SCHEMA.VIEWS WHERE TABLE_NAME = 'view_3_tab3_5') DROP VIEW view_3_tab3_5;

DROP VIEW IF EXISTS view_3_tab4_6;
