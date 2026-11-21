CREATE TABLE tab0(pk INTEGER PRIMARY KEY, col0 INTEGER, col1 FLOAT, col2 TEXT, col3 INTEGER, col4 FLOAT, col5 TEXT);

SELECT pk FROM tab2 WHERE col0 > 4;

SELECT pk FROM tab0 WHERE ((col0 < 0));

CREATE UNIQUE INDEX idx_tab2_0 ON tab2 (col4 DESC);

SELECT pk FROM tab4 WHERE NOT (col3 <= 1);

SELECT pk FROM tab4 WHERE col3 <= 1 OR ((col3 < 5 OR (col3 IS NULL))) AND ((col0 >= 8)) AND (col0 = 9 AND (((col3 < 9 AND (col4 > 7.18 AND col3 > 3))) AND col3 = 3 AND col0 < 1)) OR col3 IN (3,9,6,8,4) AND (col0 > 1);

SELECT pk FROM tab0 WHERE NOT ((col0 IS NULL));

SELECT pk FROM tab4 WHERE NOT (((col1 BETWEEN 6.74 AND 9.38) AND (col3 = 9)));

CREATE INDEX idx_tab2_5 ON tab2 (col1 DESC,col0);

SELECT pk FROM tab0 WHERE NOT (col0 < 3);

SELECT pk FROM tab2 WHERE col1 < 3.65 OR col3 < 2 AND (((col3 BETWEEN 9 AND 0) AND col3 > 4) OR col1 BETWEEN 5.59 AND 6.81);

DELETE FROM tab3 WHERE ((col4 > 4.29 OR col3 > 9 OR (col0 IS NULL) OR (col0 > 3))) OR col0 >= 3;

SELECT pk FROM tab3 WHERE col0 IN (5,7,4,8,8,4);

SELECT pk FROM tab3 WHERE col3 = 3 AND ((col1 <= 3.82)) OR col4 < 5.42;

CREATE INDEX idx_tab2_2 ON tab2 (col0,col1 DESC);

DELETE FROM tab3 WHERE ((col0 < 4 OR (col3 >= 6) AND ((col3 >= 2 OR col4 <= 8.4))));

SELECT pk FROM tab0 WHERE (col3 IN (2,3,4));

SELECT pk FROM tab2 WHERE NOT (col4 > 0.94);

SELECT pk FROM tab2 WHERE ((col3 <= 6));

DELETE FROM tab1 WHERE ((col4 > 9.0));

SELECT pk FROM tab3 WHERE col3 IN (7,1,4,7) AND (col1 = 1.21) AND col4 IN (9.51,4.74,3.92,1.83,1.59,0.99) AND (col3 <= 2 OR ((col1 < 7.31)));

SELECT pk FROM tab0 WHERE NOT (col4 IN (7.62,9.1,4.10,1.38));

SELECT pk FROM tab4 WHERE col4 > 3.94;

SELECT pk FROM tab1 WHERE col1 IS NULL AND (col3 < 7) AND col4 < 8.3;

CREATE UNIQUE INDEX idx_tab3_5 ON tab3 (col1);

SELECT pk FROM tab0 WHERE col0 >= 3;

SELECT pk FROM tab3 WHERE col1 >= 1.74;

SELECT pk FROM tab1 WHERE NOT ((col3 <= 4));

SELECT pk FROM tab1 WHERE NOT ((col1 < 4.78 OR (col4 <= 5.34) AND col3 <= 9 OR col3 BETWEEN 3 AND 8 OR (col3 < 9 OR col3 = 9 AND (col1 < 3.69 AND (col3 = 2) OR (col0 <= 0 AND col3 < 3 OR col0 < 8 AND col1 = 0.93)) OR col4 > 1.98 AND col0 < 8 AND (((col3 IS NULL) AND col3 >= 0) AND (col4 >= 6.14) OR col0 > 3 OR col0 > 9 OR (col0 < 9) AND col4 < 2.27 OR col4 < 0.57 AND col1 BETWEEN 3.69 AND 4.51) AND col0 <= 2)) AND (col1 BETWEEN 7.16 AND 9.49) OR (col4 IN (3.84,1.31,1.90,7.12,9.42) OR col0 BETWEEN 6 AND 2 AND (col3 <= 4)));

SELECT pk FROM tab4 WHERE NOT (col0 < 7 AND col1 < 9.55 AND ((col3 >= 9 AND (col4 > 9.53 AND col1 = 0.93 OR (col3 IS NULL AND ((col4 <= 7.72) OR col0 > 6 AND (col3 > 4) AND col1 > 3.68 AND (col1 = 7.94) AND col0 IN (9,2)) AND (col0 > 0 OR col0 IS NULL)) AND ((col3 < 8)) AND (((col1 < 0.59 OR (col1 >= 6.25 AND (col0 >= 1 AND col3 < 6)))) OR col4 = 5.21 OR col1 < 7.56) AND col0 <= 8 AND col3 > 1 AND (((col3 <= 8)) OR col0 <= 1 OR col3 > 8 OR col3 < 0 AND col1 BETWEEN 7.50 AND 3.16 AND (col0 IS NULL AND ((col0 > 7)) AND (col0 > 1) OR col3 >= 6 AND col0 < 6) AND col3 <= 7) OR ((((col3 < 0)) AND col4 < 1.34 OR col4 > 6.7 AND ((((((col3 > 4)) AND (col0 IS NULL) OR col3 < 0) AND ((col1 > 8.92) OR col3 >= 3 AND col3 > 9 AND col4 < 6.81 AND col4 >= 3.40 AND (col3 > 1 OR col1 < 2.80 AND ((col1 >= 8.54 OR col4 >= 7.58 AND col3 > 1 OR col3 IS NULL AND (col1 IN (7.80,9.42,9.44,7.23,2.68,8.23)) OR col3 IS NULL AND ((col0 IS NULL)) OR col3 > 0 AND col1 <= 0.39)) OR col0 > 2) AND (((col3 < 2 AND col4 < 9.36)))))) AND (((col1 = 9.85))) OR col1 IN (9.39,5.89)) AND col4 >= 9.37 AND col0 > 1 AND col3 <= 1 AND col1 = 2.15) AND (((col3 <= 0)) AND col0 = 1)) OR (((col0 > 6) AND (col3 IN (6,3,9)) AND col0 > 6 OR col0 > 0 AND ((col0 IN (1))) AND (((col0 < 5) OR ((col0 < 3))) AND col3 = 7 OR (col0 >= 3)))))) AND ((col3 >= 2)) OR col3 < 9 AND (col0 < 7) OR (col3 BETWEEN 6 AND 3) OR col3 BETWEEN 8 AND 0 AND ((col0 > 0)) OR (col0 <= 7 OR col0 > 8) OR (col1 IN (2.81,1.98,4.8,8.71,3.26,6.99)) OR col3 > 7 OR col3 < 3 AND col1 >= 9.31 OR ((col3 > 6)) AND col4 < 7.51 AND col0 >= 9) AND (col0 > 0) AND col1 = 0.62 AND ((col3 < 6)) AND (col3 IN (1,0)) AND (col3 < 0) OR (col0 < 3));

DELETE FROM tab4 WHERE ((((col4 >= 6.79)) AND col0 < 5) AND col0 IS NULL AND col3 IS NULL AND (col0 > 2) AND (col0 <= 8) OR col4 >= 0.71);

SELECT pk FROM tab1 WHERE col4 < 3.3;

SELECT pk FROM tab1 WHERE NOT (col4 <= 5.8);

SELECT pk FROM tab3 WHERE col3 >= 9;

SELECT pk FROM tab3 WHERE NOT (col4 BETWEEN 5.80 AND 3.37);

DELETE FROM tab0 WHERE col0 > 9;

CREATE INDEX idx_tab2_1 ON tab2 (col1,col3);

CREATE UNIQUE INDEX idx_tab2_0 ON tab2 (col4,col0 DESC,col1);

SELECT pk FROM tab0 WHERE NOT (col0 IN (0,8,8,4,5,0) AND (col3 >= 0));

SELECT pk FROM tab2 WHERE NOT (col0 > 2);

DELETE FROM tab3 WHERE ((col0 > 6));

DELETE FROM tab0 WHERE col0 >= 4;

DELETE FROM tab2 WHERE (col1 = 3.90);

DELETE FROM tab2 WHERE col0 IN (0,8,5,8,6,7);

SELECT pk FROM tab3 WHERE NOT ((col1 <= 5.63) AND col3 IS NULL);

SELECT pk FROM tab4 WHERE col3 > 1 OR col4 >= 3.12;

DELETE FROM tab4 WHERE col0 > 7;

SELECT pk FROM tab3 WHERE col3 > 1;

SELECT pk FROM tab3 WHERE (col1 <= 5.71 AND col3 >= 2);

SELECT pk FROM tab4 WHERE (col3 <= 8) OR col0 < 3 AND ((col3 IN (0,5,8,4,1,1)));

SELECT pk FROM tab0 WHERE NOT ((col4 >= 4.72 OR col0 >= 7));

DELETE FROM tab4 WHERE (col4 > 1.41);

SELECT pk FROM tab1 WHERE NOT (col1 >= 72.63);

SELECT pk FROM tab1 WHERE NOT (col1 > 65.29);

DELETE FROM tab0 WHERE col0 = 87;

INSERT INTO tab0 VALUES(5,60,34.33,'jxdov',11,88.98,'mavfo');

SELECT pk FROM tab1 WHERE NOT (col3 BETWEEN 69 AND 97);

DELETE FROM tab0 WHERE (col0 > 60) AND col3 < 6;

DELETE FROM tab2 WHERE (((col0 > 62)) OR col0 > 60 OR (col4 < 27.81 AND col0 > 56 AND (col4 > 34.34)) OR col0 > 22);

SELECT pk FROM tab0 WHERE NOT (col3 > 95);

DELETE FROM tab0 WHERE ((col1 > 61.8)) OR col3 > 82 OR col3 IN (31,39,69);

DELETE FROM tab2 WHERE col3 BETWEEN 60 AND 81;

DELETE FROM tab1 WHERE col4 > 42.69;

SELECT pk FROM tab1 WHERE (((col3 > 58) AND col0 < 17));

CREATE UNIQUE INDEX idx_tab2_1 ON tab2 (col4 DESC,col0);

SELECT pk FROM tab2 WHERE NOT ((col3 >= 52) OR col0 >= 80);

SELECT pk FROM tab1 WHERE col1 > 14.77;

SELECT pk FROM tab1 WHERE col1 > 16.88;

SELECT pk FROM tab1 WHERE col4 = 36.12;

DELETE FROM tab4 WHERE (col0 >= 49 AND ((col3 > 44)) AND col0 <= 55 AND (col3 >= 92) AND col0 = 69 OR col0 > 7) AND col0 <= 35;

INSERT INTO tab0 VALUES(5,66,13.50,'psdfc',29,3.59,'pydug');

DELETE FROM tab0 WHERE (((((col3 < 12)) OR col3 <= 18) OR col4 >= 61.92 AND col3 IS NULL));

SELECT pk FROM tab4 WHERE NOT ((col3 >= 30));

DELETE FROM tab0 WHERE (col4 > 96.82);

SELECT pk FROM tab3 WHERE col0 <= 34;

DELETE FROM tab2 WHERE (col1 = 73.17);

DELETE FROM tab1 WHERE col3 < 63;

DELETE FROM tab0 WHERE (col3 > 9);

DELETE FROM tab3 WHERE col0 < 79 OR col1 > 38.84;

DELETE FROM tab0 WHERE ((col0 > 67 OR col0 <= 29));

INSERT INTO tab0 VALUES(7,65,82.41,'eiawc',91,77.60,'poxll');

DELETE FROM tab0 WHERE col0 <= 32;

CREATE INDEX idx_tab3_0 ON tab3 (col3,col4);

SELECT pk FROM tab2 WHERE ((((((col0 <= 4))) AND (col1 < 97.58))));

SELECT pk FROM tab2 WHERE col1 >= 20.18 AND ((((col4 = 44.59)))) AND col4 IS NULL AND col3 BETWEEN 21 AND 3 OR col3 > 97 OR col3 > 16 OR col3 <= 48 AND col0 <= 83 OR col0 < 47 AND (col3 > 89 AND col1 <= 16.91) AND col1 IN (66.76,51.19,98.92,65.84,75.95);

DELETE FROM tab2 WHERE (((col3 < 14) OR col3 <= 28 AND col1 <= 45.78 AND ((col0 > 69 AND col3 > 49))));

SELECT pk FROM tab4 WHERE col3 > 79;

SELECT pk FROM tab3 WHERE col3 >= 40;

INSERT INTO tab0 VALUES(3,33,93.14,'feiym',4,65.90,'wnozu');

DELETE FROM tab4 WHERE (((col0 IS NULL)) AND col3 >= 32);

INSERT INTO tab0 VALUES(7,25,33.47,'ogjqw',87,54.92,'bfxop');

SELECT pk FROM tab2 WHERE NOT (((col1 < 98.18)));

INSERT INTO tab0 VALUES(9,48,62.47,'flado',54,96.77,'pnzbc');

SELECT pk FROM tab1 WHERE NOT (col4 <= 30.8 AND col1 <= 22.84 AND ((col3 > 45)) OR col4 > 26.0);

SELECT pk FROM tab1 WHERE col1 <= 26.24;

SELECT pk FROM tab3 WHERE NOT (col0 IN (78,14,86));

SELECT pk FROM tab1 WHERE col4 < 53.57;

SELECT pk FROM tab0 WHERE col1 < 70.89 OR col4 > 23.43;

SELECT pk FROM tab2 WHERE NOT (((col4 = 10.15)));

INSERT INTO tab0 VALUES(0,38,92.0,'vgujz',8,2.2,'zhyde');

INSERT INTO tab0 VALUES(0,85,6.91,'ckfcd',58,63.73,'tdgrk');

SELECT pk FROM tab4 WHERE col3 BETWEEN 82 AND 88;

SELECT pk FROM tab4 WHERE col4 > 29.74 OR col0 <= 32 OR col3 > 84 AND (col0 < 21);

SELECT pk FROM tab2 WHERE NOT ((col0 BETWEEN 72 AND 61 AND ((col1 > 7.75 AND col3 >= 89 OR col3 = 88 OR col4 > 30.91 OR (col0 IS NULL OR (col3 >= 65 AND ((col0 > 63) OR col1 >= 56.58) OR (col3 >= 69) AND col4 IS NULL AND ((((col0 > 28)))) AND ((col0 <= 34)) OR col3 <= 44 AND (col1 = 63.2 AND col1 >= 47.47) AND col3 < 43 AND ((col0 = 69)) OR (((col3 > 83)) OR (col0 < 75)) OR col0 <= 88 AND (col3 < 91 OR col1 <= 95.48 AND (col1 > 37.70 AND col4 > 64.7 AND col0 <= 92) AND col3 = 40 AND col1 > 58.1) AND (col3 > 27) AND col0 < 65 OR (((col1 >= 87.73))) OR col3 = 5 AND col0 < 18 AND col1 <= 9.31 AND (col4 = 3.66) AND (col3 > 95 OR (col0 BETWEEN 38 AND 13 AND col4 > 47.49)) AND ((col0 > 42)) AND col1 <= 3.6 OR col4 = 26.5 OR col0 IN (44,64,36,79) OR (col4 IN (30.83,80.14,19.37,13.81,51.92,72.14))) OR col3 > 84 AND col0 >= 50) OR col3 IN (42,80) AND (col1 IN (71.29,21.87)) OR col0 < 16 OR (col1 < 94.56 OR col1 <= 98.14) AND (col1 > 90.20) OR (col3 < 22) OR ((((col3 > 9) OR ((col3 IN (84,89))) AND col3 > 53))) OR col3 < 82 OR col1 > 23.43 OR col4 > 37.32 OR col3 >= 76 AND col1 < 21.25 OR ((col0 >= 61))) AND col4 IS NULL)));

SELECT pk FROM tab1 WHERE (col1 > 41.58);

DELETE FROM tab0 WHERE ((col0 < 24)) OR col3 <= 37 OR col0 > 77;

SELECT pk FROM tab2 WHERE NOT ((col3 < 54));

SELECT pk FROM tab2 WHERE NOT (col0 IN (93,1,83,94,26,94));

SELECT pk FROM tab4 WHERE NOT (col1 <= 98.6);

