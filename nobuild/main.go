package main

import (
	"fmt"
	"os"

	"github.com/debdut/no-build/nobuild/pkg/template"
	"github.com/debdut/no-build/nobuild/pkg/vendor"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: nobuild <command> [<args>]")
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "template":
		handleTemplateCommand(os.Args[2:])
	case "vendor":
		vendor.Vendor()
	case "unvendor":
		vendor.Unvendor()
	default:
		fmt.Println("Unknown command:", command)
		os.Exit(1)
	}
}

func handleTemplateCommand(args []string) {
	if len(args) < 1 {
		fmt.Println("Usage: nobuild template <list|<template>|<repo> <template>>")
		os.Exit(1)
	}

	subcommand := args[0]

	switch subcommand {
	case "list":
		repo := template.DefaultRepo
		if len(args) > 1 {
			repo = args[1]
		}
		if err := template.ListTemplates(repo); err != nil {
			fmt.Printf("Error listing templates: %v\n", err)
			os.Exit(1)
		}
	default:
		var repo, templateName string
		if len(args) == 1 {
			repo = template.DefaultRepo
			templateName = args[0]
		} else {
			repo = args[0]
			templateName = args[1]
		}

		err := template.DownloadTemplate(repo, templateName)
		if err != nil {
			fmt.Printf("Error downloading template: %v\n", err)
			os.Exit(1)
		}
	}
}
