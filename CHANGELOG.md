# Changelog

## 0.3.0

### Fixed
- Switch background to `scripts` array for Firefox MV3 compatibility
- Add `browser_specific_settings` for Gecko add-on ID

## 0.2.0

### Added
- Show iframe page title in peek header (same-origin read, cross-origin via fetch)
- Make peek window draggable via header with pointer capture
- Error handling for iframe-blocked sites (CSP / X-Frame-Options) with "Open in new tab" link
- Resizable peek overlay via bottom-right drag handle with pointer events
- Loading spinner animation while iframe loads
- Action buttons in header: fullscreen (CSS viewport fill), open in new tab, close
- Content script and overlay styles for the peek preview window
- Context menu integration with background service worker

### Fixed
- Resize now works over iframe content (pointer capture replaces mouse events)
- Resize state properly cancelled on any overlay removal
- Visible resize handle with larger hit area and background
- Native fullscreen API replaced with CSS viewport fullscreen to keep parent page visible

## [alpha 0.1.0] - Initial Release

- Basic context menu "Peek" option on links
- Overlay preview with iframe
- Extension manifest with required permissions