INSERT INTO tab0 VALUES(9,47,65.31,'xgtvb',22,4.90,'vmuel');

SELECT pk FROM tab1 WHERE col4 = 27.38;

SELECT pk FROM tab3 WHERE (col4 < 62.71 OR col1 < 24.74 OR (col3 > 7));

SELECT pk FROM tab2 WHERE (col0 BETWEEN 72 AND 90) OR col0 IS NULL AND col3 IN (25,34,33,4,8,24) OR ((col3 <= 20) AND (col4 IN (47.89,66.43,49.41,41.10,33.4)) OR (col0 = 47)) AND col0 > 48;

INSERT INTO tab0 VALUES(1,19,74.23,'keoje',84,14.43,'bfdjg');

SELECT pk FROM tab0 WHERE (col3 IN (61)) OR col0 = 96;

SELECT pk FROM tab0 WHERE col0 IS NULL AND col0 > 11 AND col3 = 9;

INSERT INTO tab0 VALUES(8,12,94.98,'fmkfg',91,75.24,'pzvqd');

DELETE FROM tab4 WHERE (col4 <= 55.41 OR col0 < 3);

DELETE FROM tab2 WHERE ((((col3 >= 28))));

DELETE FROM tab1 WHERE col0 > 31;

DELETE FROM tab4 WHERE ((col3 < 1 AND col3 = 35) AND col3 >= 6 OR col0 > 6);

SELECT pk FROM tab1 WHERE (col3 >= 56);

INSERT INTO tab0 VALUES(0,63,26.4,'mzyqw',88,50.61,'kxhkj');

DELETE FROM tab0 WHERE col0 > 60;

SELECT pk FROM tab2 WHERE NOT ((col3 > 35));

SELECT pk FROM tab2 WHERE col0 >= 18;

SELECT pk FROM tab1 WHERE col0 > 57;

SELECT pk FROM tab0 WHERE (col0 <= 78 AND ((col4 > 29.53 OR (col3 <= 78) AND col0 <= 81 AND col0 > 40 AND col3 > 91 AND ((((col0 < 86)))) AND col1 < 56.12 AND col0 IN (81,27,50,83) AND ((col3 >= 42)) AND col0 <= 49 OR (col3 < 51) AND col3 >= 96 OR col1 > 46.56 OR (col3 < 1) AND col1 > 56.70 AND col1 = 44.73 AND col4 > 15.41 OR col0 BETWEEN 94 AND 32 OR col4 IN (44.54))) AND ((col1 > 63.97)) AND col0 < 11 AND col0 IS NULL AND (((col3 <= 16 AND col0 IS NULL))) OR col1 = 66.81);

SELECT pk FROM tab4 WHERE NOT (((col1 < 98.60)));

DELETE FROM tab4 WHERE ((col3 < 74));

INSERT INTO tab0 VALUES(5,20,24.13,'ctnle',7,14.52,'pgryl');

INSERT INTO tab0 VALUES(4,90,34.32,'qydej',23,1.38,'zxwyg');

DELETE FROM tab0 WHERE ((col4 <= 58.25) AND col0 IN (86,54,92) OR col0 >= 56 AND (((col3 < 77) AND col4 >= 84.73 OR col3 <= 53)) AND col3 < 69) OR col4 > 16.89 AND col1 BETWEEN 81.1 AND 63.32 AND col0 = 69;

SELECT pk FROM tab4 WHERE NOT (col4 < 68.49 OR col3 > 85);

SELECT pk FROM tab0 WHERE col0 <= 96 AND col3 < 65;

DELETE FROM tab4 WHERE col1 <= 17.45;

SELECT pk FROM tab3 WHERE NOT (col1 > 90.79);

SELECT pk FROM tab2 WHERE col3 < 59 AND ((col3 = 24 AND col1 = 8.75 AND col4 >= 70.52 AND col1 <= 12.79 AND col0 IS NULL OR (col3 > 36 OR (col3 < 23 OR col4 IS NULL AND (col0 < 30 OR col3 > 5) AND col3 = 38 OR col3 <= 87))) OR col0 > 45);

SELECT pk FROM tab1 WHERE NOT (col1 IS NULL AND (col0 <= 90 AND col4 < 16.81 AND (col4 IN (10.72,6.68,49.14,65.33,55.4,66.40) AND col3 > 94) OR (col3 > 0 OR (((((col0 > 26)) AND col3 IN (98,72,93,6,97,21) OR col0 IN (44,18,32,76,52,61) OR col3 = 23 AND col0 IN (19,15,99,36,77) OR col3 = 47 OR (col0 < 75)) AND col1 <= 20.72 AND col4 IN (12.21,77.18,77.27,80.88,59.12) OR col0 = 80)))) AND col0 > 2 OR col1 > 59.2 AND col1 >= 92.51 AND col3 > 55);

SELECT pk FROM tab3 WHERE NOT (col4 < 97.86);

SELECT pk FROM tab2 WHERE col4 > 49.1;

DELETE FROM tab3 WHERE ((((col3 >= 32) AND col0 BETWEEN 1 AND 18 AND col3 <= 40 OR (col3 > 87) AND (col1 < 71.50) OR col0 < 36) OR ((col4 > 70.25)) AND col4 < 44.55 OR (col4 > 63.74 OR col3 < 39) AND col0 <= 80));

DELETE FROM tab1 WHERE (col1 > 39.7) AND col0 = 5;

SELECT pk FROM tab4 WHERE (col0 IN (44,24,39));

SELECT pk FROM tab1 WHERE NOT ((col1 >= 71.2 AND col3 = 17 AND col3 >= 66 OR col3 >= 78 AND col0 <= 76 OR col0 <= 39) OR col0 >= 11);

SELECT pk FROM tab1 WHERE ((col4 > 50.43) AND col1 > 89.87 OR (col3 >= 19 OR (col3 <= 46) AND col0 = 27) AND col4 < 44.49) OR (col3 < 89);

INSERT INTO tab0 VALUES(5,54,53.8,'byudb',72,55.30,'mzhdi');

SELECT pk FROM tab0 WHERE NOT (col4 = 80.51);

SELECT pk FROM tab4 WHERE (col4 <= 0.65) OR col0 >= 37;

SELECT pk FROM tab2 WHERE NOT (col3 <= 46);

SELECT pk FROM tab3 WHERE col3 <= 12;

DELETE FROM tab2 WHERE ((col3 = 41 AND col3 < 17) AND (col3 <= 92 AND ((col0 > 42))) OR (((col4 BETWEEN 20.68 AND 58.86)) AND col3 = 16 AND (col0 > 33 OR col3 <= 75 OR col3 >= 7)) OR ((((col0 > 84) OR col1 < 12.67))) OR (col3 > 49));

SELECT pk FROM tab4 WHERE NOT ((col0 <= 24 OR col0 BETWEEN 45 AND 51 AND col3 IN (56,54,25,33,62)));

SELECT pk FROM tab3 WHERE NOT (col0 <= 82 OR ((col0 >= 74) AND col4 >= 28.30 OR col1 > 23.49 AND col0 >= 15 AND ((col4 IN (84.34,36.47,3.65,32.28,31.82)))));

INSERT INTO tab0 VALUES(7,36,19.35,'jhgwd',31,65.15,'qecmo');

INSERT INTO tab0 VALUES(2,83,25.98,'zpcms',12,43.14,'adysi');

SELECT pk FROM tab3 WHERE NOT (col4 > 79.76);

DELETE FROM tab1 WHERE col0 > 83 AND ((((col4 >= 19.54))));

DELETE FROM tab4 WHERE col4 IS NULL AND (col3 IN (90,69,29,48,81,90)) AND col3 > 68;

SELECT pk FROM tab2 WHERE NOT ((col1 = 41.44) AND (col1 BETWEEN 24.75 AND 31.95));

DELETE FROM tab0 WHERE col0 < 8 OR (col3 > 31) AND (col3 > 19 AND col4 > 27.76);

DELETE FROM tab4 WHERE (col1 < 97.72);

SELECT pk FROM tab0 WHERE NOT (((((col4 > 91.94 OR col3 > 13 AND col4 = 29.45)))) OR (col1 > 35.20) OR (col0 > 55 AND col4 > 59.42) AND col0 > 72 AND col0 > 2 AND (col0 > 97) AND col3 BETWEEN 44 AND 18 OR col0 < 4 OR (col1 < 49.42) OR col0 > 71);

SELECT pk FROM tab3 WHERE (col1 < 81.61);

SELECT pk FROM tab2 WHERE col0 < 61 AND col4 = 74.34;

SELECT pk FROM tab2 WHERE NOT ((col1 > 70.88) OR col4 > 53.70);

SELECT pk FROM tab1 WHERE ((col4 < 56.15 AND (col4 >= 55.37 OR (col3 IN (83,19,58))) AND col3 <= 88 OR (col3 < 50) OR col1 < 26.45 AND ((col3 < 61)))) OR col3 = 24;

DELETE FROM tab1 WHERE col3 > 2 AND col4 = 3.40 AND col0 < 61 OR col3 = 20;

SELECT pk FROM tab0 WHERE ((col0 = 53)) OR col3 <= 89;

DELETE FROM tab1 WHERE col0 BETWEEN 59 AND 86;

SELECT pk FROM tab0 WHERE col3 > 29 OR col1 >= 1.58;

INSERT INTO tab0 VALUES(5,90,24.21,'hmztu',67,17.40,'qovaf');

SELECT pk FROM tab4 WHERE NOT (col3 <= 29);

INSERT INTO tab0 VALUES(8,5,3.19,'fpmzu',75,24.65,'huqgw');

DELETE FROM tab3 WHERE (col4 > 71.47) OR col0 IN (98,26,25,60);

INSERT INTO tab0 VALUES(7,17,12.42,'rsuvd',15,25.51,'mtcde');

DELETE FROM tab3 WHERE col1 <= 83.81;

SELECT pk FROM tab1 WHERE NOT (col1 > 15.43);

DELETE FROM tab2 WHERE col3 > 41;

INSERT INTO tab0 VALUES(3,68,84.43,'osmjh',12,15.7,'qjvck');

INSERT INTO tab0 VALUES(0,5,51.23,'eikzs',13,31.91,'ieylm');

SELECT pk FROM tab3 WHERE ((col0 >= 90) OR (((((col0 = 59))) AND ((((col0 <= 8) AND col1 = 95.46 AND (col3 IS NULL AND ((col3 > 80) AND col4 = 41.52 OR (col1 > 41.81))) AND col0 >= 98 OR col3 >= 30 OR col0 < 72 AND col1 IN (96.45,72.61,79.49,2.86)) OR col4 < 36.64 OR ((col3 >= 97)))))) AND col1 >= 83.64 AND col1 IS NULL OR (col0 < 16) OR ((col3 <= 24)) AND ((col4 <= 85.48)) AND (col0 IS NULL OR col4 > 76.99) AND col3 IN (86,88,91,36));

DELETE FROM tab2 WHERE ((col4 >= 67.49)) AND col0 >= 3 AND (col1 > 91.83) OR col3 > 38;

SELECT pk FROM tab2 WHERE ((col0 < 52 AND col1 <= 50.8));

SELECT pk FROM tab3 WHERE NOT ((col3 = 34 OR col0 <= 35 AND col0 > 43 AND col3 BETWEEN 49 AND 91));

DELETE FROM tab1 WHERE (col0 < 29 AND col4 <= 32.53);

DELETE FROM tab4 WHERE col0 <= 21;

DELETE FROM tab3 WHERE col3 = 8;

SELECT pk FROM tab2 WHERE col4 > 39.5;

INSERT INTO tab0 VALUES(3,21,37.0,'zffws',8,90.41,'nwgez');

INSERT INTO tab0 VALUES(1,1,25.96,'psvdx',54,58.19,'ocint');

SELECT pk FROM tab0 WHERE col0 = 21 AND col0 < 38;

DELETE FROM tab4 WHERE ((col3 <= 40));

DELETE FROM tab4 WHERE (col1 > 67.22 OR (col0 > 69));

DELETE FROM tab4 WHERE col4 <= 9.68;

INSERT INTO tab0 VALUES(6,10,94.29,'zcpby',44,90.37,'trarm');

SELECT pk FROM tab3 WHERE ((((col0 > 75 AND col0 BETWEEN 53 AND 59))) AND col3 < 23 OR (col1 <= 32.56));

SELECT pk FROM tab2 WHERE NOT (col3 <= 25 AND (col3 IN (44,64)));

INSERT INTO tab0 VALUES(3,40,90.80,'pelhr',6,91.61,'lnaws');

DELETE FROM tab1 WHERE col0 <= 18;

SELECT pk FROM tab3 WHERE col4 > 52.25;

SELECT pk FROM tab1 WHERE col3 > 47 OR col3 > 47;

DELETE FROM tab4 WHERE (col0 <= 17 OR col3 = 97 AND (col1 >= 2.31) AND (col1 > 50.75) AND col1 = 72.95 OR col4 >= 32.95 AND ((col0 <= 15)) OR col3 <= 57) AND (col1 < 88.55) OR col3 IN (81,59);

SELECT pk FROM tab4 WHERE col0 < 70;

SELECT pk FROM tab3 WHERE NOT (((col1 IS NULL)) AND col0 > 27 AND col3 >= 22 AND (col3 <= 26) OR (col1 > 0.25 AND (col4 > 20.5 AND (col4 >= 46.48)) AND col1 IN (49.69,37.4,38.37,96.94,28.3,87.10) AND col3 > 20 OR (col4 BETWEEN 46.64 AND 95.26) AND col1 >= 46.5 AND (col0 > 47 AND ((col3 > 10))) AND col4 IN (90.42,9.45,44.35,22.11,84.11) AND col0 < 93 OR ((((col3 >= 8))))) OR col3 >= 20);

SELECT pk FROM tab3 WHERE (col0 >= 79);

SELECT pk FROM tab1 WHERE NOT (col3 < 11);

SELECT pk FROM tab4 WHERE NOT ((((col3 >= 86) OR col1 <= 75.12 AND (col4 > 49.74))) OR (col1 > 56.67) AND (col0 IS NULL) AND (col0 > 87) AND col4 = 48.9 OR col4 <= 38.81);

SELECT pk FROM tab4 WHERE NOT ((col1 > 23.21));

DELETE FROM tab2 WHERE col4 < 56.2;

INSERT INTO tab0 VALUES(7,82,39.41,'oalbv',19,13.51,'xetqx');

DELETE FROM tab1 WHERE col4 = 25.46;

DELETE FROM tab2 WHERE col3 BETWEEN 36 AND 81;

SELECT pk FROM tab1 WHERE NOT ((col3 < 34));

INSERT INTO tab0 VALUES(1,66,27.8,'rorkx',86,33.56,'fulhl');

SELECT pk FROM tab4 WHERE NOT ((col1 > 49.13 AND ((col4 IN (35.37,81.31)) OR col3 >= 7) AND col0 > 3 AND col1 IS NULL AND col0 IS NULL) OR (col4 < 4.36));

SELECT pk FROM tab2 WHERE NOT ((col4 > 29.50));

SELECT pk FROM tab2 WHERE NOT ((col1 > 44.89 AND col1 < 97.69));

SELECT pk FROM tab1 WHERE col1 IN (6.13,23.46,88.45,73.26) AND col1 > 71.99;

SELECT pk FROM tab0 WHERE (col1 > 41.79 AND col0 > 5 AND (col3 IS NULL)) AND col1 >= 97.97 OR col0 = 31 AND col4 > 18.6 AND col3 > 6;

DELETE FROM tab4 WHERE col0 < 97 AND col3 > 56 AND (col4 <= 0.12) AND col4 > 9.74;

SELECT pk FROM tab4 WHERE col1 < 25.77 AND col0 < 59 AND col1 BETWEEN 77.71 AND 6.83;

SELECT pk FROM tab3 WHERE NOT (((col4 >= 34.85 AND col3 <= 58)));

DELETE FROM tab2 WHERE col1 >= 24.81;

SELECT pk FROM tab4 WHERE ((col3 >= 80) OR (col0 < 94) AND col4 >= 97.60);

SELECT pk FROM tab4 WHERE col1 <= 23.47;

SELECT pk FROM tab1 WHERE NOT (col4 = 40.53 AND (((((((col0 = 54) AND col4 < 62.74))) AND col3 IS NULL OR col3 = 63 AND col4 <= 23.60))) OR col3 IS NULL);

SELECT pk FROM tab2 WHERE col0 >= 70;

