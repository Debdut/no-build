package template

import (
	"fmt"
	"os"
)

func DownloadTemplate(repo, template string) error {
	url := fmt.Sprintf(apiURL, repo)
	zipFile := "repo.zip"

	// Download the repository
	if err := downloadFile(url, zipFile); err != nil {
		return fmt.Errorf("error downloading repository: %v", err)
	}
	defer os.Remove(zipFile)

	// Extract the specific template folder
	if err := extractTemplate(zipFile, template); err != nil {
		return fmt.Errorf("error extracting template: %v", err)
	}

	fmt.Printf("Template '%s' downloaded successfully.\n", template)
	return nil
}
