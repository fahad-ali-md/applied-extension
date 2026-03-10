# Debug CV Upload Issue

## Step 1: Check Browser Console

1. Right-click on the page → Inspect (F12)
2. Go to **Console** tab
3. Run this command:

```javascript
// Check if CV is stored
chrome.storage.local.get(['parsedCV'], (result) => {
  console.log('CV Data:', result);
  if (result.parsedCV) {
    console.log('✅ CV Found!');
    console.log('Personal:', result.parsedCV.personal);
    console.log('Professional:', result.parsedCV.professional);
    console.log('Skills:', result.parsedCV.skills);
  } else {
    console.log('❌ No CV found');
  }
});
```

## Step 2: Check for Errors

Look in console for red errors like:
- `SyntaxError: Expected ',' or ']'` → JSON parsing failed
- `ZodError: Invalid input` → Data validation failed  
- `Failed to parse CV` → AI parsing failed

## Step 3: Re-upload CV

1. Go to extension settings (click gear icon)
2. Go to **CV** tab
3. Upload your PDF again
4. Watch console for errors

## Common Issues & Solutions

### Issue 1: "Empty response from AI"
**Cause:** Model not working  
**Fix:** Use `openrouter/free` or `arcee-ai/trinity-large-preview:free`

### Issue 2: "JSON parse error"
**Cause:** AI returned malformed JSON  
**Fix:** Already fixed in latest build - reload extension

### Issue 3: "Zod validation error"
**Cause:** AI returned wrong field format  
**Fix:** Already fixed with field mapping - reload extension

## What to Do Now:

1. **Reload extension** at `chrome://extensions/`
2. **Re-upload CV** in Settings → CV tab
3. **Fill form** on job application page
4. If still broken, copy console errors and share