INSERT INTO tab0 VALUES(2,25,60.30,'ijcgq',5,93.1,'qpmly');

SELECT pk FROM tab4 WHERE col3 > 43;

SELECT pk FROM tab2 WHERE (((col4 > 79.25 OR col3 >= 53 OR ((col0 > 15))) AND col4 > 16.57 OR col1 < 41.63 OR (col0 >= 33) OR (col3 < 67) AND (col4 > 42.49 AND col1 <= 89.95 AND ((col0 >= 98 AND col1 > 46.62 OR (col3 >= 83) AND (col3 > 8))) OR col0 < 63 AND col3 = 71 AND ((col4 IS NULL))) AND (((col4 IS NULL))) AND (col0 < 61) AND (col3 IN (61,77)) AND (col0 <= 53 AND col0 >= 95) OR col3 > 50) AND col1 < 23.75 AND col0 >= 27);

INSERT INTO tab0 VALUES(8,66,41.72,'bxfgr',82,93.5,'rlunq');

DELETE FROM tab2 WHERE col3 >= 6;

SELECT pk FROM tab1 WHERE NOT (col0 > 99);

DELETE FROM tab2 WHERE (col3 <= 28 AND col0 IS NULL OR (col1 IS NULL));

SELECT pk FROM tab0 WHERE NOT (((col0 <= 2)) OR (((col1 < 20.36))) OR col3 > 61);

SELECT pk FROM tab4 WHERE NOT ((col1 > 19.13 OR ((col1 = 4.83)) AND (col3 <= 21)));

SELECT pk FROM tab0 WHERE ((col1 < 15.47));

SELECT pk FROM tab0 WHERE col4 < 11.5 AND (((col1 IS NULL))) OR col1 >= 90.89 OR col0 > 49;

SELECT pk FROM tab4 WHERE col1 < 39.1;

SELECT pk FROM tab2 WHERE NOT (((col3 <= 68)));

INSERT INTO tab0 VALUES(3,4,33.96,'jkqeo',47,56.54,'otcdm');

SELECT pk FROM tab1 WHERE NOT (col0 <= 56);

SELECT pk FROM tab0 WHERE NOT (col1 <= 80.83);

SELECT pk FROM tab1 WHERE NOT (((col1 >= 40.37) OR (col4 BETWEEN 61.23 AND 2.93) OR (col1 <= 66.60 OR (col0 <= 37) OR col3 < 48) AND ((col3 IN (57,74) OR ((col4 < 31.18)) AND (col4 IS NULL OR col4 <= 55.45 AND (col3 IS NULL)))) OR col0 > 36 OR (col3 > 25)));

DELETE FROM tab2 WHERE (col1 < 80.2);

SELECT pk FROM tab1 WHERE col3 < 88;

SELECT pk FROM tab1 WHERE col3 > 48;

DELETE FROM tab0 WHERE col0 IN (74,7,48,20);

DELETE FROM tab4 WHERE (col0 IN (83,43,61,4,48)) OR (col3 < 79);

SELECT pk FROM tab2 WHERE (col0 >= 18);

INSERT INTO tab0 VALUES(3,23,69.18,'wrjls',5,82.90,'zxbmx');

DELETE FROM tab3 WHERE col1 IN (84.93,34.66,70.52);

DELETE FROM tab1 WHERE col3 BETWEEN 58 AND 10 OR (((col4 <= 32.97)) OR col3 < 37);

INSERT INTO tab0 VALUES(2,30,42.57,'jjjuc',11,4.25,'mitkn');

INSERT INTO tab0 VALUES(5,84,68.77,'dbybo',87,22.78,'mhxox');

SELECT pk FROM tab4 WHERE NOT (col0 <= 89 AND col3 >= 45);

SELECT pk FROM tab1 WHERE NOT ((col0 < 93) OR col3 < 64);

INSERT INTO tab0 VALUES(1,45,41.76,'kptqr',42,53.6,'ofwlc');

SELECT pk FROM tab0 WHERE col3 < 66;

SELECT pk FROM tab0 WHERE col4 > 85.8;

SELECT pk FROM tab0 WHERE NOT (((col4 < 94.28)));

SELECT pk FROM tab0 WHERE NOT (((((col0 <= 18 AND (col4 IS NULL) OR col4 >= 46.29))) OR col3 <= 64));

DELETE FROM tab0 WHERE col4 < 76.36 AND col3 > 32 OR col3 < 7;

SELECT pk FROM tab3 WHERE NOT (((((col1 = 43.20))) AND col3 > 48 AND col4 = 76.27) OR col0 > 83);

INSERT INTO tab0 VALUES(8,10,96.36,'sakta',68,21.44,'mbjul');

INSERT INTO tab0 VALUES(6,25,50.48,'aooii',0,27.4,'xoyev');

SELECT pk FROM tab0 WHERE NOT (col0 > 33);

SELECT pk FROM tab0 WHERE NOT (((col3 = 13) AND col0 > 72 OR col0 <= 34 AND (col3 = 73) OR col0 <= 93 AND (col3 >= 76 OR col3 = 1) AND ((col4 > 60.51)) OR col0 < 85));

CREATE INDEX idx_tab4_3 ON tab4 (col0,col1 DESC);

INSERT INTO tab0 VALUES(8,15,77.97,'qxpzh',67,4.85,'rdlae');

SELECT pk FROM tab2 WHERE NOT (col3 IN (1,0,64,67,97,83));

SELECT pk FROM tab1 WHERE (((col3 IS NULL)) OR col4 > 59.22) AND col3 <= 86 OR (col0 < 12);

INSERT INTO tab0 VALUES(0,63,98.61,'pxfop',60,20.15,'nwxtr');

DELETE FROM tab1 WHERE (col1 IS NULL) AND ((col4 > 73.8) OR col3 IS NULL AND (col0 < 48 AND ((col1 >= 37.47))) AND ((col0 > 31 AND col4 < 32.27))) OR col0 < 90 AND col4 > 5.6;

DELETE FROM tab2 WHERE col4 < 40.24 AND col3 IN (23);

SELECT pk FROM tab1 WHERE NOT (((col3 < 55 AND col4 > 50.62)));

SELECT pk FROM tab1 WHERE col0 = 38 AND col3 IS NULL OR (col3 <= 39) OR col4 <= 52.68;

SELECT pk FROM tab2 WHERE NOT (((col3 >= 85)) AND ((col0 < 34 OR (col0 < 9 OR col0 >= 2)) AND (col3 < 39 AND col1 IS NULL) AND col0 > 54 AND col3 = 95));

SELECT pk FROM tab0 WHERE (col0 >= 90 AND ((((col0 > 3) OR (col3 > 55)))));

DELETE FROM tab0 WHERE col3 <= 18;

DELETE FROM tab0 WHERE col3 < 59;

SELECT pk FROM tab0 WHERE ((col0 >= 42 OR col1 > 87.95)) AND ((col3 <= 98) OR ((((((col3 >= 29)) AND col4 IS NULL AND col3 >= 61 AND col0 < 19) AND (col1 < 75.50) OR col3 IS NULL OR col4 > 20.30 AND col3 >= 59 OR (col1 = 44.16) AND col4 >= 2.11 OR ((((((col4 = 32.12))) AND col4 >= 78.3 OR ((col0 > 42)) AND col1 < 93.81))))) AND ((col0 >= 3) OR (((col0 < 18 OR col0 <= 63 AND col0 <= 71 AND col3 = 88 AND col4 < 12.63 AND col0 < 93 OR (col0 > 36) AND (col3 < 89 OR col3 <= 29 AND (col0 < 27)) AND col3 < 4 AND (col3 > 15) AND col4 < 81.27 OR (col1 BETWEEN 67.28 AND 95.80) OR col0 <= 53 OR ((col1 IN (23.84,11.1,55.7,60.56,91.42,8.75) OR (col0 >= 66) AND col3 IS NULL AND col3 >= 61)) AND (col3 >= 37) AND ((col4 < 14.17) AND col4 < 26.53 AND col3 < 40 OR col0 = 18 OR col1 <= 46.15 OR col3 >= 61)))) AND col3 IS NULL AND col0 >= 20 AND col3 IS NULL) AND col1 < 25.45 AND ((col3 IS NULL) OR (col4 = 31.52)) AND (col0 IN (11,66)) AND (col0 < 67 AND col1 >= 41.19) AND col3 > 41)) OR col0 IS NULL OR (col3 >= 32) AND (col0 = 22 AND col3 = 95);

SELECT pk FROM tab4 WHERE col4 >= 58.24;

DELETE FROM tab3 WHERE (col1 = 57.37);

SELECT pk FROM tab4 WHERE col3 = 65 AND (((col0 > 3) AND col0 > 63));

DELETE FROM tab2 WHERE (col0 <= 35);

SELECT pk FROM tab3 WHERE NOT (((col3 < 10 AND ((col3 >= 34)) AND (col1 > 78.8 AND ((col0 IS NULL) AND col0 < 84) AND (col0 >= 13) OR col0 <= 67 AND col0 > 36 AND (col0 >= 24) OR ((col3 > 16)) OR (col3 >= 53) AND col3 >= 21) AND col3 < 37)));

DELETE FROM tab0 WHERE col3 <= 48 OR col0 < 9;

INSERT INTO tab0 VALUES(0,58,79.87,'pvvov',1,93.3,'ussdu');

SELECT pk FROM tab4 WHERE col0 <= 36 OR col3 > 14;

SELECT pk FROM tab4 WHERE (((col1 >= 50.89) OR col1 >= 21.58));

DELETE FROM tab1 WHERE col3 IN (98,78) AND col4 < 50.57;

SELECT pk FROM tab4 WHERE NOT (col1 IN (1.48,76.16) OR col3 >= 80);

DELETE FROM tab4 WHERE ((col3 < 63)) AND col0 <= 61;

DELETE FROM tab2 WHERE ((col3 IN (22,39,48,29)));

SELECT pk FROM tab0 WHERE NOT (((col0 IS NULL)) AND col3 > 50 OR (col0 > 58));

SELECT pk FROM tab2 WHERE col0 = 8;

SELECT pk FROM tab4 WHERE NOT (col3 BETWEEN 72 AND 3);

DELETE FROM tab4 WHERE ((((col0 IN (24,39,54,98,51) AND ((col3 < 48)) AND col3 >= 94) AND col1 < 95.84 OR col0 < 95 OR ((col0 > 6)) AND (col1 <= 27.94) OR col0 > 26 OR col0 = 88 AND col1 < 92.14 OR col4 >= 96.30) OR ((col0 > 76 AND ((col3 > 57)))) OR col4 <= 69.30)) AND col0 > 55;

SELECT pk FROM tab3 WHERE NOT (col3 IN (93,50));

DELETE FROM tab2 WHERE col1 < 33.16 OR (col3 < 43) AND col4 < 2.12;

SELECT pk FROM tab4 WHERE NOT ((((((col3 > 75))))));

SELECT pk FROM tab4 WHERE NOT (col3 >= 29 OR ((col4 >= 41.61) OR col3 = 80 OR col4 > 84.33 OR col0 >= 85) AND (col4 = 59.79 AND (col3 > 31)) AND col3 > 12 OR col0 <= 91);

SELECT pk FROM tab4 WHERE col0 <= 9 AND col4 >= 33.20;

SELECT pk FROM tab1 WHERE NOT ((((col3 < 29) AND (col4 < 86.39) OR ((col1 IS NULL)) OR col3 > 57 OR col4 > 93.82 AND col0 BETWEEN 70 AND 83 OR ((col0 = 24)) OR col3 <= 85)));

SELECT pk FROM tab0 WHERE NOT (col1 > 30.62);

INSERT INTO tab0 VALUES(4,96,79.97,'pitbm',48,84.18,'jefht');

SELECT pk FROM tab0 WHERE NOT ((col4 = 4.46));

SELECT pk FROM tab0 WHERE col4 >= 64.63;

INSERT INTO tab0 VALUES(2,18,97.64,'ejwoy',20,36.37,'lptxn');

DELETE FROM tab1 WHERE col0 >= 95;

CREATE INDEX idx_tab4_3 ON tab4 (col4,col0);

SELECT pk FROM tab0 WHERE col0 > 14;

DELETE FROM tab0 WHERE (col0 < 54 OR col3 >= 71) OR col3 IN (65);

SELECT pk FROM tab0 WHERE col4 <= 57.62;

DELETE FROM tab0 WHERE col1 = 59.87;

SELECT pk FROM tab0 WHERE NOT (col0 >= 55);

INSERT INTO tab0 VALUES(0,35,7.12,'twdyh',70,12.56,'ssmuq');

SELECT pk FROM tab0 WHERE col1 > 1.42;

INSERT INTO tab0 VALUES(1,84,2.86,'jucve',76,32.60,'accgn');

SELECT pk FROM tab0 WHERE col3 > 19 OR (((col3 >= 5 OR col3 IS NULL) OR col0 = 74 OR col0 > 88 AND col0 < 22));

INSERT INTO tab0 VALUES(3,7,36.82,'tnjmb',77,82.36,'gvkmj');

INSERT INTO tab0 VALUES(7,8,16.22,'vaalb',95,11.53,'yfwfw');

SELECT pk FROM tab3 WHERE col4 < 88.23;

SELECT pk FROM tab4 WHERE col0 >= 81;

SELECT pk FROM tab4 WHERE NOT ((col0 > 52));

SELECT pk FROM tab0 WHERE ((col3 < 34) OR col1 >= 82.74 AND col0 < 17);

INSERT INTO tab0 VALUES(2,94,22.2,'ankps',45,81.38,'cjacr');

SELECT pk FROM tab1 WHERE (col1 = 21.15);

DELETE FROM tab1 WHERE (((col1 <= 50.59))) AND col3 >= 1;

INSERT INTO tab0 VALUES(4,90,66.82,'ivhee',84,41.17,'tdfjr');

DELETE FROM tab3 WHERE (col0 = 52 AND (col0 = 98) OR col0 >= 56 AND col0 > 82 AND (col3 > 35));

INSERT INTO tab0 VALUES(9,34,89.60,'ifzgd',34,44.58,'tihdo');

SELECT pk FROM tab4 WHERE (col4 > 37.41 OR col0 = 65 AND ((col4 > 17.86 AND col0 <= 19 AND (col1 > 32.47) OR col3 >= 21 AND col1 < 30.85))) AND col4 <= 51.17;

SELECT pk FROM tab2 WHERE NOT (col1 BETWEEN 34.4 AND 89.67 OR col0 IN (46,62,53,57,83) OR col3 >= 36 AND (((col4 <= 53.6))) OR col0 >= 91 OR ((col4 < 69.98) AND (col3 < 64 AND col3 > 43) AND col0 > 40) AND (col1 > 86.87 AND col0 >= 57));

INSERT INTO tab0 VALUES(4,21,97.59,'ujvxc',73,68.50,'nyerv');

SELECT pk FROM tab3 WHERE NOT (col0 >= 63 AND (col0 >= 94) AND col3 = 16 AND col1 = 88.59 OR col0 = 23 AND (col3 > 7 OR ((col1 > 86.27) AND (col0 = 92 OR col0 = 78))) AND col4 <= 49.20 AND ((col3 = 11 AND (col4 < 88.29)) AND (col1 <= 57.9)) OR col0 <= 97 AND col1 >= 78.59 OR ((((col1 > 58.86 OR col3 > 6 AND col0 < 70 OR col3 > 33 AND (((col1 < 5.55)) AND col0 >= 50 OR col3 <= 87) AND (((col4 < 77.85)))) AND col3 < 93 AND ((col0 > 72 OR col1 < 12.32 AND ((col0 >= 28))))) OR col3 < 59 AND col3 > 62 OR col1 > 30.76)));

DELETE FROM tab2 WHERE col1 = 97.32;

INSERT INTO tab0 VALUES(1,24,71.33,'tcjen',60,61.0,'wstqi');

SELECT pk FROM tab4 WHERE NOT ((col3 > 44 OR ((col4 <= 50.95))) AND col3 IS NULL);

DELETE FROM tab2 WHERE col1 <= 74.68;

INSERT INTO tab0 VALUES(9,22,77.69,'rnbko',3,72.3,'viybz');

SELECT pk FROM tab3 WHERE col1 > 1.4;

DELETE FROM tab0 WHERE col4 > 65.11 OR (col0 < 32) OR col1 < 98.32 AND (col1 > 34.14);

DELETE FROM tab0 WHERE col1 > 98.70;

