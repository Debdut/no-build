package vendor

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

func Unvendor() error {
	// 1. Load vendor map
	vendorMap, err := loadVendorMap()
	if err != nil {
		return err
	}

	// 2. Scan all HTML and JS files in the current directory and subdirectories
	files, err := scanFiles()
	if err != nil {
		return err
	}

	// 3. Process each file to revert changes
	for _, file := range files {
		err = unvendorFile(file, vendorMap)
		if err != nil {
			return err
		}
	}

	// 4. Remove vendors folder
	err = os.RemoveAll("vendor")
	if err != nil {
		return err
	}

	fmt.Println("Unvendorify completed successfully.")
	return nil
}

func loadVendorMap() (VendorMap, error) {
	var vendorMap VendorMap
	data, err := os.ReadFile("vendor/vendors.json")
	if err != nil {
		return vendorMap, err
	}
	err = json.Unmarshal(data, &vendorMap)
	return vendorMap, err
}

func unvendorFile(filePath string, vendorMap VendorMap) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return err
	}

	// Revert changes in HTML files
	if strings.HasSuffix(filePath, ".html") {
		content = unvendorHTML(content, vendorMap)
	}

	// Revert changes in JS files
	if strings.HasSuffix(filePath, ".js") {
		content = unvendorJS(content, vendorMap)
	}

	return os.WriteFile(filePath, content, 0644)
}

func unvendorHTML(content []byte, vendorMap VendorMap) []byte {
	// Implement HTML unvendorify logic here
	// Restore original import maps and scripts from comments
	return content
}

func unvendorJS(content []byte, vendorMap VendorMap) []byte {
	// Implement JS unvendorify logic here
	// Restore original import/export statements from comments
	return content
}
