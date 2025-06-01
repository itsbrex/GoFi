package cmd

import (
	"github.com/d-fi/GoFi/internal/ui"
	"github.com/spf13/cobra"
)

// authCmd represents the auth command
var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Authenticate with music services",
	Long:  `Authenticate with supported music services like Spotify and Deezer.`,
	Run: func(cmd *cobra.Command, args []string) {
		dm := ui.NewDisplayManager()
		dm.PrintHeader("Authentication")
		dm.PrintInfo("Please specify a service to authenticate with:")
		dm.PrintInfo("  gofi auth spotify - Authenticate with Spotify")
		dm.PrintInfo("  gofi auth deezer  - Authenticate with Deezer")
	},
}

func init() {
	// Add sub-commands to auth
	authCmd.AddCommand(spotifyAuthCmd)
}