INSERT INTO tab0 VALUES(1,94,63.51,'bgfej',43,53.70,'vujjs');

SELECT pk FROM tab0 WHERE col4 >= 53.87 OR (col3 BETWEEN 24 AND 49);

DELETE FROM tab4 WHERE col1 = 10.61;

DELETE FROM tab2 WHERE col1 >= 23.78;

SELECT pk FROM tab0 WHERE NOT ((((col1 < 69.2 AND col0 > 45 AND col3 IN (72,24,49,58) AND (((col3 <= 13)))) AND (col3 < 32))));

SELECT pk FROM tab0 WHERE NOT (col0 = 17);

DELETE FROM tab1 WHERE (col4 < 69.3) AND (col0 > 33 OR col1 IN (46.17,51.57)) AND (col3 > 36);

SELECT pk FROM tab3 WHERE col0 <= 28 OR col3 > 71 OR col1 >= 10.96 AND (col3 BETWEEN 37 AND 72 AND ((col1 >= 7.7)) OR (col3 < 28) AND (col0 = 53 OR (col0 < 50)) OR (col4 <= 70.27) OR col0 < 96 AND col3 > 9 AND (col3 > 99) OR col3 BETWEEN 56 AND 94 AND col3 < 87 AND col3 BETWEEN 22 AND 9 OR ((col3 <= 32 AND col3 >= 82 AND (col3 > 53) OR col3 > 2 OR ((((col3 < 61) OR col1 <= 75.86 AND col4 IN (42.33,39.38,33.0,75.81) OR col3 <= 4 AND ((col1 BETWEEN 36.69 AND 14.8 OR col3 BETWEEN 27 AND 86))) OR (col4 < 23.49) AND (col3 <= 71))) AND col0 IN (6,25,38,15) OR (col3 < 22) OR col3 > 39 AND (col0 IN (5,49,20,9,62) AND (col3 > 41)) AND (col1 < 11.47 AND col0 > 22) OR (col1 >= 43.54) OR col1 > 9.84) AND col0 = 62) OR col3 = 13 AND col3 > 76 AND col3 >= 80 OR (col0 IS NULL AND ((((col0 = 29) OR (col1 > 26.8))))) AND col1 < 39.32) OR ((col0 <= 21)) OR col1 >= 0.39 AND col0 > 15;

SELECT pk FROM tab3 WHERE (col3 BETWEEN 75 AND 92);

DELETE FROM tab2 WHERE col0 > 44 AND col3 > 94;

DELETE FROM tab3 WHERE (col3 > 32);

SELECT pk FROM tab1 WHERE NOT ((((col4 <= 50.77 OR col3 BETWEEN 28 AND 83)) OR ((col4 < 23.23))));

DELETE FROM tab2 WHERE (col4 < 71.74) OR col0 > 57 OR ((col0 = 35));

SELECT pk FROM tab1 WHERE NOT (col1 BETWEEN 65.19 AND 35.45);

SELECT pk FROM tab1 WHERE NOT (((col3 BETWEEN 15 AND 38)) OR col1 < 4.55 AND ((col3 < 7)));

SELECT pk FROM tab0 WHERE NOT ((col4 < 57.30));

SELECT pk FROM tab4 WHERE col3 = 3 AND col1 <= 8.80;

SELECT pk FROM tab0 WHERE NOT (((col1 IS NULL)));

SELECT pk FROM tab3 WHERE col4 = 5.2 OR col4 > 3.53 OR col3 BETWEEN 13 AND 82;

SELECT pk FROM tab4 WHERE (col0 > 78) AND ((col3 < 34));

DELETE FROM tab4 WHERE col1 >= 54.27;

SELECT pk FROM tab4 WHERE (((col1 > 83.18) OR col3 = 25) AND col0 IS NULL);

SELECT pk FROM tab4 WHERE NOT (col0 > 38 AND col3 > 61);

SELECT pk FROM tab3 WHERE NOT (col1 < 33.45 AND (col1 > 79.18));

INSERT INTO tab0 VALUES(7,3,93.20,'wsnfd',74,35.0,'cppdz');

SELECT pk FROM tab4 WHERE (col3 >= 11);

DELETE FROM tab4 WHERE col0 < 40 AND (col3 < 47);

INSERT INTO tab0 VALUES(1,48,19.10,'yyden',53,42.66,'jzohx');

DELETE FROM tab0 WHERE (col1 >= 33.28);

CREATE INDEX idx_tab4_0 ON tab4 (col1,col3);

DELETE FROM tab3 WHERE col3 = 78;

SELECT pk FROM tab2 WHERE NOT ((col3 > 97));

DELETE FROM tab2 WHERE col1 <= 13.12;

SELECT pk FROM tab2 WHERE NOT (col3 = 38);

SELECT pk FROM tab1 WHERE NOT ((col3 = 81));

SELECT pk FROM tab1 WHERE NOT ((col3 > 14) OR col3 <= 48 OR (col0 < 11) AND col4 <= 48.23 AND (col3 IS NULL) OR col1 IS NULL AND ((col1 > 0.91 AND col0 >= 94 OR (col3 >= 22 OR col3 < 57))));

SELECT pk FROM tab3 WHERE (col3 > 52 OR col3 >= 88);

INSERT INTO tab0 VALUES(9,63,69.5,'rwmyq',37,55.98,'wbuxa');

SELECT pk FROM tab3 WHERE NOT (col0 IN (53,38,89,75) AND col1 >= 5.97);

SELECT pk FROM tab2 WHERE col3 > 32 AND (col1 = 38.8 OR col3 >= 51 AND (((col3 < 19) OR (col0 > 17) AND col1 < 32.92) AND col4 IN (78.89,46.23,32.28,33.68) OR col0 <= 52 AND (col4 IN (26.98,22.94,94.46)) AND col4 = 8.93 AND col3 < 10 AND (col1 <= 84.28 OR col4 > 13.44))) OR (col0 < 82) AND ((col0 < 46) AND col0 > 43 OR (col4 = 79.34 AND col1 <= 85.68) OR col4 >= 89.50) AND col1 >= 85.7 AND col3 < 61 AND col3 >= 15;

DELETE FROM tab1 WHERE col0 = 46;

SELECT pk FROM tab4 WHERE NOT ((((col3 <= 4) OR col0 >= 71) OR col3 < 53));

INSERT INTO tab0 VALUES(40,926,353.6,'exjqq',590,55.92,'nmjqk');

INSERT INTO tab0 VALUES(20,9,336.57,'tijjm',749,717.93,'hrmxy');

INSERT INTO tab0 VALUES(32,802,97.37,'eapeh',3,540.52,'jedqr');

SELECT pk FROM tab3 WHERE NOT ((col3 > 241 OR ((col3 > 695)) AND col0 = 693 AND (col0 > 364 OR ((col4 >= 617.41) AND ((col4 > 518.91)) OR (col0 > 366) OR col3 >= 358 OR col4 = 994.80)) OR col0 < 341 AND col0 > 594 AND (col1 = 911.88) OR (col1 > 862.67)));

INSERT INTO tab0 VALUES(48,729,55.87,'tkcyx',964,500.12,'dcjul');

INSERT INTO tab0 VALUES(60,350,384.31,'dfrtj',169,433.12,'knrlh');

INSERT INTO tab0 VALUES(40,815,186.48,'ifekt',451,37.70,'huzcr');

DELETE FROM tab2 WHERE (col0 IN (984,355));

INSERT INTO tab0 VALUES(58,551,484.22,'vujhv',132,12.54,'zncta');

INSERT INTO tab0 VALUES(40,846,681.75,'syktq',736,522.80,'peoug');

DELETE FROM tab1 WHERE col1 IN (826.10,958.68,683.36,710.53,937.68,692.72);

INSERT INTO tab0 VALUES(85,229,632.37,'rrlfq',708,494.9,'zeymh');

SELECT pk FROM tab2 WHERE col0 < 65 OR col3 < 892 AND ((col3 <= 631 AND col1 >= 763.89 AND col1 > 417.47)) OR col0 > 39 OR (col1 = 22.29);

DELETE FROM tab1 WHERE ((col3 < 557 AND ((((col3 >= 713 OR ((col3 < 4 AND (col3 >= 846)))))))));

INSERT INTO tab0 VALUES(70,723,923.9,'lsooc',591,550.3,'rlndt');

SELECT pk FROM tab1 WHERE NOT (col0 >= 744);

INSERT INTO tab0 VALUES(27,374,181.0,'gkgdl',183,709.82,'uiunq');

SELECT pk FROM tab2 WHERE NOT (col3 = 776);

INSERT INTO tab0 VALUES(90,957,649.38,'yuokf',381,211.25,'lntsk');

INSERT INTO tab0 VALUES(87,512,952.21,'gjrkg',279,703.6,'qrngw');

SELECT pk FROM tab2 WHERE NOT (col3 > 820);

INSERT INTO tab0 VALUES(90,710,601.3,'cmonr',568,722.74,'goidc');

INSERT INTO tab0 VALUES(11,316,230.98,'ezrtv',873,103.46,'hprwo');

SELECT pk FROM tab2 WHERE NOT ((((((col0 < 329))) AND ((col1 < 37.79)))) AND col0 = 235 OR col0 >= 690 AND ((((col0 > 638)))));

INSERT INTO tab0 VALUES(60,443,121.58,'guudq',999,128.41,'phady');

SELECT pk FROM tab3 WHERE NOT (col0 > 948 AND ((col4 >= 294.31)) OR col1 >= 378.32 AND col3 < 131 OR col3 > 55 AND (col3 < 276) AND (((col1 < 673.28 OR col1 < 728.43))) OR col0 < 325 OR col0 <= 269 OR (col3 < 90) OR col0 > 272 OR (col1 = 709.19) AND ((col1 = 528.89 AND col4 > 615.56)));

SELECT pk FROM tab1 WHERE NOT (col1 < 882.94);

INSERT INTO tab0 VALUES(27,105,264.71,'itppe',724,525.56,'awqfr');

DELETE FROM tab3 WHERE col0 = 473 OR col0 <= 699 OR col0 < 435;

INSERT INTO tab0 VALUES(91,915,934.54,'mtmcy',513,22.24,'pbtjw');

INSERT INTO tab0 VALUES(56,22,394.62,'yhojb',389,843.56,'lmyxu');

DELETE FROM tab2 WHERE (col3 >= 174);

INSERT INTO tab0 VALUES(58,527,778.33,'oiaro',960,372.77,'uabyq');

SELECT pk FROM tab3 WHERE (col3 >= 443);

INSERT INTO tab0 VALUES(77,52,562.48,'wlyfu',378,88.42,'iigcz');

INSERT INTO tab0 VALUES(44,644,760.27,'jxyxf',110,736.3,'ogczz');

INSERT INTO tab0 VALUES(40,974,791.95,'bfati',545,238.5,'pgxie');

INSERT INTO tab0 VALUES(35,701,400.63,'wcuii',23,668.45,'ntdmm');

SELECT pk FROM tab4 WHERE col1 > 577.97;

INSERT INTO tab0 VALUES(5,124,328.69,'jmwiz',71,967.42,'xngua');

DELETE FROM tab0 WHERE col1 = 337.42 AND col3 >= 675;

INSERT INTO tab0 VALUES(97,295,97.76,'gnhux',702,89.56,'ipzea');

SELECT pk FROM tab0 WHERE col0 = 342 OR col1 > 66.62;

SELECT pk FROM tab4 WHERE col3 = 512 AND ((col3 >= 226) OR (col0 >= 20) AND ((col0 >= 239 OR col4 < 145.87 AND col0 = 3 AND col3 >= 909))) OR (col3 >= 503 AND col0 >= 482);

INSERT INTO tab0 VALUES(5,187,219.15,'mdcoo',143,325.59,'todly');

SELECT pk FROM tab0 WHERE NOT (((col1 < 937.25 AND col4 > 158.93 OR col3 = 754 OR (col4 <= 676.93)) AND ((col4 > 240.69) AND col0 = 234 AND (col3 < 92 AND (col3 >= 116 AND col3 > 997 AND (col0 > 93) AND ((col3 < 502)) AND ((col1 > 43.17 OR ((col3 > 957)) OR col4 >= 367.61 AND (col3 BETWEEN 953 AND 100))))) OR col3 BETWEEN 295 AND 59)) AND (col3 IN (996,695,656,707)) OR col3 BETWEEN 215 AND 838 AND col0 >= 915);

INSERT INTO tab0 VALUES(39,337,150.49,'fbguo',269,140.23,'rhzpy');

INSERT INTO tab0 VALUES(6,190,969.96,'hxclh',749,688.50,'wpoup');

SELECT pk FROM tab0 WHERE NOT ((col4 <= 143.30));

SELECT pk FROM tab4 WHERE col3 <= 445;

SELECT pk FROM tab1 WHERE NOT (col3 < 216);

INSERT INTO tab0 VALUES(72,152,876.70,'tbkim',975,84.23,'cukbp');

SELECT pk FROM tab2 WHERE NOT (col1 IN (730.83,559.76,16.22));

INSERT INTO tab0 VALUES(90,750,806.35,'ppqki',166,982.71,'jfqnr');

INSERT INTO tab0 VALUES(85,633,958.13,'depzo',815,850.19,'pjbrs');

INSERT INTO tab0 VALUES(66,383,643.96,'kidpx',993,651.71,'zsxkv');

INSERT INTO tab0 VALUES(14,177,971.11,'fjusk',555,726.76,'ujyyg');

INSERT INTO tab0 VALUES(9,298,948.69,'kzhja',114,28.45,'johzr');

DELETE FROM tab2 WHERE ((col0 >= 518) AND ((col1 >= 297.96)) AND col3 > 842) OR ((col0 < 735 AND (((((col3 >= 75) OR col3 <= 601 AND col0 < 742 AND col4 < 142.23 OR col1 BETWEEN 929.58 AND 479.1 AND (col3 > 991 OR (col4 <= 147.38 AND col3 < 775 OR col0 IN (463,323)) AND col0 <= 426 OR col3 > 339) AND col3 >= 479 AND col3 BETWEEN 107 AND 453 OR col3 < 418)) AND col3 > 425 AND (col3 <= 76)) OR (col3 > 490)))) OR ((col3 <= 60)) AND col0 IS NULL AND ((col0 >= 189));

INSERT INTO tab0 VALUES(88,767,881.39,'teops',886,108.42,'beytq');

INSERT INTO tab0 VALUES(85,706,990.50,'zumch',308,604.85,'yxrsv');

INSERT INTO tab0 VALUES(63,99,480.99,'rxelp',641,784.37,'kvwrz');

INSERT INTO tab0 VALUES(43,568,963.32,'avkir',31,514.99,'ptbvr');

DELETE FROM tab3 WHERE col3 <= 633;

DELETE FROM tab2 WHERE col3 < 159;

INSERT INTO tab0 VALUES(13,428,104.73,'vjwdw',350,527.99,'eujyu');

SELECT pk FROM tab2 WHERE NOT (col1 > 807.16);

INSERT INTO tab0 VALUES(60,504,850.36,'kfhde',409,107.66,'ixent');

INSERT INTO tab0 VALUES(11,384,799.15,'ymzvt',39,879.91,'fkjdq');

SELECT pk FROM tab2 WHERE col3 = 459 OR col1 >= 872.54 OR col3 < 869 OR (col0 <= 279);

DELETE FROM tab1 WHERE col3 < 161 OR col1 = 596.50;

INSERT INTO tab0 VALUES(10,866,306.56,'ofurr',802,81.28,'vhgvt');

SELECT pk FROM tab1 WHERE NOT (col1 >= 248.64);

INSERT INTO tab0 VALUES(87,625,852.52,'qvkkc',200,170.94,'vinvs');

SELECT pk FROM tab2 WHERE col0 >= 289 AND ((col3 = 123)) OR (col0 < 422) AND ((((col1 <= 750.83 AND (((col4 >= 447.48))))))) AND col3 > 689 AND (((col3 >= 818)) OR col0 < 366 AND (col3 < 59)) AND ((col3 <= 20));

INSERT INTO tab0 VALUES(74,783,640.45,'frmwu',587,1000.66,'yvyem');

INSERT INTO tab0 VALUES(55,426,196.90,'vetzm',786,631.50,'zutgp');

INSERT INTO tab0 VALUES(48,146,626.92,'qxbsi',308,238.33,'blnpc');

