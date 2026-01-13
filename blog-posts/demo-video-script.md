# vocal-stack Demo Video Script

**Total Duration:** 10-12 minutes
**Target Audience:** Developers building voice AI applications
**Goal:** Showcase vocal-stack features and encourage adoption

---

## Pre-Production Checklist

- [ ] Screen recording software set up (OBS, Loom, or Camtasia)
- [ ] Microphone tested
- [ ] Browser with StackBlitz demos loaded
- [ ] Code editor with examples ready
- [ ] Terminal ready for npm commands
- [ ] Background music (optional, low volume)

---

## Script

### INTRO (0:00 - 1:00)

**[Screen: Title slide with vocal-stack logo/text]**

**Voiceover:**
> Hey everyone! Today I'm excited to show you vocal-stack - a toolkit I built for creating production-ready voice AI agents.

**[Screen: Show problem example - LLM output with markdown]**

> If you've ever built a voice AI agent, you've probably run into these problems:
>
> Your LLM outputs beautiful markdown... but when you send it to a TTS engine, it sounds terrible. "Hash hash Welcome" instead of "Welcome." URLs spelled out character by character. And those awkward silences while the LLM is thinking.

**[Screen: Show vocal-stack GitHub page]**

> vocal-stack solves these "last mile" challenges with three simple modules. Let me show you how it works.

---

### CHAPTER 1: TEXT SANITIZATION (1:00 - 4:00)

**[Screen: Open Text Sanitizer demo in StackBlitz]**
**URL:** https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/01-basic-sanitizer

**Voiceover:**
> Let's start with text sanitization. This is the first demo - it runs entirely in your browser, no installation needed.

**[Action: Show the demo interface]**

> Here we have a piece of text with markdown syntax - headers, bold text, links, code blocks, URLs. This is typical LLM output.

**[Action: Click through the example buttons]**

> I've included several preset examples. Let's try the "Mixed Example" - it has everything: markdown, URLs, and code blocks.

**[Action: Click "Sanitize Text" button]**

> Watch what happens when we sanitize this text. The output is clean - no markdown symbols, no URLs, no code blocks. This is what should go to your TTS engine.

**[Action: Show statistics]**

> The demo even shows statistics - we removed 87 characters, that's a 23% reduction in size. More importantly, it's now actually speakable.

**[Action: Toggle different sanitization rules]**

> You can select which rules to apply. Let's turn off URL sanitization and try again. Now the URLs stay in the output. This gives you full control.

**[Screen: Show code example in editor]**

> Here's how simple it is to use in your code:

```typescript
import { sanitizeForSpeech } from 'vocal-stack';

const markdown = '## Hello World\nCheck out [this link](https://example.com)';
const speakable = sanitizeForSpeech(markdown);
// Output: "Hello World Check out this link"
```

> One line of code, and your LLM output is TTS-ready.

---

### CHAPTER 2: FLOW CONTROL (4:00 - 7:30)

**[Screen: Open Flow Control demo]**
**URL:** https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/02-flow-control

**Voiceover:**
> Now let's look at flow control. This solves the awkward silence problem.

**[Action: Show demo configuration]**

> This demo simulates an LLM stream. We can configure the stall threshold - that's how long to wait before detecting a stall. Let's keep it at 1000 milliseconds, or one second.

> We can enable fillers - these are natural phrases like "um" or "let me think" that make the agent sound more human.

> And we can control the chunk delay - that's how fast the LLM "thinks" between responses.

**[Action: Click "Start Simulation"]**

> Watch what happens. There's an initial delay... and there's the filler! "Um" - the agent is letting us know it's thinking. Then the response starts flowing.

**[Action: Point to timeline]**

> The timeline shows exactly what's happening. The orange bar is our filler, blue bars are text chunks, and you can see the stalls detected in red.

**[Action: Show statistics]**

> Look at the stats - we detected one stall, injected one filler, processed 8 chunks in 2.4 seconds. Time to first token was 1500 milliseconds - but the user heard a filler, so it felt natural.

**[Screen: Show configuration options]**

> Let me show you something important. Let's run it again with a faster chunk delay and lower threshold.

**[Action: Adjust settings and run again]**

> See? No fillers this time because there was no stall. The agent started speaking immediately. Fillers are only used when needed.

**[Screen: Code example]**

> Here's the code:

```typescript
import { FlowController } from 'vocal-stack/flow';

const controller = new FlowController({
  stallThresholdMs: 700,
  enableFillers: true,
  onFillerInjected: (filler) => {
    textToSpeech(filler); // Send to TTS immediately
  },
});

for await (const chunk of controller.wrap(llmStream)) {
  await textToSpeech(chunk);
}
```

