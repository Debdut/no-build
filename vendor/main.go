package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

const vendorsFile = "vendor/vendors.txt"

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: vendorify [vendorify|devendorify]")
		return
	}

	command := os.Args[1]
	switch command {
	case "vendorify":
		vendorify()
	case "devendorify":
		devendorify()
	default:
		fmt.Println("Invalid command. Use 'vendorify' or 'devendorify'.")
	}
}

func vendorify() {
	err := filepath.Walk(".", processFile)
	if err != nil {
		fmt.Printf("Error walking through directory: %v\n", err)
	}
}

func processFile(path string, info os.FileInfo, err error) error {
	if err != nil {
		return err
	}

	if info.IsDir() {
		return nil
	}

	ext := filepath.Ext(path)
	if ext != ".html" && ext != ".js" {
		return nil
	}

	content, err := ioutil.ReadFile(path)
	if err != nil {
		return err
	}

	var newContent string
	if ext == ".html" {
		newContent = processHTML(string(content))
	} else {
		newContent = processJS(string(content))
	}

	err = ioutil.WriteFile(path, []byte(newContent), info.Mode())
	if err != nil {
		return err
	}

	return nil
}

func processHTML(content string) string {
	importMapRegex := regexp.MustCompile(`<script type="importmap">(.*?)</script>`)
	scriptRegex := regexp.MustCompile(`<script src="(https?://.*?)"></script>`)

	content = importMapRegex.ReplaceAllStringFunc(content, func(match string) string {
		return "<!-- Original importmap: " + match + " -->\n" + processImportMap(match)
	})

	content = scriptRegex.ReplaceAllStringFunc(content, func(match string) string {
		return "<!-- Original script: " + match + " -->\n" + processScript(match)
	})

	return content
}

func processJS(content string) string {
	importRegex := regexp.MustCompile(`import .* from ["'](https?://.*?)["']`)
	exportRegex := regexp.MustCompile(`export .* from ["'](https?://.*?)["']`)

	content = importRegex.ReplaceAllStringFunc(content, func(match string) string {
		return "// Original import: " + match + "\n" + processImportExport(match, "import")
	})

	content = exportRegex.ReplaceAllStringFunc(content, func(match string) string {
		return "// Original export: " + match + "\n" + processImportExport(match, "export")
	})

	return content
}

func processImportMap(importMap string) string {
	// Parse the import map JSON
	var parsedMap map[string]interface{}
	err := json.Unmarshal([]byte(importMap), &parsedMap)
	if err != nil {
		fmt.Printf("Error parsing import map: %v\n", err)
		return importMap
	}

	// Process each import in the map
	for key, value := range parsedMap["imports"].(map[string]interface{}) {
		url := value.(string)
		if strings.HasPrefix(url, "http") {
			localPath := downloadDependency(url)
			parsedMap["imports"].(map[string]interface{})[key] = localPath
		}
	}

	// Convert the updated map back to JSON
	updatedJSON, err := json.Marshal(parsedMap)
	if err != nil {
		fmt.Printf("Error converting import map back to JSON: %v\n", err)
		return importMap
	}

	return fmt.Sprintf(`<script type="importmap">%s</script>`, string(updatedJSON))
}

func processScript(script string) string {
	urlRegex := regexp.MustCompile(`src="(https?://.*?)"`)
	matches := urlRegex.FindStringSubmatch(script)
	if len(matches) < 2 {
		return script
	}

	url := matches[1]
	localPath := downloadDependency(url)
	return strings.Replace(script, url, localPath, 1)
}

func processImportExport(statement string, stmtType string) string {
	urlRegex := regexp.MustCompile(`["'](https?://.*?)["']`)
	matches := urlRegex.FindStringSubmatch(statement)
	if len(matches) < 2 {
		return statement
	}

	url := matches[1]
	localPath := downloadDependency(url)
	return strings.Replace(statement, url, localPath, 1)
}

func downloadDependency(url string) string {
	resp, err := http.Get(url)
	if err != nil {
		fmt.Printf("Error downloading %s: %v\n", url, err)
		return url
	}
	defer resp.Body.Close()

	localPath := filepath.Join("vendor", strings.TrimPrefix(url, "https://"))
	err = os.MkdirAll(filepath.Dir(localPath), 0755)
	if err != nil {
		fmt.Printf("Error creating directory for %s: %v\n", localPath, err)
		return url
	}

	out, err := os.Create(localPath)
	if err != nil {
		fmt.Printf("Error creating file %s: %v\n", localPath, err)
		return url
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	if err != nil {
		fmt.Printf("Error writing to file %s: %v\n", localPath, err)
		return url
	}

	addToVendorsFile(url, localPath)

	// Process the downloaded file for nested dependencies
	content, err := ioutil.ReadFile(localPath)
	if err == nil {
		newContent := processJS(string(content))
		ioutil.WriteFile(localPath, []byte(newContent), 0644)
	}

	return localPath
}

func addToVendorsFile(url, localPath string) {
	f, err := os.OpenFile(vendorsFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("Error opening vendors file: %v\n", err)
		return
	}
	defer f.Close()

	if _, err := f.WriteString(fmt.Sprintf("%s,%s\n", url, localPath)); err != nil {
		fmt.Printf("Error writing to vendors file: %v\n", err)
	}
}

func devendorify() {
	vendorMap, err := readVendorsFile()
	if err != nil {
		fmt.Printf("Error reading vendors file: %v\n", err)
		return
	}

	err = filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".html" && ext != ".js" {
			return nil
		}

		content, err := ioutil.ReadFile(path)
		if err != nil {
			return err
		}

		newContent := devendorifyContent(string(content), vendorMap)

		err = ioutil.WriteFile(path, []byte(newContent), info.Mode())
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		fmt.Printf("Error walking through directory: %v\n", err)
	}
}

func readVendorsFile() (map[string]string, error) {
	vendorMap := make(map[string]string)

	file, err := os.Open(vendorsFile)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		parts := strings.SplitN(scanner.Text(), ",", 2)
		if len(parts) == 2 {
			vendorMap[parts[1]] = parts[0]
		}
	}

	return vendorMap, scanner.Err()
}

func devendorifyContent(content string, vendorMap map[string]string) string {
	for localPath, url := range vendorMap {
		content = strings.ReplaceAll(content, localPath, url)
	}

	// Remove comments for original imports/scripts
	content = regexp.MustCompile(`(?m)^//\s*Original .*\n`).ReplaceAllString(content, "")
	content = regexp.MustCompile(`(?s)<!--\s*Original .*?-->\n`).ReplaceAllString(content, "")

	return content
}