INSERT INTO tab0 VALUES(42,601,81.33,'ugkim',64,267.14,'bfbhx');

INSERT INTO tab0 VALUES(21,947,595.92,'hdksc',174,766.96,'dobju');

SELECT pk FROM tab0 WHERE col3 <= 0 AND col3 IS NULL AND col0 >= 778 AND col1 = 178.10 OR (col0 <= 586) OR col3 > 250 AND col0 = 611 OR col3 IS NULL;

INSERT INTO tab0 VALUES(98,601,762.79,'ivond',628,998.5,'vrtsl');

INSERT INTO tab0 VALUES(78,425,851.54,'xvkgy',765,702.58,'kkvek');

INSERT INTO tab0 VALUES(28,832,571.61,'vdrhs',181,376.0,'ezzjd');

INSERT INTO tab0 VALUES(40,443,882.58,'fhlag',437,931.68,'emiqx');

DELETE FROM tab2 WHERE (((col0 > 325) OR col3 < 131 AND ((((col3 >= 602)) AND col0 <= 884) AND col3 > 421))) OR col3 > 432;

SELECT pk FROM tab0 WHERE NOT ((((col0 > 906))));

INSERT INTO tab0 VALUES(84,565,730.51,'qhioj',549,522.36,'bfpre');

SELECT pk FROM tab1 WHERE NOT (col3 > 675 OR col4 >= 312.3 AND (col3 >= 562 OR (col0 = 285)) AND col4 < 638.35);

SELECT pk FROM tab0 WHERE NOT ((col4 > 568.96 AND col1 < 194.14));

INSERT INTO tab0 VALUES(24,280,832.83,'sfcjv',596,235.37,'lgvla');

SELECT pk FROM tab1 WHERE (col4 IS NULL AND ((col3 = 989)) AND ((col3 > 964))) AND (col0 < 481 AND (col4 < 448.80)) OR col0 BETWEEN 950 AND 385;

CREATE UNIQUE INDEX idx_tab3_5 ON tab3 (col3,col0 DESC,col4 DESC);

INSERT INTO tab0 VALUES(51,816,830.63,'rurft',455,131.28,'jqafk');

INSERT INTO tab0 VALUES(75,540,48.86,'cpbot',733,717.74,'zgkoz');

DELETE FROM tab3 WHERE col1 >= 887.13;

INSERT INTO tab0 VALUES(91,634,638.13,'eqdjc',846,644.67,'mgawd');

INSERT INTO tab0 VALUES(72,476,965.68,'emiwa',835,174.62,'lmqkm');

SELECT pk FROM tab2 WHERE NOT ((col4 IN (619.66,828.18)));

SELECT pk FROM tab1 WHERE NOT (((col0 >= 420 OR col0 > 870) OR (col0 <= 559 AND (col1 >= 771.83) AND col0 >= 435 AND (col3 >= 408 OR col0 > 344 AND col4 < 131.37)) AND col3 > 746 OR col4 > 790.61 OR col0 < 997) OR col4 > 964.78);

SELECT pk FROM tab0 WHERE NOT (col0 <= 889);

INSERT INTO tab0 VALUES(84,741,160.46,'gbrjg',224,870.2,'btdmp');

INSERT INTO tab0 VALUES(35,780,497.27,'ibreh',854,546.64,'rpjhs');

INSERT INTO tab0 VALUES(17,531,429.25,'btxgn',563,454.46,'qdarl');

INSERT INTO tab0 VALUES(44,485,485.71,'qoqxc',74,879.93,'czysg');

INSERT INTO tab0 VALUES(7,89,265.96,'bagis',635,71.1,'coald');

SELECT pk FROM tab1 WHERE ((col3 < 358) OR col4 = 392.73) AND col3 <= 785;

INSERT INTO tab0 VALUES(86,765,991.2,'rjexd',106,832.70,'pvnym');

DELETE FROM tab2 WHERE ((col1 >= 803.99) OR (col0 < 753) OR col1 > 375.16);

DELETE FROM tab1 WHERE col3 < 39;

SELECT pk FROM tab3 WHERE col3 = 740 OR (col4 > 43.61) OR (col1 IS NULL);

DELETE FROM tab2 WHERE (col4 < 926.58) AND ((col1 < 155.53 OR col3 = 804 AND ((col0 IS NULL))) OR ((col0 < 342 AND col1 IS NULL)) AND (col0 >= 107) OR ((col3 >= 375 OR col3 BETWEEN 687 AND 30 AND col0 < 335))) AND (col1 >= 104.84 AND (((col0 >= 508))) AND col3 BETWEEN 124 AND 893) AND col4 >= 46.48;

INSERT INTO tab0 VALUES(58,785,932.28,'vxnud',763,61.12,'lmoqf');

INSERT INTO tab0 VALUES(9,142,924.4,'bxwja',443,261.42,'lggcq');

SELECT pk FROM tab1 WHERE col0 > 887;

CREATE INDEX idx_tab3_4 ON tab3 (col3 DESC,col1 DESC);

SELECT pk FROM tab1 WHERE NOT (col4 = 479.53 AND col1 = 256.73 OR (((col4 IN (538.4))) OR col4 IS NULL AND col1 <= 404.5 OR ((col1 >= 735.62) AND col3 > 450 AND col3 > 647 OR ((col4 IS NULL)) AND col1 < 358.75 OR col1 < 578.24 AND col0 > 138 AND (col3 < 290) AND col3 <= 832 AND col0 <= 689) AND col1 >= 285.25 OR (col4 > 47.38) OR col4 >= 390.78 AND col0 IS NULL) OR col1 = 513.89 OR col3 < 13);

DELETE FROM tab0 WHERE (col0 > 252);

INSERT INTO tab0 VALUES(97,75,120.88,'annxe',305,567.53,'xvynn');

INSERT INTO tab0 VALUES(77,233,178.52,'zlwhy',138,395.79,'gxgrt');

SELECT pk FROM tab4 WHERE (col3 < 252) OR col4 >= 598.68;

DELETE FROM tab3 WHERE col3 < 482;

INSERT INTO tab0 VALUES(91,284,932.14,'qkshd',715,114.20,'nwaba');

INSERT INTO tab0 VALUES(58,540,926.53,'jmxup',478,596.73,'ewshh');

SELECT pk FROM tab2 WHERE col3 < 885;

DELETE FROM tab1 WHERE (col0 = 448);

INSERT INTO tab0 VALUES(25,729,307.57,'qtftd',154,315.92,'usdny');

INSERT INTO tab0 VALUES(6,939,846.20,'tdogj',552,410.33,'udief');

INSERT INTO tab0 VALUES(3,542,841.92,'crbbq',192,334.11,'nozvs');

SELECT pk FROM tab4 WHERE col3 = 309 AND col3 = 305 OR (col1 IN (273.54,750.75,93.66,923.82,751.71)) AND (((col3 >= 501))) OR col1 <= 935.38 AND ((col3 = 45));

SELECT pk FROM tab1 WHERE NOT ((col1 >= 304.81 AND (col4 >= 84.85 OR col3 < 446 AND (col0 > 32))));

SELECT pk FROM tab0 WHERE col0 > 973 AND ((col4 < 9.32)) AND ((col4 < 268.79)) OR (col0 = 653 AND (col0 < 596 OR col0 >= 845));

SELECT pk FROM tab2 WHERE NOT ((col1 > 263.58));

SELECT pk FROM tab1 WHERE col0 <= 324 OR (col4 < 914.5);

INSERT INTO tab0 VALUES(86,753,846.22,'ccwsk',833,286.73,'lcljq');

INSERT INTO tab0 VALUES(37,333,658.92,'qpxwt',229,185.68,'mpedn');

INSERT INTO tab0 VALUES(60,264,43.16,'mqoxm',795,932.91,'lbfbx');

INSERT INTO tab0 VALUES(42,632,700.23,'qbfhe',371,366.78,'vwrvk');

INSERT INTO tab0 VALUES(4,861,859.43,'ykjwk',368,131.35,'qzplh');

DELETE FROM tab0 WHERE col3 IN (450) OR ((col3 < 159));

INSERT INTO tab0 VALUES(52,338,840.75,'rrscc',395,138.38,'lrppz');

SELECT pk FROM tab1 WHERE col3 > 819 OR (((col3 = 793 OR col4 < 575.53))) AND (col4 >= 563.34 OR (col4 IN (768.25)));

INSERT INTO tab0 VALUES(71,982,712.93,'dcnbn',923,747.8,'kpnsj');

INSERT INTO tab0 VALUES(53,274,997.84,'xprfq',583,593.27,'pnmtn');

INSERT INTO tab0 VALUES(79,486,339.81,'qyygl',819,845.44,'jptme');

INSERT INTO tab0 VALUES(0,731,616.20,'cxjyc',293,989.51,'abpvj');

DELETE FROM tab4 WHERE (col4 > 321.2) AND (((col0 <= 502 AND col0 IS NULL)) OR col4 = 59.27 AND col3 >= 320 OR col0 > 970);

INSERT INTO tab0 VALUES(79,215,721.87,'eiobo',270,989.57,'dhgcl');

DELETE FROM tab2 WHERE ((col3 IS NULL) OR col4 > 866.35);

INSERT INTO tab0 VALUES(28,389,360.54,'ddxuq',943,744.74,'ajhyj');

INSERT INTO tab0 VALUES(40,460,897.35,'xdbyk',158,613.56,'xnvpz');

DELETE FROM tab2 WHERE col3 <= 80;

INSERT INTO tab0 VALUES(88,981,144.93,'ndbqh',820,378.74,'fmtmr');

DELETE FROM tab3 WHERE col3 = 408 AND col0 IS NULL OR col0 > 430;

INSERT INTO tab0 VALUES(61,142,72.10,'ahuse',347,316.2,'rduzd');

INSERT INTO tab0 VALUES(27,584,795.5,'cqdel',560,339.26,'epzfx');

DELETE FROM tab3 WHERE (col3 > 589);

SELECT pk FROM tab0 WHERE (((col1 > 629.14)));

INSERT INTO tab0 VALUES(38,854,7.16,'niobx',865,23.87,'mkliw');

INSERT INTO tab0 VALUES(17,938,208.21,'xurtg',706,861.54,'ohiec');

SELECT pk FROM tab4 WHERE ((((col3 < 413) OR col3 > 456 OR col3 < 47)));

INSERT INTO tab0 VALUES(9,147,58.68,'boiet',448,497.36,'xrbnq');

SELECT pk FROM tab1 WHERE col3 < 263;

INSERT INTO tab0 VALUES(71,910,900.93,'zjezj',537,173.98,'giabk');

INSERT INTO tab0 VALUES(53,645,132.40,'qkfub',424,788.81,'fpzoc');

INSERT INTO tab0 VALUES(35,888,166.4,'yczbd',732,699.18,'lhyuk');

SELECT pk FROM tab0 WHERE NOT ((col0 = 352) OR (col3 >= 700));

INSERT INTO tab0 VALUES(99,594,219.89,'gjabe',432,415.29,'tsfzp');

INSERT INTO tab0 VALUES(65,415,453.41,'pmdyv',78,418.19,'pfirp');

SELECT pk FROM tab0 WHERE NOT (((col3 > 596 AND col3 IS NULL AND ((col0 = 387)))) OR col0 > 176);

SELECT pk FROM tab4 WHERE (((col3 >= 374)));

INSERT INTO tab0 VALUES(80,317,265.85,'hexrc',850,640.34,'kaill');

SELECT pk FROM tab0 WHERE NOT (col0 IN (93,851,351,608));

INSERT INTO tab0 VALUES(84,475,729.37,'xkaql',28,429.88,'mmljh');

SELECT pk FROM tab1 WHERE col4 < 88.3;

INSERT INTO tab0 VALUES(71,708,415.97,'rsvdr',64,58.86,'syurz');

SELECT pk FROM tab2 WHERE NOT ((col3 <= 789));

DELETE FROM tab1 WHERE col3 > 579;

INSERT INTO tab0 VALUES(40,328,355.38,'jkwno',281,352.38,'ubrlr');

SELECT pk FROM tab2 WHERE (col0 > 632 AND ((col3 <= 328) AND col0 < 168 OR (col3 >= 720 AND col4 <= 759.93 OR (col3 < 241 OR col0 IN (633) AND ((((((col3 > 782)))))) OR col1 = 794.72) AND col0 < 681 AND col1 <= 652.49 AND col4 < 797.41)) AND ((col0 < 991)) OR col0 > 865) OR col4 = 352.43 AND (col3 IS NULL AND ((((col0 > 415))))) OR (col0 < 694);

INSERT INTO tab0 VALUES(44,753,199.5,'ojcat',901,410.99,'ljkia');

INSERT INTO tab0 VALUES(24,561,644.13,'bxukj',924,187.27,'juatz');

INSERT INTO tab0 VALUES(6,645,731.55,'dynob',109,916.41,'wbdeo');

DELETE FROM tab0 WHERE (col3 IS NULL AND col0 = 451);

INSERT INTO tab0 VALUES(52,429,58.94,'cetzi',287,257.37,'sxpeq');

INSERT INTO tab0 VALUES(33,72,531.52,'tafqu',379,161.8,'lrggw');

INSERT INTO tab0 VALUES(30,982,608.20,'ajzpf',136,107.83,'skcue');

SELECT pk FROM tab3 WHERE NOT (col1 >= 610.48);

INSERT INTO tab0 VALUES(78,139,844.84,'cifyp',437,671.4,'zpxsl');

INSERT INTO tab0 VALUES(14,392,110.45,'bgfto',423,363.79,'kjzph');

SELECT pk FROM tab3 WHERE NOT ((col0 > 725) OR col3 > 111 AND col0 < 623);

INSERT INTO tab0 VALUES(48,126,920.22,'ooyrt',352,735.86,'qgrev');

INSERT INTO tab0 VALUES(29,355,59.43,'sqegg',761,37.75,'kcbjw');

INSERT INTO tab0 VALUES(56,93,450.11,'bonpc',622,563.24,'phwqd');

SELECT pk FROM tab2 WHERE col3 < 606;

DELETE FROM tab1 WHERE (col3 > 254) AND col0 <= 282 AND col4 > 586.94;

INSERT INTO tab0 VALUES(85,870,41.1,'aqldv',459,439.11,'mxglu');

INSERT INTO tab0 VALUES(66,679,610.70,'cfdnb',497,628.66,'xpcrx');

SELECT pk FROM tab4 WHERE NOT (col4 = 983.33);

SELECT pk FROM tab3 WHERE NOT (col0 < 500);

INSERT INTO tab0 VALUES(33,917,407.28,'mhlqq',358,617.27,'znulm');

INSERT INTO tab0 VALUES(45,195,848.36,'wicpt',776,895.11,'cnmhm');

INSERT INTO tab0 VALUES(27,572,934.45,'nqjra',347,471.15,'ushvb');

DELETE FROM tab3 WHERE col0 BETWEEN 916 AND 433;

INSERT INTO tab0 VALUES(61,517,868.93,'lawta',146,180.85,'tatlv');

SELECT pk FROM tab3 WHERE col3 < 206;

INSERT INTO tab0 VALUES(62,20,983.18,'mqven',789,647.14,'erfuy');

SELECT pk FROM tab4 WHERE NOT (col0 <= 201);

DELETE FROM tab2 WHERE col3 = 620;

INSERT INTO tab0 VALUES(58,319,238.61,'gfwae',570,824.61,'oihge');

SELECT pk FROM tab2 WHERE NOT (col3 < 307 OR col4 <= 181.38 OR col3 < 130);

SELECT pk FROM tab1 WHERE col0 < 270;

SELECT pk FROM tab3 WHERE NOT (col3 <= 591);

SELECT pk FROM tab2 WHERE ((col3 < 931 AND (((((col0 < 303)))))));

INSERT INTO tab0 VALUES(59,46,52.69,'jiuke',949,553.23,'ogyoo');

INSERT INTO tab0 VALUES(40,402,179.13,'xsdwi',454,200.57,'yvhcl');

INSERT INTO tab0 VALUES(37,529,795.66,'andyo',383,745.50,'uluui');

INSERT INTO tab0 VALUES(19,597,269.2,'rwbkg',656,264.35,'gxzqi');

INSERT INTO tab0 VALUES(14,740,164.38,'joyvj',427,225.1,'nnvtz');

INSERT INTO tab0 VALUES(25,929,432.73,'yzpav',500,621.22,'yjkcf');

