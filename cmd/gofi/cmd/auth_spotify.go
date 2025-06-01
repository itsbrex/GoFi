// cmd/gofi/cmd/auth_spotify.go
package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/d-fi/GoFi/internal/services/spotify" // Corrected import path
	"github.com/d-fi/GoFi/internal/ui"
	"github.com/d-fi/GoFi/logger"
	"github.com/spf13/cobra"
)

// spotifyAuthCmd represents the command to authenticate with Spotify
var spotifyAuthCmd = &cobra.Command{
	Use:   "spotify",
	Short: "Authenticate GoFi with your Spotify account",
	Long: `Starts the OAuth2 flow to authorize GoFi to access your Spotify account.
You will be prompted to open a URL in your browser to grant permission.
Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables to be set.`,
	Run: func(cmd *cobra.Command, args []string) {
		dm := ui.NewDisplayManager()
		dm.PrintHeader("Spotify Authentication")
		
		clientID := os.Getenv("SPOTIFY_CLIENT_ID")
		clientSecret := os.Getenv("SPOTIFY_CLIENT_SECRET")

		if clientID == "" || clientSecret == "" {
			dm.PrintError("SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables must be set.")
			fmt.Println()
			dm.PrintInfo("To get these credentials:")
			dm.PrintInfo("1. Visit https://developer.spotify.com/dashboard")
			dm.PrintInfo("2. Create a new app or use an existing one")
			dm.PrintInfo("3. Copy the Client ID and Client Secret")
			dm.PrintInfo("4. Set them as environment variables:")
			dm.PrintInfo("   export SPOTIFY_CLIENT_ID='your-client-id'")
			dm.PrintInfo("   export SPOTIFY_CLIENT_SECRET='your-client-secret'")
			logger.Fatal("Missing required environment variables")
			return
		}

		cfg := spotify.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
		}

		authService, err := spotify.NewAuthService(cfg)
		if err != nil {
			dm.PrintError("Error creating Spotify auth service: %v", err)
			logger.Fatal("Error creating Spotify auth service: %v", err)
		}

		dm.PrintInfo("Starting Spotify authentication process...")
		dm.PrintInfo("A browser window will open for you to authenticate...")
		fmt.Println()
		
		// Use context.Background() for this CLI command execution context
		client, err := authService.StartAuthentication(context.Background())
		if err != nil {
			dm.PrintError("Spotify authentication failed: %v", err)
			logger.Fatal("Spotify authentication failed: %v", err)
		}

		if client != nil {
			// Optionally, verify the client works by making a simple API call
			user, err := client.CurrentUser(context.Background())
			if err != nil {
				dm.PrintWarning("Could not verify authentication by fetching user: %v", err)
				dm.PrintInfo("Authentication process completed, but verification failed. Token might be stored.")
			} else {
				fmt.Println()
				dm.PrintSuccess("Successfully authenticated with Spotify!")
				dm.PrintInfo("Logged in as: %s (%s)", user.DisplayName, user.ID)
				dm.PrintSuccess("Authentication token saved successfully.")
				fmt.Println()
				dm.PrintInfo("You can now use Spotify URLs with GoFi!")
			}
		} else {
			// This case should ideally be caught by the error above, but added for completeness
			dm.PrintError("Authentication process completed, but no valid client was returned.")
			logger.Fatal("Authentication process completed, but no valid client was returned.")
		}
	},
}

// init function is already called from auth.go
// No need to add logging or registration here
func init() {
	// Empty init function - registration handled in auth.go
}