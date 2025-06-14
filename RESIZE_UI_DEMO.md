# 🎛️ ChatBrowse - Resizable UI Demo

## ✨ New Features Added

### 1. **Content Script Chat Window**
- **Resizable**: Drag the corners to resize (CSS `resize: both`)
- **Draggable**: Click and drag the header to move the window
- **Size Presets**: Click the `⤢` button to cycle between two sizes:
  - Default: 450×600px (compact)
  - Large: 650×750px (expanded)
- **Persistent**: Remembers size and position between sessions
- **Boundaries**: Stays within viewport bounds when dragging

### 2. **Popup Window**
- **Size Cycling**: Click the `⤢` button in header to toggle between sizes
- **Two Sizes**:
  - Default: 450×600px (compact)
  - Large: 650×800px (expanded)
- **Persistent**: Remembers size preference

## 🎯 How to Use

### Content Script (In-page Chat):
1. **Resize manually**: Drag from bottom-right corner
2. **Quick toggle**: Click the diagonal arrow `⤢` in header to toggle between compact and expanded
3. **Move window**: Drag the header area (avoid buttons)
4. **Your settings are saved automatically**

### Popup:
1. **Toggle sizes**: Click the `⤢` button next to refresh to switch between compact and expanded
2. **Size persists**: Reopen popup to see saved size

## 🔧 Technical Implementation

### CSS Changes:
```css
.chatbrowse-chat {
  resize: both;
  min-width: 320px;
  min-height: 400px;
  max-width: 800px;
  max-height: 800px;
}
```

### JavaScript Features:
- `cycleChatSize()` - Cycles through preset sizes
- `makeDraggable()` - Enables header dragging with bounds checking
- `saveChatSize()` / `loadChatSize()` - Persistent storage
- `saveChatPosition()` - Remembers window position

### Storage:
- `chatbrowse-size` - Stores width/height
- `chatbrowse-position` - Stores left/top coordinates
- `chatbrowse-popup-size` - Popup dimensions

## 💡 Benefits

1. **Better UX**: Users can adjust chat to their preference
2. **Space Efficient**: Can make smaller for more browsing space
3. **Content Heavy**: Can make larger for longer conversations
4. **Persistent**: Settings remembered across sessions
5. **Mobile Friendly**: Minimum sizes ensure usability

## 🎨 Visual Indicators

- **Resize Handle**: Subtle diagonal lines in bottom-right corner
- **Draggable Header**: Cursor changes to move icon
- **Size Button**: `⤢` icon for quick size changes
- **Smooth Transitions**: Animated size changes

The chat UI is now fully adjustable and user-friendly! 🚀 

### 🎯 **Size Options:**
- **Compact**: 450×600px (balanced viewing)
- **Expanded**: 650×750px/800px (more space for content)

### 🔧 **Technical Features:**
- **Toggle Button**: `⤢` icon for quick size switching
- **Manual Resize**: Drag corners for custom sizes
- **Smart Memory**: Remembers your preferred size and position 