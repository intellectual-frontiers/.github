CREATE TABLE IF NOT EXISTS "synthetic_table_with_auto_inc_pk" (
    "auto_inc_primary_key" INTEGER PRIMARY KEY AUTOINCREMENT,
    "text" TEXT NOT NULL,
    "text_nullable" TEXT,
    "int" INTEGER NOT NULL,
    "int_nullable" INTEGER
);

CREATE TABLE IF NOT EXISTS "synthetic_table_with_foreign_keys" (
    "auto_inc_primary_key" INTEGER PRIMARY KEY AUTOINCREMENT,
    "fk_int_primary_key" INTEGER NOT NULL,
    "fk_int_primary_key_nullable" INTEGER,
    "parent" INTEGER,
    CONSTRAINT "synthetic_table_with_foreign_keys_fk_int_primary_key_fk" FOREIGN KEY ("fk_int_primary_key") REFERENCES "synthetic_table_with_auto_inc_pk" ("auto_inc_primary_key"),
    CONSTRAINT "synthetic_table_with_foreign_keys_fk_int_primary_key_nullable_fk" FOREIGN KEY ("fk_int_primary_key_nullable") REFERENCES "synthetic_table_with_auto_inc_pk" ("auto_inc_primary_key"),
    CONSTRAINT "synthetic_table_with_foreign_keys_parent_fk" FOREIGN KEY ("parent") REFERENCES "synthetic_table_with_foreign_keys" ("auto_inc_primary_key")
);

CREATE TABLE IF NOT EXISTS "synthetic_table_without_pk" (
    "text" TEXT NOT NULL,
    "text_nullable" TEXT,
    "int" INTEGER NOT NULL,
    "int_nullable" INTEGER
);
