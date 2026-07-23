GOCMD ?= go
GOBUILD = $(GOCMD) build
GOCLEAN = $(GOCMD) clean
GOTEST = $(GOCMD) test

# Binary names
BINARY_NAME ?= d-fi
NEW_BINARY_NAME ?= gofi
CLI_PACKAGE ?= ./cmd/d-fi
GOFI_PACKAGE ?= ./cmd/gofi
BUILD_DIR ?= build
LDFLAGS ?= -s -w

# Installation directory
PREFIX ?= /usr/local
BINDIR = $(PREFIX)/bin

# Detect OS for installation
UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
    INSTALL_CMD = ln -sf
else
    INSTALL_CMD = ln -sf
endif

# Build the d-fi binary
build:
	CGO_ENABLED=0 $(GOBUILD) -ldflags "$(LDFLAGS)" -o $(BINARY_NAME) $(CLI_PACKAGE)

# Build the GoFi CLI binary
build-cli:
	CGO_ENABLED=1 $(GOBUILD) -ldflags "$(LDFLAGS) -X github.com/d-fi/GoFi/cmd/gofi/cmd.version=$$(git describe --tags --always --dirty 2>/dev/null || echo dev)" -o $(NEW_BINARY_NAME) $(GOFI_PACKAGE)

# Build all binaries
build-all: build build-cli

# Install the new CLI binary
install: build-cli
	@echo "Installing $(NEW_BINARY_NAME) to $(BINDIR)..."
	@mkdir -p $(BINDIR)
	@if [ -w $(BINDIR) ]; then \
		cp $(NEW_BINARY_NAME) $(BINDIR)/$(NEW_BINARY_NAME); \
		chmod 755 $(BINDIR)/$(NEW_BINARY_NAME); \
		echo "✓ Installed $(NEW_BINARY_NAME) to $(BINDIR)"; \
	else \
		echo "Installing to $(BINDIR) (requires sudo)..."; \
		sudo cp $(NEW_BINARY_NAME) $(BINDIR)/$(NEW_BINARY_NAME); \
		sudo chmod 755 $(BINDIR)/$(NEW_BINARY_NAME); \
		echo "✓ Installed $(NEW_BINARY_NAME) to $(BINDIR)"; \
	fi
	@echo "Run 'gofi --help' to get started"

# Install using symlink (for development)
install-dev: build-cli
	@echo "Creating symlink for $(NEW_BINARY_NAME) in $(BINDIR)..."
	@mkdir -p $(BINDIR)
	@if [ -w $(BINDIR) ]; then \
		$(INSTALL_CMD) $(PWD)/$(NEW_BINARY_NAME) $(BINDIR)/$(NEW_BINARY_NAME); \
		echo "✓ Symlinked $(NEW_BINARY_NAME) to $(BINDIR)"; \
	else \
		echo "Creating symlink in $(BINDIR) (requires sudo)..."; \
		sudo $(INSTALL_CMD) $(PWD)/$(NEW_BINARY_NAME) $(BINDIR)/$(NEW_BINARY_NAME); \
		echo "✓ Symlinked $(NEW_BINARY_NAME) to $(BINDIR)"; \
	fi
	@echo "Run 'gofi --help' to get started"

# Uninstall
uninstall:
	@echo "Removing $(NEW_BINARY_NAME) from $(BINDIR)..."
	@if [ -w $(BINDIR)/$(NEW_BINARY_NAME) ]; then \
		rm -f $(BINDIR)/$(NEW_BINARY_NAME); \
	else \
		sudo rm -f $(BINDIR)/$(NEW_BINARY_NAME); \
	fi
	@echo "✓ Uninstalled $(NEW_BINARY_NAME)"

