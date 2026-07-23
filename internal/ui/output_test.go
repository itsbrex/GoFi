package ui

import (
	"io"
	"os"
	"strings"
	"testing"

	"github.com/fatih/color"
)

func TestColorOutput(t *testing.T) {
	// Test with colors enabled
	t.Run("Colors Enabled", func(t *testing.T) {
		color.NoColor = false

		tests := []struct {
			name     string
			function func()
			contains string
		}{
			{
				name: "Success message contains green ANSI code",
				function: func() {
					Success("Test success")
				},
				contains: "\033[32m", // Green ANSI code
			},
			{
				name: "Error message contains red ANSI code",
				function: func() {
					Error("Test error")
				},
				contains: "\033[31m", // Red ANSI code
			},
			{
				name: "Warning message contains yellow ANSI code",
				function: func() {
					Warning("Test warning")
				},
				contains: "\033[33m", // Yellow ANSI code
			},
			{
				name: "Info message contains blue ANSI code",
				function: func() {
					Info("Test info")
				},
				contains: "\033[34m", // Blue ANSI code
			},
			{
				name: "Header message contains cyan ANSI code",
				function: func() {
					Header("Test header")
				},
				contains: "\033[36;1m", // Cyan + Bold ANSI code
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				output := captureOutput(tt.function)
				if !strings.Contains(output, tt.contains) {
					t.Errorf("Expected output to contain %q, got %q", tt.contains, output)
				}
			})
		}
	})

	// Test with colors disabled
	t.Run("Colors Disabled", func(t *testing.T) {
		color.NoColor = true

		tests := []struct {
			name         string
			function     func()
			expectedText string
			notContains  string
		}{
			{
				name: "Success message without ANSI codes",
				function: func() {
					Success("Test success")
				},
				expectedText: "Test success",
				notContains:  "\033[",
			},
			{
				name: "Error message without ANSI codes",
				function: func() {
					Error("Test error")
				},
				expectedText: "Test error",
				notContains:  "\033[",
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				output := captureOutput(tt.function)
				if !strings.Contains(output, tt.expectedText) {
					t.Errorf("Expected output to contain %q, got %q", tt.expectedText, output)
				}
				if strings.Contains(output, tt.notContains) {
					t.Errorf("Expected output to not contain ANSI codes, got %q", output)
				}
			})
		}

		// Reset color setting
		color.NoColor = false
	})
}

func TestStringFunctions(t *testing.T) {
	color.NoColor = false

	tests := []struct {
		name     string
		function func() string
		input    string
		contains string
	}{
		{
			name:     "SuccessString",
			function: func() string { return SuccessString("Test %s", "success") },
			contains: "Test success",
		},
		{
			name:     "ErrorString",
			function: func() string { return ErrorString("Test %s", "error") },
			contains: "Test error",
		},
		{
			name:     "WarningString",
			function: func() string { return WarningString("Test %s", "warning") },
			contains: "Test warning",
		},
		{
			name:     "InfoString",
			function: func() string { return InfoString("Test %s", "info") },
			contains: "Test info",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.function()
			if !strings.Contains(result, tt.contains) {
				t.Errorf("Expected result to contain %q, got %q", tt.contains, result)
			}
		})
	}
}

func TestIconFunctions(t *testing.T) {
	tests := []struct {
		name     string
		function func()
		contains string
	}{
		{
			name: "SuccessWithIcon",
			function: func() {
				SuccessWithIcon("Operation completed")
			},
			contains: IconSuccess,
		},
		{
			name: "ErrorWithIcon",
			function: func() {
				ErrorWithIcon("Operation failed")
			},
			contains: IconError,
		},
		{
			name: "WarningWithIcon",
			function: func() {
				WarningWithIcon("Operation warning")
			},
			contains: IconWarning,
		},
		{
			name: "InfoWithIcon",
			function: func() {
				InfoWithIcon("Operation info")
			},
			contains: IconInfo,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			output := captureOutput(tt.function)
			if !strings.Contains(output, tt.contains) {
				t.Errorf("Expected output to contain icon %q, got %q", tt.contains, output)
			}
		})
	}
}

// captureOutput captures stdout and stderr output from a function
func captureOutput(f func()) string {
	// Save current stdout and stderr
	oldStdout := os.Stdout
	oldStderr := os.Stderr

	// Create pipes
	r, w, _ := os.Pipe()
	os.Stdout = w
	os.Stderr = w

	// Run the function
	f()

	// Close writer and restore stdout/stderr
	w.Close()
	os.Stdout = oldStdout
	os.Stderr = oldStderr

	// Read output
	out, _ := io.ReadAll(r)
	return string(out)
}
