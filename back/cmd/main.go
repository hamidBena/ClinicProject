package main

import (
	"clinic/internal/app"
	"clinic/pkg/database"
	"clinic/pkg/utils"
	"log"
	"net/http"
)

func main() {
	db := database.Connect()
	defer db.Close()
	log.Println(utils.HashPassword("password"))

	log.Println("available endpoints:")
	for _, endpoint := range app.Endpoints() {
		log.Printf("  %s %s", endpoint.Method, endpoint.Path)
	}

	router := app.NewRouter(db)
	log.Println("server listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", router))

}
