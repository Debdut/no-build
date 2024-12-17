package template

import (
	"archive/zip"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const (
	DefaultRepo = "debdut/no-build"
	apiURL      = "https://api.github.com/repos/%s/zipball"
)

func downloadFile(url, filepath string) error {
	resp, err := http.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	out, err := os.Create(filepath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func extractTemplate(zipFile, template string) error {
	reader, err := zip.OpenReader(zipFile)
	if err != nil {
		return err
	}
	defer reader.Close()

	if template == "." {
		for _, file := range reader.File {
			if file.FileInfo().IsDir() {
				os.MkdirAll(file.Name, os.ModePerm)
				continue
			}

			if err := extractFile(file, file.Name); err != nil {
				return err
			}
		}

		return nil
	}

	for _, file := range reader.File {
		path := strings.Split(file.Name, string(filepath.Separator))
		if len(path) > 1 && path[1] == template {
			targetPath := filepath.Join(path[1:]...)
			if file.FileInfo().IsDir() {
				os.MkdirAll(targetPath, os.ModePerm)
				continue
			}

			if err := extractFile(file, targetPath); err != nil {
				return err
			}
		}
	}

	return nil
}

func extractFile(file *zip.File, targetPath string) error {
	reader, err := file.Open()
	if err != nil {
		return err
	}
	defer reader.Close()

	targetFile, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
	if err != nil {
		return err
	}
	defer targetFile.Close()

	_, err = io.Copy(targetFile, reader)
	return err
}
