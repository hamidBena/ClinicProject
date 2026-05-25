package database

import (
	"database/sql"
	"log"

	_ "modernc.org/sqlite"
)

func Connect() *sql.DB {
	db, err := sql.Open("sqlite", "file:DB/mydb.db?_foreign_keys=on")
	if err != nil {
		log.Fatal(err)
	}

	db.SetMaxOpenConns(1)

	err = db.Ping()
	if err != nil {
		log.Fatal(err)
	}

	if _, err := db.Exec(`PRAGMA journal_mode=WAL;`); err != nil {
		log.Fatal("failed to set WAL mode:", err)
	}
	if _, err := db.Exec(`PRAGMA busy_timeout=5000;`); err != nil {
		log.Fatal("failed to set busy timeout:", err)
	}
	if _, err := db.Exec(`PRAGMA foreign_keys=ON;`); err != nil {
		log.Fatal("failed to enable foreign keys:", err)
	}

	return db
}