SELECT pk FROM tab1 WHERE NOT (col3 < 495 AND ((col0 <= 719)));

INSERT INTO tab0 VALUES(42,13,791.24,'hytbz',602,777.55,'bldnq');

INSERT INTO tab0 VALUES(68,961,966.18,'orgnt',221,427.91,'nujai');

INSERT INTO tab0 VALUES(34,850,669.7,'decwk',143,978.42,'rjefp');

SELECT pk FROM tab4 WHERE NOT ((col3 > 829));

INSERT INTO tab0 VALUES(66,471,571.24,'ygvvo',906,23.78,'cctxy');

INSERT INTO tab0 VALUES(77,599,352.8,'voses',883,123.4,'rduia');

SELECT pk FROM tab3 WHERE NOT (col4 <= 88.47);

INSERT INTO tab0 VALUES(78,764,582.68,'ttovc',550,952.91,'myuyg');

INSERT INTO tab0 VALUES(14,937,209.70,'yjwxo',961,41.98,'iakjl');

SELECT pk FROM tab3 WHERE col1 > 701.87;

INSERT INTO tab0 VALUES(62,407,261.81,'kmekd',784,624.46,'ppxeb');

INSERT INTO tab0 VALUES(74,281,603.97,'qkyxl',698,81.69,'asxil');

INSERT INTO tab0 VALUES(10,417,27.76,'xvlwv',877,619.61,'wedvv');

INSERT INTO tab0 VALUES(6,429,237.54,'jisuj',16,714.88,'onsqp');

SELECT pk FROM tab0 WHERE NOT (col0 < 748);

INSERT INTO tab0 VALUES(84,589,977.79,'urdrh',627,448.97,'nrocd');

INSERT INTO tab0 VALUES(66,111,227.12,'nawtt',566,553.95,'zvknq');

DELETE FROM tab1 WHERE ((col3 IN (670,121,649,553,503,805))) AND col4 < 676.73 AND col1 >= 292.55;

INSERT INTO tab0 VALUES(55,827,865.96,'lxlsf',162,341.43,'htmeq');

INSERT INTO tab0 VALUES(22,954,652.59,'aibfd',376,117.60,'atndj');

INSERT INTO tab0 VALUES(31,413,536.63,'mmspw',122,802.40,'ecfte');

DELETE FROM tab4 WHERE col1 < 251.58;

INSERT INTO tab0 VALUES(94,989,356.0,'yrvxv',559,346.35,'phpfv');

INSERT INTO tab0 VALUES(45,859,529.45,'fxwiu',161,980.50,'kmybt');

INSERT INTO tab0 VALUES(38,284,839.0,'kujlm',809,443.63,'hqday');

SELECT pk FROM tab1 WHERE col1 < 921.29;

INSERT INTO tab0 VALUES(41,468,235.48,'yvczu',740,829.88,'xktkc');

INSERT INTO tab0 VALUES(37,212,107.99,'eyyfp',149,296.12,'qeokw');

DELETE FROM tab1 WHERE (col3 <= 673);

INSERT INTO tab0 VALUES(70,261,489.26,'enpmg',487,267.81,'ceggg');

INSERT INTO tab0 VALUES(82,789,51.80,'kdofy',303,694.94,'ufdfr');

INSERT INTO tab0 VALUES(3,204,922.21,'lovnn',323,26.39,'uuqte');

SELECT pk FROM tab4 WHERE NOT (col0 < 821 OR col3 > 119);

SELECT pk FROM tab3 WHERE NOT ((col0 > 82));

INSERT INTO tab0 VALUES(78,794,388.29,'efihx',359,644.18,'bkkwm');

SELECT pk FROM tab4 WHERE NOT (((col0 > 810) AND (col3 >= 561) OR (col0 < 31) AND ((((col1 > 543.5 AND (col0 = 526) OR ((col1 IS NULL))) AND col0 >= 131)))));

INSERT INTO tab0 VALUES(96,409,204.39,'devhj',341,788.98,'wwzwa');

INSERT INTO tab0 VALUES(48,178,767.12,'qxizk',152,748.93,'odfpx');

INSERT INTO tab0 VALUES(44,633,939.19,'awowf',719,981.57,'gvirq');

INSERT INTO tab0 VALUES(41,370,90.49,'myycs',326,235.84,'osazc');

INSERT INTO tab0 VALUES(7,21,496.42,'lwcve',350,743.79,'qpfgb');

SELECT pk FROM tab4 WHERE NOT (col0 < 834);

INSERT INTO tab0 VALUES(96,187,600.88,'bbyth',435,513.60,'hfqrb');

DELETE FROM tab1 WHERE col0 <= 81 AND (col3 < 4);

CREATE UNIQUE INDEX idx_tab4_2 ON tab4 (col3 DESC,col4,col0);

INSERT INTO tab0 VALUES(36,307,515.26,'emamf',884,615.19,'olmur');

SELECT pk FROM tab0 WHERE NOT ((col0 = 510));

SELECT pk FROM tab4 WHERE (col3 >= 836) AND ((col0 < 467) AND (col4 = 864.46 OR (col3 > 882 AND (col4 >= 963.19 AND (col3 > 735) AND col3 > 129 OR col4 >= 643.0) OR col3 >= 662 AND col3 > 568 OR ((col4 < 920.60))) AND (col0 = 381) OR (col0 = 595)) AND (col0 = 976 AND (((col3 < 21) AND col0 < 131)))) OR (((col0 < 756) AND (col1 >= 874.64) OR col3 IS NULL AND col0 = 800)) OR col1 > 179.11 AND col3 > 588 OR ((col0 > 363 AND col0 < 206)) OR col3 = 370 AND col4 > 999.55;

INSERT INTO tab0 VALUES(95,202,508.0,'asguh',836,998.35,'ogmmp');

SELECT pk FROM tab1 WHERE (col3 > 826) AND col4 IS NULL OR (col3 > 745) AND ((((col0 >= 645)))) OR col3 > 611 AND (((col3 < 583) OR ((col4 IN (299.89,629.76) OR col3 > 266 AND col3 > 714)))) AND col0 IS NULL AND (col0 >= 868 AND ((col1 = 930.0)) OR col1 = 725.8) OR (col0 >= 477);

INSERT INTO tab0 VALUES(41,224,243.82,'sypaa',542,628.15,'tgsej');

INSERT INTO tab0 VALUES(66,514,139.49,'rebgs',567,72.93,'dwysq');

INSERT INTO tab0 VALUES(61,928,698.41,'pfuxr',110,605.45,'xeiet');

DELETE FROM tab4 WHERE (col3 IS NULL) AND ((col4 <= 246.45) OR col3 >= 783 OR (col4 >= 723.85) OR ((col4 < 537.2) AND col1 > 738.78 OR ((col3 IS NULL))));

INSERT INTO tab0 VALUES(19,630,307.40,'jlyaw',719,683.95,'veqrt');

INSERT INTO tab0 VALUES(44,31,868.18,'wbrfr',327,389.42,'qtxky');

INSERT INTO tab0 VALUES(24,730,777.73,'axyln',738,451.91,'yiuwh');

INSERT INTO tab0 VALUES(51,72,441.35,'fjpje',646,492.3,'hgazv');

DELETE FROM tab1 WHERE (col0 > 396 AND col0 > 315 OR col1 <= 774.13 OR col0 = 478 OR col0 > 171 OR col1 > 563.50 AND (col3 = 930));

DELETE FROM tab0 WHERE col0 < 622 OR col0 <= 487 OR ((col3 <= 976));

SELECT pk FROM tab3 WHERE col3 >= 84;

INSERT INTO tab0 VALUES(17,833,230.65,'eualh',922,932.42,'wvqkn');

INSERT INTO tab0 VALUES(13,648,838.33,'pdjhp',371,997.31,'zzxjb');

SELECT pk FROM tab3 WHERE col4 > 467.59;

INSERT INTO tab0 VALUES(62,709,560.69,'fhhcz',468,230.63,'fzzcs');

SELECT pk FROM tab4 WHERE col3 < 556;

SELECT pk FROM tab1 WHERE NOT ((col0 > 108));

INSERT INTO tab0 VALUES(2,203,16.94,'vfbre',560,190.61,'noats');

SELECT pk FROM tab4 WHERE NOT ((col0 > 159 AND col1 = 371.24));

SELECT pk FROM tab2 WHERE NOT (col4 < 180.52);

INSERT INTO tab0 VALUES(45,138,967.63,'eflez',322,634.51,'ihgbm');

SELECT pk FROM tab3 WHERE (col0 = 64);

INSERT INTO tab0 VALUES(77,256,919.8,'vghep',785,501.31,'tcsls');

INSERT INTO tab0 VALUES(28,539,387.71,'irvtw',591,635.4,'gtobe');

SELECT pk FROM tab2 WHERE (col1 IN (749.30,832.25,834.5,542.97,826.76)) OR col0 < 15;

INSERT INTO tab0 VALUES(89,87,471.65,'uuxux',365,694.10,'frakv');

SELECT pk FROM tab3 WHERE col0 < 672;

SELECT pk FROM tab2 WHERE col0 = 284;

INSERT INTO tab0 VALUES(29,536,936.41,'vxswa',838,703.7,'zxnwr');

INSERT INTO tab0 VALUES(10,5195,2091.80,'jcufr',1791,1206.4,'ueafw');

INSERT INTO tab0 VALUES(137,7850,6825.66,'sdhxz',8668,2412.96,'rfoox');

INSERT INTO tab0 VALUES(264,6674,3602.24,'jdhie',6671,321.35,'flbli');

INSERT INTO tab0 VALUES(391,2703,5253.91,'qlzkq',968,5368.29,'nrmwa');

INSERT INTO tab0 VALUES(518,1524,956.13,'jdcrj',4402,4963.78,'ysejf');

INSERT INTO tab0 VALUES(645,7024,4985.85,'eqrwb',1242,2239.10,'zcwlh');

INSERT INTO tab0 VALUES(772,5143,5461.84,'avwfw',930,4799.18,'feowq');

INSERT INTO tab0 VALUES(899,7618,3105.11,'guwvk',1838,3471.99,'zpies');

SELECT pk FROM tab3 WHERE (col0 = 8287);

INSERT INTO tab0 VALUES(62,4398,8843.78,'lovna',2911,3514.78,'yxayr');

INSERT INTO tab0 VALUES(189,4117,1390.97,'rtfni',7420,477.75,'enjiv');

INSERT INTO tab0 VALUES(316,364,6864.2,'ntnoc',4326,4790.66,'sogkn');

INSERT INTO tab0 VALUES(443,6958,4730.83,'flssk',1423,3997.96,'aadbp');

INSERT INTO tab0 VALUES(570,7591,4862.14,'jnedf',9502,6674.79,'lfvyh');

INSERT INTO tab0 VALUES(697,9563,6296.97,'szljg',6087,1181.37,'hxlzg');

INSERT INTO tab0 VALUES(824,7537,5980.94,'hofsy',9191,4415.35,'jyfsh');

INSERT INTO tab0 VALUES(951,7291,7514.70,'yvzqf',1066,559.19,'fjkni');

INSERT INTO tab0 VALUES(1,7185,5877.15,'ruvpk',6918,514.25,'yaofh');

INSERT INTO tab0 VALUES(128,3980,5516.33,'pgjey',8770,991.13,'sagbw');

INSERT INTO tab0 VALUES(255,7554,1614.4,'cdrva',4275,6843.0,'feriv');

INSERT INTO tab0 VALUES(382,3868,2237.7,'crihn',1022,1241.13,'awwol');

INSERT INTO tab0 VALUES(509,8429,6795.82,'ugzjp',9275,9329.18,'jcxjt');

INSERT INTO tab0 VALUES(636,46,4795.65,'iebqn',5724,6973.63,'izqul');

INSERT INTO tab0 VALUES(763,4580,4597.27,'atppp',7236,9512.8,'iytqu');

INSERT INTO tab0 VALUES(890,8693,2154.12,'wweew',4602,509.69,'gikan');

INSERT INTO tab0 VALUES(17,7514,7663.51,'rdcjw',3605,7518.86,'noxnl');

INSERT INTO tab0 VALUES(144,295,9165.1,'rwqlj',7062,2866.18,'uumjl');

INSERT INTO tab0 VALUES(271,5382,5200.21,'vpwqd',5746,7266.88,'ghrxk');

INSERT INTO tab0 VALUES(398,1205,8912.64,'fnqlz',3547,7486.37,'cjsmf');

INSERT INTO tab0 VALUES(525,5591,5261.28,'lwnda',1873,7734.88,'kjzrf');

INSERT INTO tab0 VALUES(652,9509,9776.94,'skrgv',3405,8410.74,'rwere');

INSERT INTO tab0 VALUES(779,824,7299.64,'osqyz',5840,4856.83,'xcxla');

INSERT INTO tab0 VALUES(906,8046,740.97,'toljf',5648,6105.90,'khsiv');

DELETE FROM tab1 WHERE (col3 <= 5916) AND (((((((col0 > 4438))))) AND col0 > 1754 OR (col3 < 1318) AND (col3 < 3657) AND col0 >= 9755)) OR ((col3 < 1107) AND col4 >= 22.28) AND col1 < 815.16 AND (col3 >= 8952 AND (col3 < 4663) AND (col3 <= 7082) OR col1 < 8946.10 OR ((col0 < 2780)) AND col3 >= 841 AND (col0 <= 1838 OR (col3 < 3545)) AND col4 = 586.31) AND ((((col3 = 2943) OR col1 > 7442.97 AND col0 = 1402))) AND col3 = 1508;

INSERT INTO tab0 VALUES(70,9358,2002.72,'qryfe',5083,7331.49,'uzkgr');

INSERT INTO tab0 VALUES(197,4032,3951.96,'pkmnp',2452,5773.17,'bpjum');

INSERT INTO tab0 VALUES(324,4653,8668.69,'qsfwj',524,6618.26,'ddcrp');

INSERT INTO tab0 VALUES(451,9397,8814.95,'bepjd',9303,7048.47,'kzsch');

INSERT INTO tab0 VALUES(578,9350,8317.40,'lahgd',2326,3638.66,'seiat');

INSERT INTO tab0 VALUES(705,7259,6126.22,'rvqup',5416,6109.76,'tgnyj');

INSERT INTO tab0 VALUES(832,6279,9960.91,'rncdz',5429,1074.64,'ldtve');

INSERT INTO tab0 VALUES(959,8728,56.27,'phkhj',9009,5793.95,'fzrae');

INSERT INTO tab0 VALUES(70,8070,1528.40,'gylin',4551,8176.42,'plrwy');

INSERT INTO tab0 VALUES(197,4257,9666.13,'akvee',7261,2979.3,'vxrcs');

INSERT INTO tab0 VALUES(324,906,579.27,'hrqan',6031,6426.50,'qtrzu');

INSERT INTO tab0 VALUES(451,3307,8092.78,'xxtxp',1489,6317.58,'lnuza');

INSERT INTO tab0 VALUES(578,125,5894.65,'rrwfo',3269,3439.14,'kofyd');

INSERT INTO tab0 VALUES(705,2156,1283.76,'publy',8758,5317.0,'tcuyb');

INSERT INTO tab0 VALUES(832,1074,8926.83,'ggxgc',1848,9964.86,'caifg');

INSERT INTO tab0 VALUES(959,8183,4597.21,'jydgl',1683,9632.14,'zuxae');

INSERT INTO tab0 VALUES(10,5144,9989.17,'wjbdu',823,216.16,'zuwsa');

INSERT INTO tab0 VALUES(137,3728,5966.76,'gtxly',2426,7074.25,'iujhl');

INSERT INTO tab0 VALUES(264,1680,7164.28,'wcujr',517,1074.72,'mztdr');

INSERT INTO tab0 VALUES(391,4658,5048.77,'dcxeg',2463,8554.13,'jyuci');

INSERT INTO tab0 VALUES(518,5214,397.46,'ziate',650,793.56,'hvdwe');

INSERT INTO tab0 VALUES(645,6544,2061.16,'pocxa',6234,2761.1,'xxmpe');

INSERT INTO tab0 VALUES(772,6240,5702.65,'edmwf',2889,1871.70,'cvfze');

INSERT INTO tab0 VALUES(899,38,2551.2,'ckkoz',561,6725.53,'uzkvx');

SELECT pk FROM tab3 WHERE col1 >= 5254.70;

INSERT INTO tab0 VALUES(122,77,2598.73,'mqozn',3727,7116.56,'xcqyb');

