package template

import (
	"archive/zip"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func ListTemplates(repo string) error {
	url := fmt.Sprintf(apiURL, repo)
	zipFile := "repo.zip"

	// Download the repository
	if err := downloadFile(url, zipFile); err != nil {
		return fmt.Errorf("error downloading repository: %v", err)
	}
	defer os.Remove(zipFile)

	// List the templates
	if err := listTemplates(zipFile); err != nil {
		return fmt.Errorf("error listing templates: %v", err)
	}

	return nil
}

func listTemplates(zipFile string) error {
	reader, err := zip.OpenReader(zipFile)
	if err != nil {
		return err
	}
	defer reader.Close()

	templates := make(map[string]struct{})
	for _, file := range reader.File {
		path := strings.Split(file.Name, string(filepath.Separator))
		if len(path) > 1 {
			templates[path[1]] = struct{}{}
		}
	}

	fmt.Println("Available templates:")
	for template := range templates {
		fmt.Println(template)
	}

	return nil
}
