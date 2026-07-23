package ui

import (
	"fmt"
	"os"

	"github.com/fatih/color"
	"github.com/mattn/go-isatty"
)

// Initialize color settings based on TTY detection
func init() {
	// Disable colors if output is not a terminal
	color.NoColor = !isatty.IsTerminal(os.Stdout.Fd()) && !isatty.IsCygwinTerminal(os.Stdout.Fd())
}

// Color definitions
var (
	// Success messages (green)
	successColor = color.New(color.FgGreen).SprintfFunc()
	successBold  = color.New(color.FgGreen, color.Bold).SprintfFunc()

	// Error messages (red)
	errorColor = color.New(color.FgRed).SprintfFunc()
	errorBold  = color.New(color.FgRed, color.Bold).SprintfFunc()

	// Warning messages (yellow)
	warningColor = color.New(color.FgYellow).SprintfFunc()
	warningBold  = color.New(color.FgYellow, color.Bold).SprintfFunc()

	// Info messages (blue)
	infoColor = color.New(color.FgBlue).SprintfFunc()
	infoBold  = color.New(color.FgBlue, color.Bold).SprintfFunc()

	// Header messages (cyan + bold)
	headerColor = color.New(color.FgCyan, color.Bold).SprintfFunc()

	// Highlight text (magenta)
	highlightColor = color.New(color.FgMagenta).SprintfFunc()

	// Dim text (gray)
	dimColor = color.New(color.Faint).SprintfFunc()
)

// Success prints a success message in green
func Success(format string, a ...interface{}) {
	fmt.Println(successColor(format, a...))
}

// SuccessBold prints a bold success message in green
func SuccessBold(format string, a ...interface{}) {
	fmt.Println(successBold(format, a...))
}

// Error prints an error message in red
func Error(format string, a ...interface{}) {
	fmt.Fprintln(os.Stderr, errorColor(format, a...))
}

// ErrorBold prints a bold error message in red
func ErrorBold(format string, a ...interface{}) {
	fmt.Fprintln(os.Stderr, errorBold(format, a...))
}

// Warning prints a warning message in yellow
func Warning(format string, a ...interface{}) {
	fmt.Println(warningColor(format, a...))
}

// WarningBold prints a bold warning message in yellow
func WarningBold(format string, a ...interface{}) {
	fmt.Println(warningBold(format, a...))
}

// Info prints an info message in blue
func Info(format string, a ...interface{}) {
	fmt.Println(infoColor(format, a...))
}

// InfoBold prints a bold info message in blue
func InfoBold(format string, a ...interface{}) {
	fmt.Println(infoBold(format, a...))
}

// Header prints a header message in cyan and bold
func Header(format string, a ...interface{}) {
	fmt.Println(headerColor(format, a...))
}

// Highlight prints highlighted text in magenta
func Highlight(format string, a ...interface{}) {
	fmt.Println(highlightColor(format, a...))
}

// Dim prints dimmed text
func Dim(format string, a ...interface{}) {
	fmt.Println(dimColor(format, a...))
}

// Print functions that return strings (for inline use)

// SuccessString returns a success-colored string
func SuccessString(format string, a ...interface{}) string {
	return successColor(format, a...)
}

// ErrorString returns an error-colored string
func ErrorString(format string, a ...interface{}) string {
	return errorColor(format, a...)
}

// WarningString returns a warning-colored string
func WarningString(format string, a ...interface{}) string {
	return warningColor(format, a...)
}

// InfoString returns an info-colored string
func InfoString(format string, a ...interface{}) string {
	return infoColor(format, a...)
}

// HeaderString returns a header-colored string
func HeaderString(format string, a ...interface{}) string {
	return headerColor(format, a...)
}

// HighlightString returns a highlighted string
func HighlightString(format string, a ...interface{}) string {
	return highlightColor(format, a...)
}

// DimString returns a dimmed string
func DimString(format string, a ...interface{}) string {
	return dimColor(format, a...)
}

// Additional icons for visual feedback
const (
	IconArrow = "→"
	IconDot   = "•"
)

// PrintWithIcon prints a message with an icon
func PrintWithIcon(icon, format string, a ...interface{}) {
	fmt.Printf("%s %s\n", icon, fmt.Sprintf(format, a...))
}

// SuccessWithIcon prints a success message with a checkmark
func SuccessWithIcon(format string, a ...interface{}) {
	fmt.Println(successColor("%s %s", IconSuccess, fmt.Sprintf(format, a...)))
}

// ErrorWithIcon prints an error message with an X
func ErrorWithIcon(format string, a ...interface{}) {
	fmt.Fprintln(os.Stderr, errorColor("%s %s", IconError, fmt.Sprintf(format, a...)))
}

// WarningWithIcon prints a warning message with a warning symbol
func WarningWithIcon(format string, a ...interface{}) {
	fmt.Println(warningColor("%s %s", IconWarning, fmt.Sprintf(format, a...)))
}

// InfoWithIcon prints an info message with an info symbol
func InfoWithIcon(format string, a ...interface{}) {
	fmt.Println(infoColor("%s %s", IconInfo, fmt.Sprintf(format, a...)))
}