INSERT INTO tab0 VALUES(249,567,7201.24,'elrcj',6786,4750.69,'xftte');

INSERT INTO tab0 VALUES(376,3057,1901.38,'kodjg',5503,8542.53,'oideq');

INSERT INTO tab0 VALUES(503,9078,3047.99,'pgtpe',694,6979.26,'fyyaj');

INSERT INTO tab0 VALUES(630,9397,9273.18,'grxcq',5538,1460.17,'vsvkj');

INSERT INTO tab0 VALUES(757,7768,251.77,'rbgys',9329,5045.7,'vuabq');

INSERT INTO tab0 VALUES(884,4687,5435.64,'djuls',1222,1201.63,'aeyve');

INSERT INTO tab0 VALUES(11,9793,3875.8,'ppnzd',9084,4562.89,'jvhle');

INSERT INTO tab0 VALUES(138,6477,975.2,'ywuul',2426,1335.78,'bjymn');

INSERT INTO tab0 VALUES(265,8582,5098.36,'bplfq',8234,1026.20,'lmnoz');

INSERT INTO tab0 VALUES(392,7422,3239.73,'wglhq',7735,892.69,'txejq');

INSERT INTO tab0 VALUES(519,2300,8427.94,'vbuoj',3269,4855.79,'eoavf');

INSERT INTO tab0 VALUES(646,4257,8477.36,'qjcfo',2038,2238.43,'vpaiw');

INSERT INTO tab0 VALUES(773,9822,4739.30,'fxrnr',9859,6533.28,'nbtex');

INSERT INTO tab0 VALUES(900,4764,847.40,'mgjgt',4913,4139.13,'ramav');

SELECT pk FROM tab3 WHERE ((col4 >= 1867.93));

INSERT INTO tab0 VALUES(17,5872,3630.20,'icnvn',3974,7933.70,'hfzqg');

INSERT INTO tab0 VALUES(144,9395,5179.21,'mczkg',2691,5821.99,'wboae');

INSERT INTO tab0 VALUES(271,3323,6434.54,'nlamt',5604,5948.66,'qstrg');

INSERT INTO tab0 VALUES(398,3703,6443.31,'olryh',4961,8761.42,'yuaop');

INSERT INTO tab0 VALUES(525,744,1770.40,'kdcai',7797,345.28,'fqoos');

INSERT INTO tab0 VALUES(652,7561,251.29,'bfpyw',4676,6183.46,'ifqbd');

INSERT INTO tab0 VALUES(779,8933,4740.98,'asdcw',8457,4900.19,'zaagl');

INSERT INTO tab0 VALUES(906,47,6864.82,'sautp',3026,2018.67,'bygrz');

DELETE FROM tab0 WHERE (col0 > 3394);

INSERT INTO tab0 VALUES(52,9957,5515.94,'agcsn',4605,3348.77,'xxcxk');

INSERT INTO tab0 VALUES(179,6993,1657.88,'ywenj',6526,9085.30,'jqisx');

INSERT INTO tab0 VALUES(306,191,5874.94,'lmmqa',6661,8780.58,'jbdei');

INSERT INTO tab0 VALUES(433,8203,3159.32,'tauwm',4509,4873.57,'uxuzx');

INSERT INTO tab0 VALUES(560,5788,167.75,'mxjpt',8806,2095.58,'pxyik');

INSERT INTO tab0 VALUES(687,7572,3955.83,'rnujv',1276,6210.60,'qwpgb');

INSERT INTO tab0 VALUES(814,1793,750.41,'rlvbj',381,2765.68,'qfezm');

INSERT INTO tab0 VALUES(941,4053,4686.98,'wyjgs',5072,5846.32,'wiajl');

INSERT INTO tab0 VALUES(52,8485,2522.35,'kwfuk',7079,6797.19,'bqthn');

INSERT INTO tab0 VALUES(179,6647,8887.27,'xldbk',320,9254.64,'rnmse');

INSERT INTO tab0 VALUES(306,2009,9829.46,'cphch',3316,8151.94,'vtiop');

INSERT INTO tab0 VALUES(433,7287,3140.81,'ugdga',1664,2638.57,'nptfr');

INSERT INTO tab0 VALUES(560,2247,5453.55,'njuuo',1136,1334.16,'cqzsy');

INSERT INTO tab0 VALUES(687,7456,1009.61,'xkxku',1432,1082.88,'niulh');

INSERT INTO tab0 VALUES(814,8033,388.5,'btrmf',9924,5699.81,'ugmfx');

INSERT INTO tab0 VALUES(941,7396,9273.38,'vxkoc',5412,4722.29,'horwg');

DELETE FROM tab2 WHERE col3 >= 7956 AND col1 > 2656.41;

INSERT INTO tab0 VALUES(103,3284,6456.40,'iiect',7737,6802.2,'vhmah');

INSERT INTO tab0 VALUES(230,9953,2284.61,'sspxj',9655,127.76,'archg');

INSERT INTO tab0 VALUES(357,6314,138.39,'jsznr',4140,3881.43,'sbpvz');

INSERT INTO tab0 VALUES(484,458,6678.44,'zttej',8569,6866.11,'obqwg');

INSERT INTO tab0 VALUES(611,9715,854.82,'jcrmu',2687,793.1,'tmlzt');

INSERT INTO tab0 VALUES(738,4404,2646.23,'cfbzs',2349,9033.83,'aptgk');

INSERT INTO tab0 VALUES(865,1580,1824.48,'tcili',3271,5367.16,'lrnxw');

INSERT INTO tab0 VALUES(992,8789,6689.78,'ktddy',4788,2737.84,'kczqs');

INSERT INTO tab0 VALUES(59,8249,8238.95,'szgrj',2571,7312.59,'umekr');

INSERT INTO tab0 VALUES(186,4264,4017.0,'lpygz',4241,1970.97,'hhszx');

INSERT INTO tab0 VALUES(313,8273,3262.27,'eoziv',7944,5637.62,'okoff');

INSERT INTO tab0 VALUES(440,6020,8423.13,'otalq',5703,1923.54,'hrvib');

INSERT INTO tab0 VALUES(567,4759,7433.29,'fhhsh',6675,3048.17,'zpjit');

INSERT INTO tab0 VALUES(694,1992,7468.69,'zjtuy',5893,3601.22,'djfrx');

INSERT INTO tab0 VALUES(821,4229,8686.38,'nbnsv',3021,4279.58,'vowkw');

INSERT INTO tab0 VALUES(948,5732,7991.37,'jfmtg',1097,5645.17,'afvuw');

INSERT INTO tab0 VALUES(27,4373,3902.10,'zocvm',2177,2068.58,'pbtir');

INSERT INTO tab0 VALUES(154,1967,4174.69,'lsacb',7015,8026.98,'ugqfs');

INSERT INTO tab0 VALUES(281,8175,7595.14,'loten',571,6350.62,'yctwp');

INSERT INTO tab0 VALUES(408,4051,6934.83,'coahx',6158,3042.92,'efcaz');

INSERT INTO tab0 VALUES(535,8954,60.63,'ghyxx',8511,9829.56,'rvait');

INSERT INTO tab0 VALUES(662,4290,8689.24,'ccvwr',7545,2909.92,'tfdtv');

INSERT INTO tab0 VALUES(789,7266,7135.58,'eeazs',2097,1704.38,'otbyd');

INSERT INTO tab0 VALUES(916,4642,1059.17,'ifrfv',3683,7605.75,'aqmqg');

SELECT pk FROM tab4 WHERE col0 > 6577;

INSERT INTO tab0 VALUES(65,2353,2358.87,'rrify',6509,74.46,'ibkcl');

INSERT INTO tab0 VALUES(192,6011,6419.61,'gvxue',9430,444.82,'flkph');

INSERT INTO tab0 VALUES(319,5208,5744.70,'lnapv',4443,8451.22,'mozub');

INSERT INTO tab0 VALUES(446,526,9521.10,'fkmjy',7354,7612.31,'bgzjh');

INSERT INTO tab0 VALUES(573,9910,4855.42,'qqfqk',4458,9981.21,'kllms');

INSERT INTO tab0 VALUES(700,2420,5506.23,'unbal',6287,4896.82,'rhjhd');

INSERT INTO tab0 VALUES(827,1976,646.51,'qrruu',1366,7729.26,'isrjh');

INSERT INTO tab0 VALUES(954,1114,3609.96,'vnlbk',9949,8639.20,'grzxv');

INSERT INTO tab0 VALUES(49,5870,2215.87,'pxvsc',7416,4214.92,'nozxo');

INSERT INTO tab0 VALUES(176,1664,4562.33,'lkvby',1772,5011.36,'rfbjh');

INSERT INTO tab0 VALUES(303,3539,9218.44,'wekvw',605,2462.28,'mgrpu');

INSERT INTO tab0 VALUES(430,5656,9635.37,'qwyov',2207,7628.57,'orviq');

INSERT INTO tab0 VALUES(557,6727,5617.40,'iwdtk',2544,8543.5,'vsazm');

INSERT INTO tab0 VALUES(684,3765,2064.28,'ywdww',9012,8964.82,'jdaui');

INSERT INTO tab0 VALUES(811,5833,7722.61,'ddcay',4178,7121.61,'gqwlf');

INSERT INTO tab0 VALUES(938,7796,3937.21,'szibt',9539,4467.21,'nesea');

SELECT pk FROM tab1 WHERE NOT (col4 >= 3741.25);

INSERT INTO tab0 VALUES(102,3874,6692.93,'kcxau',9603,5097.62,'zjsyp');

INSERT INTO tab0 VALUES(229,1143,3808.70,'pglxj',8118,7459.88,'hcghb');

INSERT INTO tab0 VALUES(356,8976,5096.96,'pqtjr',4781,769.73,'sphmf');

INSERT INTO tab0 VALUES(483,4093,6335.20,'hocpa',4819,5290.32,'czivd');

INSERT INTO tab0 VALUES(610,9013,5902.12,'xhpqc',2382,4505.82,'hvyhw');

INSERT INTO tab0 VALUES(737,5809,3520.2,'xnmvv',4298,3869.81,'xhsue');

INSERT INTO tab0 VALUES(864,9851,9012.17,'uqqbf',3819,9562.66,'dobvp');

INSERT INTO tab0 VALUES(991,3564,1044.19,'bcqhk',4375,7236.90,'widrf');

INSERT INTO tab0 VALUES(42,83,5714.24,'mprxn',6979,4371.32,'rxtkj');

INSERT INTO tab0 VALUES(169,1913,4896.48,'olxcr',3847,3221.98,'iksva');

INSERT INTO tab0 VALUES(296,172,3430.82,'ddsce',5954,8274.70,'nqdvu');

INSERT INTO tab0 VALUES(423,8077,102.10,'gmrdf',2601,69.79,'yurgj');

INSERT INTO tab0 VALUES(550,6987,9270.48,'ammhx',9354,333.20,'hwtwh');

INSERT INTO tab0 VALUES(677,158,9604.83,'lisqx',1806,736.90,'gygax');

INSERT INTO tab0 VALUES(804,6491,2842.8,'izvvn',9313,1637.25,'kultz');

INSERT INTO tab0 VALUES(931,4280,2539.65,'znzhk',8756,841.38,'xyziz');

INSERT INTO tab0 VALUES(58,4428,1393.17,'zkgqd',3781,3475.3,'lslcn');

INSERT INTO tab0 VALUES(185,9585,7120.43,'gksil',1937,9732.2,'ppkla');

INSERT INTO tab0 VALUES(312,4434,1037.55,'nkadk',5053,2912.89,'teudx');

INSERT INTO tab0 VALUES(439,2055,9851.74,'lezsy',9398,142.73,'yduor');

INSERT INTO tab0 VALUES(566,1949,989.99,'kpbcs',794,9896.20,'onike');

INSERT INTO tab0 VALUES(693,3796,1351.45,'iyofx',8363,746.97,'ybgbh');

INSERT INTO tab0 VALUES(820,1199,6066.79,'nhjdd',8279,110.1,'mqzsz');

INSERT INTO tab0 VALUES(947,5438,7228.61,'nwvmh',7513,3006.5,'kppdz');

INSERT INTO tab0 VALUES(44,5693,9481.20,'nduge',4364,6700.67,'iolex');

INSERT INTO tab0 VALUES(171,5191,7844.78,'barcd',1426,1141.55,'jncjk');

INSERT INTO tab0 VALUES(298,3601,2643.98,'pwibu',2346,5457.53,'jcsyq');

INSERT INTO tab0 VALUES(425,2957,6209.57,'kabhv',3680,8417.46,'mfspj');

INSERT INTO tab0 VALUES(552,6562,7069.45,'jchkg',1380,607.61,'kzfyw');

INSERT INTO tab0 VALUES(679,2744,8689.7,'tmmck',4540,3179.12,'iyxws');

INSERT INTO tab0 VALUES(806,8590,8227.73,'gkafp',9149,6600.32,'wmzuq');

INSERT INTO tab0 VALUES(933,3715,5282.3,'qqyjf',1843,9407.11,'xfyei');

INSERT INTO tab0 VALUES(58,7810,6663.38,'fvxvn',974,2596.76,'ggsnb');

INSERT INTO tab0 VALUES(185,7149,5755.83,'ldqjw',1566,2798.16,'nqtom');

INSERT INTO tab0 VALUES(312,6675,4935.55,'lzbje',9052,3124.78,'vevfv');

INSERT INTO tab0 VALUES(439,5157,2583.63,'dsasp',5825,1084.97,'kotlx');

INSERT INTO tab0 VALUES(566,3182,1628.79,'rmcpc',1719,1865.75,'ixkrd');

INSERT INTO tab0 VALUES(693,1901,3302.24,'nzdpt',2755,2080.74,'aidrw');

INSERT INTO tab0 VALUES(820,1783,888.60,'djpke',9904,3516.0,'nbknu');

INSERT INTO tab0 VALUES(947,1362,3470.74,'cfxvu',7823,6884.91,'wevhe');

INSERT INTO tab0 VALUES(59,31427,2758.64,'glnce',48645,90637.65,'uqcey');

INSERT INTO tab0 VALUES(186,95864,34826.63,'hqtqx',24511,89556.35,'hispy');

INSERT INTO tab0 VALUES(313,43405,91061.19,'gtqdq',43881,1766.84,'kyzbd');

INSERT INTO tab0 VALUES(440,79190,65429.22,'gwshk',79760,17623.12,'xnmdg');

INSERT INTO tab0 VALUES(567,50738,24749.43,'ailvj',78790,6582.83,'tswbq');

INSERT INTO tab0 VALUES(694,85446,96194.73,'qfevs',98739,4699.61,'wesjf');

INSERT INTO tab0 VALUES(821,28103,54779.59,'prdcj',46020,2130.47,'bykbi');

INSERT INTO tab0 VALUES(948,78375,10882.41,'mibma',13165,30636.17,'wwbbo');

INSERT INTO tab0 VALUES(1075,28311,97726.91,'aoeky',16345,51077.62,'lyioq');

INSERT INTO tab0 VALUES(1202,99844,58886.52,'tcgaw',32870,40917.20,'mrili');

INSERT INTO tab0 VALUES(1329,82294,35794.69,'dbeuv',38671,81723.19,'zknoh');

INSERT INTO tab0 VALUES(1456,69854,55221.36,'gsare',45822,46658.12,'guofz');

INSERT INTO tab0 VALUES(1583,99108,16806.24,'umvtg',40023,87991.12,'qddnn');

INSERT INTO tab0 VALUES(1710,86523,80526.26,'uqpgj',18109,24588.36,'ntxsm');

INSERT INTO tab0 VALUES(1837,65942,54220.90,'rmbit',25552,29418.36,'fijow');

INSERT INTO tab0 VALUES(1964,26095,81066.59,'arncf',93948,17062.40,'qjrsa');

INSERT INTO tab0 VALUES(2091,48095,27108.6,'lxwdg',78533,31185.91,'mlpfk');

INSERT INTO tab0 VALUES(2218,42941,68731.73,'mwjav',95673,32067.77,'vtipk');

INSERT INTO tab0 VALUES(2345,89007,80175.11,'oyoie',60369,84085.79,'egjpl');

INSERT INTO tab0 VALUES(2472,69555,21032.12,'rmzkv',23751,43212.0,'fglgq');

INSERT INTO tab0 VALUES(2599,10229,23748.51,'mckni',10586,44535.6,'uskkv');

