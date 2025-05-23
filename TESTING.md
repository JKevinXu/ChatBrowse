# ChatBrowse Extension Testing Guide

## 🧪 Testing Scenarios

### **1. Basic Chat Functionality**
Open the popup and try these commands:

```
help
```
**Expected**: Help message explaining available commands

```
Hello, what can you do?
```
**Expected**: GPT-4-turbo response explaining capabilities

### **2. Navigation Testing**
Navigate to different websites:

```
go to github.com
```
**Expected**: 
- Browser navigates to GitHub
- Page content appears in current tab
- AI responds with page summary

```
navigate to reddit.com
```
**Expected**: Same navigation behavior

### **3. Search Testing**
Try different search engines:

```
google search artificial intelligence
```
**Expected**: Google search results in current tab

```
search for machine learning on bilibili
```
**Expected**: Bilibili search results

```
xiaohongshu search travel tips
```
**Expected**: Xiaohongshu search results

### **4. Intelligent Page Reading**
On any webpage, try:

```
summarize this page
```
**Expected**: 
- AI analyzes current page content
- Provides detailed summary with title and URL
- Uses GPT-4-turbo intelligence

```
what's on this page?
```
**Expected**: Contextual analysis of page content

### **5. Smart Action Commands**
On a webpage with forms/buttons:

```
find the search box on this page
```
**Expected**: 
- AI analyzes page structure
- Identifies search elements
- Provides specific CSS selectors

```
click the login button
```
**Expected**:
- AI suggests clicking login button
- Provides exact element location

```
fill out the contact form
```
**Expected**:
- AI identifies form fields
- Suggests how to fill them

### **6. Advanced Action Execution**
Try action commands with execution:

```
find the search box and do it
```
**Expected**:
- AI analyzes page
- Plans action sequence
- Executes actions automatically
- Reports results

### **7. Context-Aware Conversations**
Enable context mode:

```
setcontext on
```
**Expected**: Page content used in all future conversations

Then ask:
```
what products are available?
```
**Expected**: AI answers based on current page content

### **8. Page Structure Analysis**
Test the intelligent page analysis:

```
what buttons are available on this page?
```
**Expected**: 
- Detailed list of clickable elements
- Button text and locations
- Confidence scores

```
what forms can I fill out here?
```
**Expected**:
- Form field analysis
- Input types and requirements
- Submit button locations

## 🔍 What to Look For

### **✅ Success Indicators**
- Extension icon appears in toolbar
- Popup opens smoothly
- Chat interface loads
- API calls work (requires OpenAI key)
- Navigation happens in current tab
- Page content is extracted correctly
- GPT-4-turbo provides intelligent responses
- Smart actions are suggested accurately

### **❌ Common Issues & Solutions**

**Issue**: "API key required" 
**Solution**: Add OpenAI API key in settings

**Issue**: No response from AI
**Solution**: Check API key, internet connection

**Issue**: Content script errors
**Solution**: Refresh the page, reload extension

**Issue**: Navigation doesn't work
**Solution**: Check popup blocker, permissions

## 🎯 Testing Different Page Types

### **E-commerce Sites** (Amazon, eBay)
- Product search
- Add to cart actions
- Form filling

### **Social Media** (Twitter, Reddit)
- Content summarization
- Navigation within site
- Search functionality

### **News Sites** (CNN, BBC)
- Article summarization
- Link analysis
- Content extraction

### **Documentation Sites** (GitHub, Stack Overflow)
- Code analysis
- Link following
- Search within site

## 🛠️ Debug Mode

Enable debug mode for detailed logging:
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Watch for ChatBrowse logs
4. Look for "BACKGROUND:", "CONTENT:", "POPUP:" messages

## 📊 Performance Testing

Test with different scenarios:
- Large pages (>1MB content)
- JavaScript-heavy sites
- Multiple tabs open
- Rapid command sequences
- Long conversations

## 🔧 Developer Testing

If you're developing:
1. Make changes to source code
2. Run `npm run build`
3. Click "Reload" button on extension card
4. Test new functionality
5. Check console for errors 