pkg: clean-pkg
	mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 $(GOBUILD) -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 $(CLI_PACKAGE)
	GOOS=linux GOARCH=arm64 CGO_ENABLED=0 $(GOBUILD) -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 $(CLI_PACKAGE)
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 $(GOBUILD) -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)-macos-amd64 $(CLI_PACKAGE)
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 $(GOBUILD) -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)-macos-arm64 $(CLI_PACKAGE)
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 $(GOBUILD) -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)-win-amd64.exe $(CLI_PACKAGE)
	GOOS=windows GOARCH=arm64 CGO_ENABLED=0 $(GOBUILD) -ldflags "$(LDFLAGS)" -o $(BUILD_DIR)/$(BINARY_NAME)-win-arm64.exe $(CLI_PACKAGE)
	cd $(BUILD_DIR) && cp $(BINARY_NAME)-linux-amd64 $(BINARY_NAME) && zip -q $(BINARY_NAME)-linux.zip $(BINARY_NAME) && rm $(BINARY_NAME)
	cd $(BUILD_DIR) && cp $(BINARY_NAME)-linux-arm64 $(BINARY_NAME) && zip -q $(BINARY_NAME)-linux-arm64.zip $(BINARY_NAME) && rm $(BINARY_NAME)
	cd $(BUILD_DIR) && cp $(BINARY_NAME)-macos-amd64 $(BINARY_NAME) && zip -q $(BINARY_NAME)-macos.zip $(BINARY_NAME) && rm $(BINARY_NAME)
	cd $(BUILD_DIR) && cp $(BINARY_NAME)-macos-arm64 $(BINARY_NAME) && zip -q $(BINARY_NAME)-macos-arm64.zip $(BINARY_NAME) && rm $(BINARY_NAME)
	cd $(BUILD_DIR) && cp $(BINARY_NAME)-win-amd64.exe $(BINARY_NAME).exe && cp ../scripts/windows/$(BINARY_NAME).bat $(BINARY_NAME).bat && zip -q $(BINARY_NAME)-win.zip $(BINARY_NAME).exe $(BINARY_NAME).bat && rm $(BINARY_NAME).exe $(BINARY_NAME).bat
	cd $(BUILD_DIR) && cp $(BINARY_NAME)-win-arm64.exe $(BINARY_NAME).exe && cp ../scripts/windows/$(BINARY_NAME).bat $(BINARY_NAME).bat && zip -q $(BINARY_NAME)-win-arm64.zip $(BINARY_NAME).exe $(BINARY_NAME).bat && rm $(BINARY_NAME).exe $(BINARY_NAME).bat
	rm -f $(BUILD_DIR)/$(BINARY_NAME)-linux-amd64 $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64 $(BUILD_DIR)/$(BINARY_NAME)-macos-amd64 $(BUILD_DIR)/$(BINARY_NAME)-macos-arm64 $(BUILD_DIR)/$(BINARY_NAME)-win-amd64.exe $(BUILD_DIR)/$(BINARY_NAME)-win-arm64.exe
	du -sh $(BUILD_DIR)/*.zip
	$(MAKE) verify-pkg

verify-pkg:
	test "$$(unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-linux.zip)" = "$(BINARY_NAME)"
	test "$$(unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-linux-arm64.zip)" = "$(BINARY_NAME)"
	test "$$(unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-macos.zip)" = "$(BINARY_NAME)"
	test "$$(unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-macos-arm64.zip)" = "$(BINARY_NAME)"
	test "$$(unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-win.zip | wc -l | tr -d ' ')" = "2"
	unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-win.zip | grep -Fxq "$(BINARY_NAME).exe"
	unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-win.zip | grep -Fxq "$(BINARY_NAME).bat"
	test "$$(unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-win-arm64.zip | wc -l | tr -d ' ')" = "2"
	unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-win-arm64.zip | grep -Fxq "$(BINARY_NAME).exe"
	unzip -Z1 $(BUILD_DIR)/$(BINARY_NAME)-win-arm64.zip | grep -Fxq "$(BINARY_NAME).bat"
	@echo "Package archives verified."

clean-pkg:
	rm -rf $(BUILD_DIR)

clean: clean-pkg
	$(GOCLEAN)
	rm -f $(BINARY_NAME) $(NEW_BINARY_NAME)

test:
	$(GOCLEAN) -testcache
	$(GOTEST) -v ./...

# Default target
default: build-cli

.PHONY: build build-cli build-all install install-dev uninstall pkg verify-pkg clean-pkg clean test default
