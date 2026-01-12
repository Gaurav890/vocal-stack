# StackBlitz Demos Setup Guide

Quick guide to get your StackBlitz demos live!

## Prerequisites

- ✅ GitHub repository created
- ✅ Code pushed to GitHub
- ✅ vocal-stack published to npm (done - v1.0.1)

## Step 1: Update GitHub Username

Replace `gaurav890` with your actual GitHub username in these files:

### Files to Update:

1. **stackblitz-demos/README.md** (3 occurrences)
2. **stackblitz-demos/01-basic-sanitizer/README.md** (1 occurrence)
3. **stackblitz-demos/02-flow-control/README.md** (1 occurrence)
4. **stackblitz-demos/03-full-pipeline/README.md** (1 occurrence)

### Find & Replace:

```bash
# From stackblitz-demos directory
find . -type f -name "*.md" -exec sed -i '' 's/gaurav890/YOUR_GITHUB_USERNAME/g' {} +
```

Or manually replace: `gaurav890` → `your-actual-username`

## Step 2: Push to GitHub

```bash
cd /path/to/vocal-stack

# Add all files
git add .

# Commit
git commit -m "Add interactive StackBlitz demos"

# Push to GitHub
git push origin main
```

## Step 3: Test the Links

After pushing, test each demo:

### Demo 1: Basic Sanitizer
```
https://stackblitz.com/github/YOUR_USERNAME/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer
```

### Demo 2: Flow Control
```
https://stackblitz.com/github/YOUR_USERNAME/vocal-stack/tree/main/stackblitz-demos/02-flow-control
```

### Demo 3: Full Pipeline
```
https://stackblitz.com/github/YOUR_USERNAME/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline
```

**Replace `YOUR_USERNAME` with your GitHub username!**

## Step 4: Add to Main README

Add this section to your main `README.md` (after Installation section):

```markdown
## 🎮 Try It Online

Play with vocal-stack in your browser - no installation needed!

| Demo | What it shows | Try it |
|------|---------------|--------|
| **Text Sanitizer** | Clean markdown, URLs for TTS | [Open →](https://stackblitz.com/github/YOUR_USERNAME/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer) |
| **Flow Control** | Filler injection & latency handling | [Open →](https://stackblitz.com/github/YOUR_USERNAME/vocal-stack/tree/main/stackblitz-demos/02-flow-control) |
| **Full Pipeline** | All three modules together | [Open →](https://stackblitz.com/github/YOUR_USERNAME/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline) |

[View all demos →](./stackblitz-demos)
```

## Step 5: Verify Demos Work

1. **Open each demo link** in browser
2. **Wait 10-30 seconds** for StackBlitz to load
3. **Interact with the demo** - click buttons, try features
4. **Check console** for any errors

### Expected Behavior:

✅ Demo loads in StackBlitz
✅ Dependencies install automatically
✅ UI displays correctly
✅ Interactive features work
✅ No console errors

### Troubleshooting:

❌ **Demo won't load?**
- Wait longer (can take 30-60 seconds first time)
- Refresh the page
- Check repo is public on GitHub

❌ **"vocal-stack not found" error?**
- Ensure package is published to npm
- Check package name in package.json is correct
- Wait a few minutes for npm cache to update

❌ **UI broken?**
- Check browser console for errors
- Verify all files pushed to GitHub
- Try in different browser

## Step 6: Share!

Once demos work, share them:

### On npm Package Page
Add demo links to your package.json homepage or documentation field.

### On Twitter/Social Media
```
🚀 Just published vocal-stack! Try it live in your browser:

🧹 Text Sanitizer: [link]
⚡ Flow Control: [link]
📊 Full Pipeline: [link]

No installation needed! #VoiceAI #LLM #TTS
```

### On Reddit
Post to relevant subreddits (r/MachineLearning, r/LLM, r/javascript) with demo links.

### On Dev.to / Hashnode
Write a blog post showcasing the demos.

## Step 7: Monitor Usage

### StackBlitz Analytics
- StackBlitz shows view counts on project page
- Fork your demos to see engagement

### GitHub Traffic
- Go to Insights → Traffic
- See views and clones
- Monitor which demos are popular

## Quick Reference: Demo URLs

Update these with your username:

```
https://stackblitz.com/github/YOUR_USERNAME/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer
https://stackblitz.com/github/YOUR_USERNAME/vocal-stack/tree/main/stackblitz-demos/02-flow-control
https://stackblitz.com/github/YOUR_USERNAME/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline
```

## What's Next?

- ✅ Create more demos for specific use cases
- ✅ Add video walkthrough of demos
- ✅ Write blog post featuring demos
- ✅ Share on social media
- ✅ Add to dev.to or hashnode

## Support

Issues with StackBlitz demos?
- Check [StackBlitz docs](https://developer.stackblitz.com/)
- Open issue on GitHub
- Test locally first (`npm run dev`)

---

**You're all set!** 🎉

Your interactive demos will help developers understand vocal-stack before installing it.
