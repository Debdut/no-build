package vendor

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	neturl "net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"golang.org/x/net/html"
)

func processHTML(content []byte, vendorMap *VendorMap) []byte {
	doc, err := html.Parse(bytes.NewReader(content))
	if err != nil {
		fmt.Printf("Error parsing HTML: %v\n", err)
		return content
	}

	var process func(*html.Node)
	process = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.Data {
			case "script":
				processScriptTag(n, vendorMap)
			case "link":
				processLinkTag(n, vendorMap)
			}
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			process(c)
		}
	}

	process(doc)

	var buf bytes.Buffer
	err = html.Render(&buf, doc)
	if err != nil {
		fmt.Printf("Error rendering HTML: %v\n", err)
		return content
	}

	return buf.Bytes()
}

func processScriptTag(n *html.Node, vendorMap *VendorMap) {
	src := getAttr(n, "src")
	if src != "" && isExternalURL(src) {
		vendorPath, err := downloadAndVendorify(src, vendorMap, src)
		if err != nil {
			fmt.Printf("Error vendorifying %s: %v\n", src, err)
			return
		}
		setAttr(n, "src", vendorPath)
		addComment(n, fmt.Sprintf("Original src: %s", src))
	}
}

func processLinkTag(n *html.Node, vendorMap *VendorMap) {
	rel := getAttr(n, "rel")
	href := getAttr(n, "href")
	if rel == "modulepreload" && href != "" && isExternalURL(href) {
		vendorPath, err := downloadAndVendorify(href, vendorMap, href)
		if err != nil {
			fmt.Printf("Error vendorifying %s: %v\n", href, err)
			return
		}
		setAttr(n, "href", vendorPath)
		addComment(n, fmt.Sprintf("Original href: %s", href))
	}
}

func getAttr(n *html.Node, key string) string {
	for _, attr := range n.Attr {
		if attr.Key == key {
			return attr.Val
		}
	}
	return ""
}

func setAttr(n *html.Node, key, value string) {
	for i, attr := range n.Attr {
		if attr.Key == key {
			n.Attr[i].Val = value
			return
		}
	}
	n.Attr = append(n.Attr, html.Attribute{Key: key, Val: value})
}

func addComment(n *html.Node, comment string) {
	commentNode := &html.Node{
		Type: html.CommentNode,
		Data: comment,
	}
	n.Parent.InsertBefore(commentNode, n)
}

func processJS(content []byte, vendorMap *VendorMap) []byte {
	lines := strings.Split(string(content), "\n")
	var processedLines []string

	for _, line := range lines {
		trimmedLine := strings.TrimSpace(line)
		if strings.HasPrefix(trimmedLine, "import") || strings.HasPrefix(trimmedLine, "export") {
			processedLine, changed := processImportExport(line, vendorMap)
			if changed {
				processedLines = append(processedLines, "// Original: "+line)
			}
			processedLines = append(processedLines, processedLine)
		} else {
			processedLines = append(processedLines, line)
		}
	}

	return []byte(strings.Join(processedLines, "\n"))
}

func processImportExport(line string, vendorMap *VendorMap, parentURL string) (string, bool) {
	re := regexp.MustCompile(`(from|import)\s+['"]([^'"]+)['"]`)
	matches := re.FindStringSubmatch(line)
	if len(matches) == 3 {
		url := matches[2]
		if isExternalURL(url) || strings.HasPrefix(url, "/") {
			vendorPath, err := downloadAndVendorify(url, vendorMap, parentURL)
			if err != nil {
				fmt.Printf("Error vendorifying %s: %v\n", url, err)
				return line, false
			}
			return strings.Replace(line, url, vendorPath, 1), true
		}
	}
	return line, false
}

func processImportMap(content []byte, vendorMap *VendorMap) []byte {
	var importMap map[string]interface{}
	err := json.Unmarshal(content, &importMap)
	if err != nil {
		fmt.Printf("Error parsing import map: %v\n", err)
		return content
	}

	imports, ok := importMap["imports"].(map[string]interface{})
	if !ok {
		return content
	}

	for key, value := range imports {
		if strValue, ok := value.(string); ok {
			if isExternalURL(strValue) || strings.HasPrefix(strValue, "/") {
				vendorPath, err := downloadAndVendorify(strValue, vendorMap)
				if err != nil {
					fmt.Printf("Error vendorifying %s: %v\n", strValue, err)
					continue
				}
				imports[key] = vendorPath
			}
		}
	}

	updatedContent, err := json.MarshalIndent(importMap, "", "  ")
	if err != nil {
		fmt.Printf("Error marshaling updated import map: %v\n", err)
		return content
	}

	return updatedContent
}

func isExternalURL(url string) bool {
	return strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") || strings.HasPrefix(url, "//")
}

func downloadAndVendorify(url string, vendorMap *VendorMap, parentURL string) (string, error) {
	var fullURL string
	if strings.HasPrefix(url, "/") {
		parsedParentURL, err := neturl.Parse(parentURL)
		if err != nil {
			return "", fmt.Errorf("unable to parse parent URL: %v", err)
		}
		fullURL = parsedParentURL.Scheme + "://" + parsedParentURL.Host + url
	} else {
		fullURL = url
	}

	resp, err := http.Get(fullURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	vendorDir := "vendor"
	err = os.MkdirAll(vendorDir, 0755)
	if err != nil {
		return "", err
	}

	fileName := filepath.Base(url)
	vendorPath := filepath.Join(vendorDir, fileName)
	err = os.WriteFile(vendorPath, content, 0644)
	if err != nil {
		return "", err
	}

	relativeVendorPath := filepath.Join("/", vendorPath)
	vendorMap.Imports[url] = relativeVendorPath

	return relativeVendorPath, nil
}
