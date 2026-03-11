# Applied AI Assistant - Chrome Extension

🤖 An intelligent Chrome extension that automatically parses CVs/resumes and fills job application forms using AI.

## ✨ Features

- **AI-Powered CV Parsing**: Extracts structured data from CVs using multiple AI providers
- **Automatic Form Filling**: Fills job application forms with parsed CV data
- **Multi-Provider Support**: Works with OpenAI, Google Gemini, Zhipu AI, and OpenRouter
- **Smart Fallback System**: Automatically rotates through AI models when rate limits occur
- **Real-time Validation**: Validates form fields and provides feedback

## 🚀 Latest Updates

### v1.2.0 (2026-03-11) - OpenRouter Optimization

**Major Improvements:**
- ✅ Implemented 5-model fallback system for OpenRouter
- ✅ Optimized model priority based on comprehensive speed testing
- ✅ Fixed TypeScript compilation errors
- ✅ Added detailed console logging for debugging

**Model Performance Rankings:**
1. 🚀 NVIDIA Nemotron (620ms) - Primary
2. Arcee Trinity (1135ms) - Backup
3. LFM 2.5 (1161ms) - Backup
4. OpenRouter Free (1971ms) - Backup
5. Z.ai GLM 4.5 (9838ms) - Last Resort

## 🛠️ Tech Stack

- **Frontend**: React, TypeScript, Vite
- **Backend**: Chrome Extension Manifest V3
- **AI Providers**: OpenAI, Gemini, Zhipu, OpenRouter
- **Build Tools**: TypeScript, Vite, Rollup

## 📦 Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/md-fahad-ali/applied-extension.git
cd applied-extension

# Install dependencies
npm install

# Build the extension
npm run build

# Load in Chrome
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the `build/` directory
```

## 🔑 Configuration

### API Keys

The extension supports multiple AI providers. Add your API keys in the extension options:

1. Click the extension icon
2. Go to "Options"
3. Add your API keys:
   - **OpenAI**: Get from https://platform.openai.com/api-keys
   - **Gemini**: Get from https://aistudio.google.com/app/apikey
   - **Zhipu**: Get from https://open.bigmodel.cn/usercenter/apikeys
   - **OpenRouter**: Get from https://openrouter.ai/keys

## 📖 Usage

### Parse a CV

1. Copy your CV text to clipboard
2. Click the extension icon
3. Select "Parse CV"
4. View extracted structured data

### Fill Job Applications

1. Navigate to a job application form
2. Click "Fill Form" in the extension
3. The extension will automatically fill fields with your CV data

## 🧪 Testing

```bash
# Run tests
npm test

# Test OpenRouter fallback system
node test-fallback-system.js

# Test model availability
node test-openrouter-models.js
```

## 📊 Model Performance

### OpenRouter Models (Tested 2026-03-11)

| Model | Status | Speed | Quality |
|-------|--------|-------|---------|
| nvidia/nemotron-3-nano-30b-a3b:free | ✅ Working | 620ms | Excellent |
| arcee-ai/trinity-large-preview:free | ✅ Working | 1135ms | Excellent |
| liquid/lfm-2.5-1.2b-instruct:free | ✅ Working | 1161ms | Good |
| openrouter/free | ✅ Working | 1971ms | Excellent |
| z-ai/glm-4.5-air:free | ✅ Working | 9838ms | Excellent |
| google/gemma-3-4b-it:free | 🔴 Rate Limited | - | - |

## 🔄 Version History

- **v1.2.0** - OpenRouter optimization with 5-model fallback
- **v1.1.0** - Added multiple AI provider support
- **v1.0.0** - Initial release

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**MD Fahad Ali**
- GitHub: [@md-fahad-ali](https://github.com/md-fahad-ali)
- Email: fahad288ali@gmail.com

## 🙏 Acknowledgments

- AI providers: OpenAI, Google, Zhipu, OpenRouter
- Chrome Extension documentation
- The open-source community

---

⭐ If you find this project helpful, please give it a star!
