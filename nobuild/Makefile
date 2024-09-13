BINARY=nobuild
BINARY_DIR=bin
BINARY_PATH=$(BINARY_DIR)/$(BINARY)

# Get the currently used golang install path (in GOPATH/bin, unless GOBIN is set)
ifeq (,$(shell go env GOBIN))
GOBIN=$(shell go env GOPATH)/bin
else
GOBIN=$(shell go env GOBIN)
endif

all: build

help:  ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

lint:  ## Lint go files
ifeq (, $(shell which golangci-lint))
	curl -sSfL https://raw.githubusercontent.com/golangci/golangci-lint/master/install.sh | sh -s -- -b $(GOBIN)
endif
	golangci-lint run -v
ifeq (, $(shell which staticcheck))
	GO111MODULE=on go install honnef.co/go/tools/cmd/staticcheck@latest
endif
	staticcheck ./...

fmt:  ## Run go fmt against code.
	go fmt ./...

tidy:  ## Run go mod tidy
	go mod tidy

vet:  ## Run go vet against code.
	go vet ./...
	
##@ Build

build: fmt vet lint tidy
	go build -o $(BINARY_PATH) main.go

run: fmt vet  ## Run a controller from your host.
	go run main.go

clean:  ## delete the bin folder containing binaries
	rm -rf $(PROJECT_DIR)/$(BINARY_DIR)