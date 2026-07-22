<div align="center">

# Nero AI

![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38BDF8?style=flat-square&logo=tailwindcss)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Stars](https://img.shields.io/github/stars/DeepMane33/nero-ai?style=flat-square&color=yellow)

</div>

---

## so what is this?

nero is basically an AI assistant that doesn't suck. i got tired of chatgpt being boring and having no personality so i built my own thing. it has 7 different brains that handle different types of tasks, it can actually speak back to you with natural voices, and the whole UI looks like something out of a sci-fi movie.

oh and it's completely free to use if you plug in a gemini api key (which is also free lol).

---

## features

### the brains

nero routes your messages to the best brain for the job:

| brain | what it does |
|-------|-------------|
| reasoning | logic, analysis, step-by-step explanations |
| coding | writes code, fixes bugs, runs scripts |
| research | deep dives, web search, facts |
| creative | stories, brainstorming, writing |
| memory | remembers stuff about you, takes notes |
| learning | teaches concepts, tutorials, analogies |
| automation | scripts, workflows, scheduling |

### voice mode

yeah it literally talks. pick from 8 neural voices powered by gemini tts.

### memory system

it remembers things. you tell it your name, your preferences, stuff you're working on — it stores all of that and brings it up later. there's emotional intelligence too, so it can tell when you're stressed and suggest you take a break.

### knowledge graph

it builds a knowledge graph from your conversations. topics you discuss get connected automatically, so it can show you how different things you've talked about relate to each other.

### project management

create projects, manage files, track tasks — all from inside the AI. it's not just a chatbot, it's more like a workspace.

---

## getting started

### prerequisites

- node.js 18+ (i'm using 20 but whatever works)
- a gemini api key — get one free at [Google AI Studio](https://aistudio.google.com/apikey)

### setup

```bash
# clone it
git clone https://github.com/DeepMane33/nero-ai.git
cd nero-ai

# install deps
npm install

# add your api key
cp .env.example .env.local
# edit .env.local and add your GEMINI_API_KEY

# run it
npm run dev
```

then open http://localhost:3000 and you're in.

### .env.local

```env
GEMINI_API_KEY=your_key_here
```

that's literally all you need. the app works with just gemini. if you want more providers you can add groq, openrouter, cerebras, sambanova, or anthropic keys too — but gemini alone gets you pretty far.

---

## what tech is this built with

- **next.js 16** — app router, server components, turbopack
- **react 19** — the latest
- **typescript** — because i'm not a maniac
- **tailwind css 4** — styling
- **better-sqlite3** — local database, no setup needed
- **framer-motion** — animations
- **gemini tts** — natural voice synthesis
- **swr** — data fetching


## project structure

```
nero-ai/
├── src/
│   ├── app/              # next.js app router pages + API routes
│   │   ├── api/          # all the backend endpoints
│   │   │   ├── chat/     # main chat endpoint
│   │   │   ├── tts/      # gemini text-to-speech
│   │   │   ├── vision/   # image analysis
│   │   │   ├── search/   # web search
│   │   │   └── ...
│   │   └── page.tsx      # dashboard
│   ├── components/       # react components
│   │   ├── chat/         # chat interface, messages
│   │   ├── voice/        # voice mode with waveform
│   │   ├── coding/       # code editor, terminal, file explorer
│   │   ├── ui/           # shared UI components
│   │   └── ...
│   ├── core/             # brain models, tools
│   ├── lib/              # utilities, database, APIs
│   └── contexts/         # theme context
├── soul.md               # nero's personality definition
└── package.json
```

---

## why did i build this

honestly? because i wanted an AI that felt like mine. chatgpt is great but it's generic. gemini is good but the interface is boring. i wanted something with:

- a personality that i control
- voice that actually sounds good
- tools that let it DO things, not just talk
- a UI that doesn't look like a corporate product demo
- memory so it actually knows who i am

and yeah it took a while to build but it works and i use it every day so...

---

## contributing

if you want to help out, go for it. fork it, mess around, submit a PR. just don't break the voice mode because that took forever to get right.

---

## license

mit.

---

<div align="center">


**[nero-ai](https://github.com/DeepMane33/nero-ai)**

</div>