INSERT INTO tab0 VALUES(2726,16559,81112.21,'zdhgf',56768,89730.66,'uoxci');

INSERT INTO tab0 VALUES(2853,11450,33776.72,'oczxw',46835,34582.82,'xenuu');

INSERT INTO tab0 VALUES(2980,72695,57737.48,'stjyj',51443,76477.35,'opoah');

INSERT INTO tab0 VALUES(3107,70474,51840.25,'ayyfj',64892,41900.18,'vdumy');

INSERT INTO tab0 VALUES(3234,4837,25292.46,'zmmmb',42611,73941.72,'hpnoy');

INSERT INTO tab0 VALUES(3361,43231,85144.62,'zycrx',38660,19784.29,'xoiri');

INSERT INTO tab0 VALUES(3488,57980,23797.69,'ztbjo',43238,18225.43,'uaary');

INSERT INTO tab0 VALUES(3615,63784,6509.41,'osncv',20167,87152.33,'hnmei');

INSERT INTO tab0 VALUES(3742,55239,58887.75,'shqrl',44406,11065.18,'srnym');

INSERT INTO tab0 VALUES(3869,44314,54391.21,'rchtz',39557,28555.52,'dmthv');

INSERT INTO tab0 VALUES(3996,97866,1829.26,'acyzs',15338,19818.69,'oqnlc');

INSERT INTO tab0 VALUES(4123,75129,32864.65,'fgsno',5111,94158.11,'mctvb');

INSERT INTO tab0 VALUES(4250,65225,89511.86,'tnxjv',3369,77471.73,'wgtsr');

INSERT INTO tab0 VALUES(4377,24658,11636.39,'ypgtf',3234,99761.36,'ekgfr');

INSERT INTO tab0 VALUES(4504,14816,24450.22,'rbnmp',33963,82629.9,'zddxq');

INSERT INTO tab0 VALUES(4631,39462,26028.12,'nwnjz',98449,26785.60,'cqhgt');

INSERT INTO tab0 VALUES(4758,82254,74786.5,'kpznh',10708,99530.59,'feqts');

INSERT INTO tab0 VALUES(4885,44223,76995.55,'oaiuh',33404,22271.14,'yiwls');

INSERT INTO tab0 VALUES(5012,81289,74279.9,'lgqdm',15322,58026.9,'rolic');

INSERT INTO tab0 VALUES(5139,41751,31115.45,'njozz',28881,98898.37,'kjisl');

INSERT INTO tab0 VALUES(5266,3790,22326.11,'gmaqi',7638,53604.46,'ouymj');

INSERT INTO tab0 VALUES(5393,12973,20590.59,'wlhmi',83779,34954.69,'zubog');

INSERT INTO tab0 VALUES(5520,19747,83935.89,'fytre',25622,47369.64,'uppjl');

INSERT INTO tab0 VALUES(5647,16949,43243.80,'vcuha',75122,74365.53,'dbqau');

INSERT INTO tab0 VALUES(5774,77288,89749.29,'oqrrz',85363,66061.57,'hacvt');

INSERT INTO tab0 VALUES(5901,90866,62530.91,'qllyb',58065,26675.35,'guuqe');

INSERT INTO tab0 VALUES(6028,2656,36029.15,'luujy',81079,2032.21,'xjfec');

INSERT INTO tab0 VALUES(6155,50024,7531.81,'lwvoy',65884,67056.64,'pykmw');

INSERT INTO tab0 VALUES(6282,216,84671.37,'zyedu',85101,13269.60,'hgygr');

INSERT INTO tab0 VALUES(6409,87864,72943.40,'gbpuo',9979,36300.94,'huofu');

INSERT INTO tab0 VALUES(6536,52468,63183.88,'czdwo',47900,23379.76,'dmjmc');

INSERT INTO tab0 VALUES(6663,75933,19091.63,'yzrte',79876,40835.80,'mvkyf');

INSERT INTO tab0 VALUES(6790,20031,64712.63,'rydat',98060,21598.78,'yiuri');

INSERT INTO tab0 VALUES(6917,63925,71936.46,'lwbdn',43228,52701.81,'cwiix');

INSERT INTO tab0 VALUES(7044,41650,48016.61,'oftnh',42297,62777.75,'edrkv');

INSERT INTO tab0 VALUES(7171,79639,23046.90,'lgxdq',45813,9570.58,'bywqz');

INSERT INTO tab0 VALUES(7298,34197,37484.83,'kmsvl',65451,67411.81,'cqonk');

INSERT INTO tab0 VALUES(7425,29013,29632.98,'oypob',11526,14736.78,'dlqoy');

INSERT INTO tab0 VALUES(7552,92663,23138.35,'urazy',30484,21599.13,'bwfqh');

INSERT INTO tab0 VALUES(7679,96103,14514.77,'laors',42398,37127.8,'bamkt');

INSERT INTO tab0 VALUES(7806,90170,60610.25,'hbqow',78482,77075.90,'ecosd');

INSERT INTO tab0 VALUES(7933,43091,66143.37,'lwmgw',18579,11283.20,'kpkys');

INSERT INTO tab0 VALUES(8060,77966,71173.64,'gcwou',28665,51203.36,'mwqjz');

INSERT INTO tab0 VALUES(8187,10284,38605.90,'zcdrh',98348,37378.88,'sjnnp');

INSERT INTO tab0 VALUES(8314,85415,41708.66,'aobqo',78369,26959.76,'zbrrg');

INSERT INTO tab0 VALUES(8441,16116,51596.51,'jrouc',18104,81204.89,'lvdbo');

INSERT INTO tab0 VALUES(8568,20019,24734.48,'vptyp',3057,52960.40,'ntbhv');

INSERT INTO tab0 VALUES(8695,57144,90441.41,'svtav',92373,74182.5,'wsswd');

INSERT INTO tab0 VALUES(8822,67392,38388.32,'unpdo',56321,43432.60,'ykhiz');

INSERT INTO tab0 VALUES(8949,8051,6097.81,'dzbgk',13809,13363.19,'fcvxh');

INSERT INTO tab0 VALUES(9076,91285,66439.41,'yynkq',69873,78238.71,'vraoi');

INSERT INTO tab0 VALUES(9203,21643,15139.97,'pzxbe',53182,61414.19,'qhgql');

INSERT INTO tab0 VALUES(9330,33564,58273.2,'hvmmj',53549,2859.13,'wnedz');

INSERT INTO tab0 VALUES(9457,28859,99771.16,'bvwix',59402,46633.93,'fxxbh');

INSERT INTO tab0 VALUES(9584,14224,28906.44,'qhrrs',95315,28403.26,'nfsvl');

INSERT INTO tab0 VALUES(9711,38745,7815.71,'hxrqt',59490,62941.37,'wwxsc');

INSERT INTO tab0 VALUES(9838,31385,58978.2,'sxjsa',61260,31607.55,'fhuzo');

INSERT INTO tab0 VALUES(9965,38491,52728.96,'zufch',58601,69879.46,'milpk');

SELECT pk FROM tab0 WHERE NOT (col0 > 22256);

DELETE FROM tab3 WHERE (col4 < 57382.96);

INSERT INTO tab0 VALUES(61,96582,39062.46,'lntua',50930,14483.0,'orbyq');

INSERT INTO tab0 VALUES(188,28903,97335.52,'myldo',10195,64169.90,'bkjrd');

INSERT INTO tab0 VALUES(315,9521,67010.4,'erugg',57888,25170.66,'xabpq');

INSERT INTO tab0 VALUES(442,7540,50158.70,'kpvee',40362,67822.89,'bynwx');

INSERT INTO tab0 VALUES(569,15695,77951.25,'rqfht',58843,97811.14,'saqtl');

INSERT INTO tab0 VALUES(696,87850,98165.1,'yjzog',6945,43673.27,'ezzbj');

INSERT INTO tab0 VALUES(823,76504,62677.12,'pdnby',8166,44296.83,'ptkig');

INSERT INTO tab0 VALUES(950,70291,14968.0,'frlew',53381,36419.44,'aubjy');

INSERT INTO tab0 VALUES(1077,31475,77615.70,'nfkdr',38351,42135.17,'aneqp');

INSERT INTO tab0 VALUES(1204,33456,39797.25,'fdbjo',1220,56387.86,'ytamk');

INSERT INTO tab0 VALUES(1331,98260,44805.8,'ydutd',60018,34472.60,'jxvqn');

INSERT INTO tab0 VALUES(1458,34057,77517.35,'ystdg',50152,79534.99,'iqmox');

INSERT INTO tab0 VALUES(1585,72634,51922.38,'fnqqy',61914,30073.61,'xvnuj');

INSERT INTO tab0 VALUES(1712,6930,98605.95,'eqpyg',77981,47433.34,'jlbic');

INSERT INTO tab0 VALUES(1839,28503,52261.75,'recyd',10910,3323.73,'vlnby');

INSERT INTO tab0 VALUES(1966,65045,39175.71,'skwui',40640,67291.43,'hnpaz');

INSERT INTO tab0 VALUES(2093,17886,64739.38,'nhond',51995,94238.50,'hfeyn');

INSERT INTO tab0 VALUES(2220,99487,955.33,'ftygn',72183,11929.83,'blcly');

INSERT INTO tab0 VALUES(2347,70938,73910.48,'vglqu',8294,8462.50,'fvcnq');

INSERT INTO tab0 VALUES(2474,79470,51303.53,'fvjim',84799,19799.15,'sbsxu');

INSERT INTO tab0 VALUES(2601,95938,29937.29,'rtldi',81054,17254.35,'phaji');

INSERT INTO tab0 VALUES(2728,52334,23208.8,'ewxqc',68792,94985.0,'bnsfu');

INSERT INTO tab0 VALUES(2855,79281,48621.9,'yvikl',49639,57507.68,'fyuob');

INSERT INTO tab0 VALUES(2982,43542,15274.77,'mpkjt',92596,7186.4,'xhpun');

INSERT INTO tab0 VALUES(3109,85501,11380.19,'lsahd',71551,31735.18,'uimuq');

INSERT INTO tab0 VALUES(3236,56683,91738.42,'kwxde',2767,91727.98,'ybyma');

INSERT INTO tab0 VALUES(3363,57244,65258.92,'xzrhx',82404,8078.54,'yhgeg');

INSERT INTO tab0 VALUES(3490,73471,82455.89,'ewpdo',23989,49560.52,'svnut');

INSERT INTO tab0 VALUES(3617,15286,22933.66,'blnhp',95947,20297.51,'hymlq');

INSERT INTO tab0 VALUES(3744,53745,82907.6,'wcucm',59072,47266.42,'tvirp');

INSERT INTO tab0 VALUES(3871,58532,62695.80,'ieavo',4049,67788.85,'etqvu');

INSERT INTO tab0 VALUES(3998,35467,54208.84,'lhahx',88943,17041.47,'krjos');

INSERT INTO tab0 VALUES(4125,64007,28466.78,'gqryj',76702,15560.37,'aklcd');

INSERT INTO tab0 VALUES(4252,34732,23089.20,'vmxmg',72662,56719.48,'bdxow');

INSERT INTO tab0 VALUES(4379,86862,29794.7,'dlhcf',62034,94257.89,'avqnq');

INSERT INTO tab0 VALUES(4506,45745,81906.10,'wyhzg',47415,29748.29,'vkieb');

INSERT INTO tab0 VALUES(4633,60372,41848.15,'hotmn',86283,137.28,'kihym');

INSERT INTO tab0 VALUES(4760,40853,88644.56,'gjcre',28503,65206.78,'xwgou');

INSERT INTO tab0 VALUES(4887,95941,5422.56,'wgarg',53820,95098.42,'gllsi');

INSERT INTO tab0 VALUES(5014,70513,66912.62,'pnmyo',9365,57797.87,'gdhhx');

INSERT INTO tab0 VALUES(5141,83093,26940.84,'yakuq',47143,6649.25,'lzkti');

INSERT INTO tab0 VALUES(5268,63320,5944.34,'lqsrm',61553,67846.50,'wgjos');

INSERT INTO tab0 VALUES(5395,89480,78451.60,'nqeol',26870,27932.72,'yaqly');

INSERT INTO tab0 VALUES(5522,25982,60595.85,'gdgih',34756,21308.62,'nkmzx');

INSERT INTO tab0 VALUES(5649,60879,97617.45,'lgxev',31750,17712.82,'nzttb');

INSERT INTO tab0 VALUES(5776,43344,51351.26,'isrww',56774,9753.25,'zevwo');

INSERT INTO tab0 VALUES(5903,21191,87741.3,'odgif',78646,378.56,'wnmez');

INSERT INTO tab0 VALUES(6030,78366,64324.75,'yjrvk',33547,90390.43,'yhtxg');

INSERT INTO tab0 VALUES(6157,72445,17742.4,'nyajq',62557,65945.0,'pptsl');

INSERT INTO tab0 VALUES(6284,72137,51242.52,'gkgfo',49130,86044.21,'wxrju');

INSERT INTO tab0 VALUES(6411,94787,22164.19,'zrfbj',56604,70050.21,'fkpxm');

INSERT INTO tab0 VALUES(6538,43872,29461.79,'ikkpk',65706,85168.69,'hjido');

INSERT INTO tab0 VALUES(6665,46498,1181.21,'llyse',12033,33963.31,'cmhwr');

INSERT INTO tab0 VALUES(6792,90908,81973.83,'cejci',23577,41839.0,'oimlg');

INSERT INTO tab0 VALUES(6919,63977,20587.90,'iungg',58209,44567.44,'ppedz');

INSERT INTO tab0 VALUES(7046,88711,57381.93,'mwmhf',41183,75756.31,'xrbhz');

INSERT INTO tab0 VALUES(7173,61749,11804.5,'zmkbc',2633,54380.77,'yvvxq');

INSERT INTO tab0 VALUES(7300,90869,69919.40,'gwili',15079,72255.79,'orfzi');

INSERT INTO tab0 VALUES(7427,32470,71879.50,'pnear',30920,81542.52,'gnwvl');

INSERT INTO tab0 VALUES(7554,29096,99446.61,'bwoei',19947,82276.67,'pufmf');

INSERT INTO tab0 VALUES(7681,46914,63476.13,'ihqpk',6820,9820.91,'oigco');

INSERT INTO tab0 VALUES(7808,13229,91442.94,'nvbsg',8593,22402.21,'avmhz');

INSERT INTO tab0 VALUES(7935,53979,14901.83,'fjsvb',72201,88598.22,'vewmm');

INSERT INTO tab0 VALUES(8062,31234,57019.81,'eatvr',11956,74835.68,'svpjj');

INSERT INTO tab0 VALUES(8189,80697,20069.53,'gqkgt',47059,32894.75,'yfzff');

INSERT INTO tab0 VALUES(8316,49203,72912.66,'jzvvk',39086,87405.41,'lcihp');

INSERT INTO tab0 VALUES(8443,32217,38522.21,'ghavd',29507,23349.82,'pyvcc');

INSERT INTO tab0 VALUES(8570,11344,81476.97,'lnqmt',77169,73559.73,'zhnbd');

INSERT INTO tab0 VALUES(8697,91816,95440.85,'auyff',95800,6226.81,'ldymx');

INSERT INTO tab0 VALUES(8824,39999,90695.26,'pspel',91516,12377.3,'xhghb');

INSERT INTO tab0 VALUES(8951,20893,81616.49,'evqni',306,93411.9,'duyeu');

INSERT INTO tab0 VALUES(9078,35633,74179.7,'zyiuo',25554,48562.72,'thtcr');

INSERT INTO tab0 VALUES(9205,58976,53466.17,'imxjj',75516,62426.10,'chppj');

INSERT INTO tab0 VALUES(9332,76828,71160.96,'pwqtp',842,92440.23,'zsjeu');

INSERT INTO tab0 VALUES(9459,23716,33041.99,'zzozm',32055,56405.30,'revrq');

INSERT INTO tab0 VALUES(9586,20303,86495.55,'lllzm',17062,19964.4,'wjpso');

INSERT INTO tab0 VALUES(9713,10889,8010.7,'nzpzh',58663,84117.16,'gjuwy');

INSERT INTO tab0 VALUES(9840,900,90674.47,'hwvyo',52026,72709.65,'rfdjr');

INSERT INTO tab0 VALUES(9967,94400,31672.56,'fhgsw',22213,19946.21,'yasdd');