> Wrap your LLM stream, and vocal-stack handles the rest. The important thing - fillers are ONLY injected before the first chunk. Once the agent starts speaking, it continues naturally.

---

### CHAPTER 3: FULL PIPELINE (7:30 - 10:00)

**[Screen: Open Full Pipeline demo]**
**URL:** https://stackblitz.com/github/gaurav890/vocal-stack/tree/main/stackblitz-demos/03-full-pipeline

**Voiceover:**
> Now for the finale - let's see all three modules working together in a complete pipeline.

**[Action: Show pipeline visualization]**

> This is the vocal-stack pipeline: LLM output goes through the Sanitizer, then Flow Control, then the Monitor, and finally it's TTS-ready.

**[Action: Click "Run Complete Pipeline"]**

> Watch as each module activates. The LLM generates output with markdown, the Sanitizer cleans it, Flow Control adds fillers if needed, and the Monitor tracks everything.

**[Action: Show side-by-side outputs]**

> On the left is the raw LLM output - full of markdown. On the right is the cleaned output - ready for TTS. See the difference?

**[Action: Show metrics]**

> And we get comprehensive metrics: Time to first token, total duration, chunks processed, fillers injected, characters removed. This is how you optimize performance.

**[Screen: Show code example]**

> Here's how it all comes together:

```typescript
import { SpeechSanitizer, FlowController, VoiceAuditor } from 'vocal-stack';

const sanitizer = new SpeechSanitizer();
const flowController = new FlowController();
const auditor = new VoiceAuditor();

// Compose the pipeline
const pipeline = auditor.track(
  'request-id',
  flowController.wrap(
    sanitizer.sanitizeStream(llmStream)
  )
);

for await (const chunk of pipeline) {
  await sendToTTS(chunk);
}

console.log(auditor.getSummary()); // Get metrics
```

> Three modules, fully composable. Use one, two, or all three. Your choice.

---

### CHAPTER 4: REAL-WORLD EXAMPLE (10:00 - 12:00)

**[Screen: Code editor with OpenAI example]**

**Voiceover:**
> Let's look at a real-world example using OpenAI.

**[Action: Show OpenAI integration code]**

> Here's a complete voice agent. We're using OpenAI's GPT-4 for the LLM and their TTS service for speech.

> The vocal-stack pipeline sits in the middle - cleaning the output, handling latency, tracking performance.

**[Action: Scroll through code]**

> Notice how clean this is. We don't have manual text cleaning. We don't have complex state management for fillers. We don't have custom metric tracking. vocal-stack handles all of it.

**[Action: Show example output]**

> When you run this, you get a natural-sounding voice agent that handles markdown gracefully, never has awkward silences, and gives you detailed performance metrics.

---

### CHAPTER 5: USE CASES & FEATURES (12:00 - 13:30)

**[Screen: Slideshow of use cases]**

**Voiceover:**
> What can you build with vocal-stack?

> Voice assistants like Alexa or Google Home
> Customer service bots that sound professional
> Educational AI tutors for interactive learning
> Gaming NPCs with realistic voices
> Accessibility tools like screen readers
> Content creation - turn blogs into podcasts
> Smart home devices
> And IVR phone systems

**[Screen: Feature list]**

> Some key features worth mentioning:

> It's platform-agnostic - works with any LLM and any TTS provider. OpenAI, Claude, Gemini, local models. OpenAI TTS, ElevenLabs, Google, Azure, AWS.

> Built with TypeScript in strict mode, over 90% test coverage.

> Supports both ESM and CommonJS. Tree-shakeable imports so you only ship what you use.

> Zero dependencies. Lightweight and fast.

> And it's production-ready. I use it in my own projects.

---

### CHAPTER 6: GETTING STARTED (13:30 - 14:30)

**[Screen: Terminal showing installation]**

**Voiceover:**
> Ready to try it? Getting started is simple.

**[Action: Type command]**

```bash
npm install vocal-stack
```

> One npm command, and you're ready to go.

**[Screen: Show GitHub repository]**

> The GitHub repository has everything you need:
> Seven comprehensive examples from basic to production-ready
> Three interactive demos you can try in your browser
> Complete API documentation
> Real-world integration examples with OpenAI and ElevenLabs
> And a production-ready voice agent template

**[Screen: Show example files]**

> The examples cover every use case. Start with the basic sanitizer, work your way up to the custom voice agent. They're all fully documented and ready to run.

---

### CONCLUSION (14:30 - 15:00)

**[Screen: Back to title slide]**

