package vendor

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

type VendorMap struct {
	Imports map[string]string `json:"imports"`
}

func scanFiles() ([]string, error) {
	var files []string
	err := filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() && (strings.HasSuffix(path, ".html") || strings.HasSuffix(path, ".js")) {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}

func processFile(filePath string, vendorMap *VendorMap) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	if strings.HasSuffix(filePath, ".html") {
		content = processHTML(content, vendorMap)
	} else if strings.HasSuffix(filePath, ".js") {
		content = processJS(content, vendorMap)
	}

	return os.WriteFile(filePath, content, 0644)
}

func saveVendorMap(vendorMap VendorMap) error {
	data, err := json.MarshalIndent(vendorMap, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile("vendor/vendors.json", data, 0644)
}

func Vendor() {

}
