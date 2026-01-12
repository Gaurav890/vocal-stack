# vocal-stack StackBlitz Demos

Interactive browser-based demos you can try **without installing anything**!

## 🚀 Try Online Now

Click any demo below to open it directly in your browser:

| Demo | Description | Try It |
|------|-------------|--------|
| **01-basic-sanitizer** | Text cleaning for TTS | [Open →](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer) |
| **02-flow-control** | Filler injection & latency | [Open →](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/02-flow-control) |
| **03-full-pipeline** | All modules together | [Open →](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline) |

## 📋 What's Included

### 1. Basic Sanitizer Demo
**Interactive text sanitization**

- Select sanitization rules
- Try preset examples
- See before/after comparison
- View statistics (chars removed, reduction %)

**Perfect for**: Understanding text cleaning for TTS

### 2. Flow Control Demo
**Live LLM stream simulation**

- Configure stall threshold
- Toggle filler injection
- Visual timeline of events
- Performance metrics (TTFT, stalls)

**Perfect for**: Understanding latency handling

### 3. Full Pipeline Demo
**Complete vocal-stack pipeline**

- All three modules working together
- Side-by-side raw vs cleaned output
- Visual pipeline flow
- Comprehensive metrics

**Perfect for**: Understanding how everything integrates

## 🎯 Quick Start

### Option 1: Open in StackBlitz (Easiest!)

1. Click any "Open →" link above
2. Wait for StackBlitz to load (10-20 seconds)
3. The demo opens automatically in browser
4. Start interacting!

**No installation required!** ✨

### Option 2: Fork and Customize

1. Open demo in StackBlitz
2. Click "Fork" button (top right)
3. Edit code in browser
4. See changes instantly
5. Share your custom version!

### Option 3: Run Locally

```bash
# Clone the repo
git clone https://github.com/gaurav890/vocal-stack
cd vocal-stack/stackblitz-demos/01-basic-sanitizer

# Install & run
npm install
npm run dev

# Open http://localhost:5173
```

## 🛠️ How to Create StackBlitz Links

Once you push to GitHub, StackBlitz links work automatically:

```
https://stackblitz.com/github/{username}/{repo}/tree/{branch}/{path}
```

Example:
```
https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer
```

### Steps to Set Up

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add StackBlitz demos"
   git push origin main
   ```

2. **Test the Link**
   - Replace `gaurav890` with your GitHub username
   - Open: `https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer`

3. **Update README Links**
   - Update the table above with your username
   - Update individual demo READMEs

## 📝 How to Add to Main README

Add this section to your main README.md:

```markdown
## Try It Online

Play with vocal-stack in your browser (no installation needed):

| Demo | What it shows |
|------|---------------|
| [Basic Sanitizer](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer) | Text cleaning for TTS |
| [Flow Control](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/02-flow-control) | Filler injection & latency |
| [Full Pipeline](https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline) | All modules together |
```

## 🎨 Demo Features

All demos include:
- ✅ Modern, responsive UI
- ✅ Interactive controls
- ✅ Real-time updates
- ✅ Visual feedback
- ✅ Statistics & metrics
- ✅ Mobile-friendly
- ✅ No build step required

## 🔧 Tech Stack

- **vocal-stack** - The library itself
- **Vite** - Fast dev server & build tool
- **Vanilla JS** - No framework dependencies
- **Modern CSS** - Clean, responsive design
- **ES Modules** - Modern JavaScript

## 📚 Learn More

Each demo includes:
- Comprehensive README
- Inline code comments
- Usage examples
- Links to full documentation

### Demo Structure

```
01-basic-sanitizer/
├── package.json      # Dependencies
├── index.html        # UI
├── index.js          # Logic using vocal-stack
└── README.md         # Instructions
```

## 💡 Tips for Using Demos

### For Learning
1. Start with **Basic Sanitizer** (simplest)
2. Move to **Flow Control** (more interactive)
3. Finish with **Full Pipeline** (complete picture)

### For Sharing
1. Open demo in StackBlitz
2. Fork it
3. Customize for your use case
4. Share the URL!

### For Development
1. Clone locally
2. Edit demo files
3. See changes with hot reload
4. Test your ideas quickly

## 🤝 Contributing Demos

Want to add a demo? Great!

1. Create new folder: `04-your-demo/`
2. Follow the existing structure
3. Include:
   - `package.json` with vocal-stack dependency
   - `index.html` with UI
   - `index.js` with demo logic
   - `README.md` with instructions
4. Test locally first
5. Submit PR!

## 🐛 Troubleshooting

### Demo not loading in StackBlitz?
- Wait 30 seconds (sometimes takes time)
- Try refreshing the page
- Check browser console for errors

### Changes not appearing?
- Hard refresh (Ctrl+Shift+R)
- Clear StackBlitz cache
- Try in incognito mode

### Local demo not working?
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 📧 Support

- 💬 [GitHub Issues](https://github.com/gaurav890/vocal-stack/issues)
- 📖 [Main Documentation](../README.md)
- 📦 [npm Package](https://www.npmjs.com/package/vocal-stack)

## ⭐ Feedback

Found these demos helpful?
- ⭐ Star the repo
- 🐛 Report issues
- 💡 Suggest improvements
- 🔀 Submit PRs

---

**Made with ❤️ for the Voice AI community**

[⬆ Back to main repo](../README.md)