**Voiceover:**
> vocal-stack solves the "last mile" challenges in voice AI. Clean text, natural flow, and performance monitoring - all in one simple package.

**[Screen: Show links]**

> Links are in the description:
> GitHub: github.com/gaurav890/vocal-stack
> npm: npmjs.com/package/vocal-stack
> Try the demos: [demo link]

> The package is MIT licensed and contributions are welcome. If you found this useful, give it a star on GitHub!

> Thanks for watching, and happy building!

**[Screen: Fade to end card with social links]**

---

## Post-Production

### Editing Checklist
- [ ] Add intro animation (0:00-0:05)
- [ ] Add chapter markers in timeline
- [ ] Add text overlays for:
  - Package name at 0:10
  - Key features at key moments
  - Code snippets (make them readable)
  - URLs (show on screen)
- [ ] Add background music (subtle, 10-15% volume)
- [ ] Add transitions between chapters
- [ ] Color correct if needed
- [ ] Add end card with:
  - GitHub link
  - npm link
  - Your social handles
  - "Subscribe" reminder

### Video Metadata

**Title:** `vocal-stack: Building Production-Ready Voice AI Agents (Full Tutorial)`

**Description:**
```
🚀 Introducing vocal-stack - A complete toolkit for building natural-sounding voice AI agents.

In this tutorial, I'll show you how to solve three critical challenges in voice AI:
1. Text Sanitization - Clean LLM output for TTS
2. Flow Control - Handle latency with natural fillers
3. Performance Monitoring - Track and optimize metrics

⏱️ TIMESTAMPS
0:00 - Introduction
1:00 - Text Sanitization Demo
4:00 - Flow Control Demo
7:30 - Full Pipeline Demo
10:00 - Real-World OpenAI Example
12:00 - Use Cases & Features
13:30 - Getting Started
14:30 - Conclusion

🔗 LINKS
• GitHub: https://github.com/gaurav890/vocal-stack
• npm: https://www.npmjs.com/package/vocal-stack
• Try Live Demos: https://github.com/gaurav890/vocal-stack/tree/main/stackblitz-demos
• Documentation: https://github.com/gaurav890/vocal-stack#readme

📦 INSTALLATION
npm install vocal-stack

🎮 TRY IT LIVE
No installation needed - try the interactive demos in your browser:
• Text Sanitizer: [link]
• Flow Control: [link]
• Full Pipeline: [link]

💬 CONNECT
• GitHub: @gaurav890
• Twitter: @[your handle]
• LinkedIn: [your profile]

#VoiceAI #LLM #TTS #JavaScript #TypeScript #AI #MachineLearning #OpenAI #Tutorial
```

**Tags:**
`voice ai`, `llm`, `tts`, `javascript`, `typescript`, `artificial intelligence`, `machine learning`, `openai`, `tutorial`, `coding`, `web development`, `programming`

**Thumbnail Ideas:**
1. Split screen: "Before" (markdown) vs "After" (clean)
2. Pipeline diagram with vocal-stack logo
3. Code editor with highlighted vocal-stack import
4. "Build Better Voice AI" with agent icon

---

## B-Roll Footage Ideas

Capture these while recording:
- Terminal commands running
- Package installation
- Demo interactions (cursor movements, clicks)
- Code being written
- Metrics updating in real-time
- Side-by-side comparisons

---

## Alternative: Shorter Version (5 minutes)

If 15 minutes is too long, use this structure:

1. **Intro** (0:00-0:30) - Quick problem statement
2. **Demo Showcase** (0:30-3:00) - Show all 3 demos quickly
3. **Code Example** (3:00-4:00) - One complete example
4. **Call to Action** (4:00-4:30) - Install & try

---

## Tips for Recording

1. **Test first** - Do a complete dry run
2. **Speak clearly** - Not too fast, enunciate
3. **Show, don't just tell** - Demo everything
4. **Use your cursor** - Point at important things
5. **Pause between sections** - Makes editing easier
6. **Keep enthusiasm** - Your energy matters!
7. **Have water nearby** - Stay hydrated
8. **Record in quiet space** - Minimize background noise

---

## After Publishing

1. Share on:
   - Twitter (with video preview)
   - LinkedIn
   - Reddit (r/MachineLearning, r/javascript)
   - Dev.to (embed video)
   - Discord communities

2. Add video to:
   - GitHub README
   - npm package page
   - Documentation site

3. Monitor:
   - View count
   - Watch time
   - Comments (reply within 24h)
   - Likes/shares

---

**Good luck with your video!** 🎥

If you need help with editing or have questions, feel free to reach out!
