# Canvas LMS GraphQL Chrome Extension

A simple proof-of-concept Chrome extension to test Canvas LMS GraphQL API calls using the user's existing cookies.

**Compatible with:** Chrome, Edge, Opera, Opera GX, and other Chromium-based browsers

## Setup

1. **Create Icon Files** (required for extension):
   - Create three PNG files: `icon16.png`, `icon48.png`, and `icon128.png`
   - You can use any simple icon or create placeholder images
   - Minimum sizes: 16x16, 48x48, and 128x128 pixels
   - Or use the `generate-icons.html` file to generate simple placeholder icons

2. **Load the Extension**:

   **For Chrome/Edge:**
   - Navigate to `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this directory

   **For Opera GX:**
   - Navigate to `opera://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select this directory
   - Note: Opera GX is Chromium-based and fully supports this extension

## Usage

1. Navigate to your Canvas LMS instance (e.g., `https://your-school.instructure.com`)
2. Click the extension icon in your Chrome toolbar
3. The extension will auto-detect the Canvas URL from the current tab, or you can enter it manually
4. Click "Fetch Courses" to make the GraphQL API call
5. The results will be displayed in the popup

## GraphQL Query

The extension makes the following GraphQL query:

```graphql
query MyQuery {
  allCourses {
    name
  }
}
```

## Notes

- This extension uses the user's existing cookies for authentication
- The request is made through a background service worker to properly handle cookies
- If you get CORS errors, make sure you're logged into Canvas in the same browser session
- The extension will try multiple query formats automatically if one fails

## Troubleshooting

If you get an "unprocessable_content" error:

1. **Check available queries**: Canvas provides a GraphiQL interface at `https://your-canvas-instance.instructure.com/graphiql` where you can explore available queries and test them interactively.

2. **Verify you're logged in**: Make sure you're logged into Canvas in the same browser session.

3. **Check permissions**: Ensure your Canvas account has permission to access course data via the GraphQL API.

4. **Try different queries**: The extension will automatically try multiple query formats. If all fail, you may need to check the Canvas GraphQL schema to see what queries are actually available for your instance.

