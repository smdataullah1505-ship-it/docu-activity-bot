# Lecture Lab AI

An AI-powered activity generator that transforms lecture documents into interactive learning experiences. Built with React, TypeScript, and Supabase, with AI generation powered by Google Gemini.

## 🚀 Live Demo
https://lecturelabai.lovable.app
## 📋 Features

- 📄 Upload lecture materials (PDF, PPTX, DOCX, TXT)
- 🤖 AI extracts topics automatically
- 📚 14 activity modes including:
  - Quick Recap, MCQ, Fill in the Blanks, Flashcards
  - Socratic Questions, Debate Prompts, Workshops
  - Real World Examples, Reverse Questioning, Find the Mistake
  - Image Question, Chart Interpreter, Before/After Visualization
  - **SQL MCQ** — Query-based SQL practice with 9 question types
- 🎯 Instant feedback with explanations
- 🔄 Cached results for faster responses
- 📊 Document-grounded AI (content based only on uploaded material)

## 🛠️ Tech Stack

### Frontend
- **React 18** — Component-based UI architecture
- **TypeScript** — Type-safe code
- **Tailwind CSS** — Styling and responsive design
- **Recharts** — Data visualization

### Backend & Storage
- **Supabase** — PostgreSQL database and file storage
- **Supabase Storage** — Document upload and retrieval

### AI & Intelligence
- **Google Gemini API** — Activity generation and content understanding
- **Document-grounded prompting** — Full document passed as context for all activities

### Development Tools
- **Lovable AI** — AI-assisted development and rapid prototyping
- **GitHub** — Version control and collaboration

## 💡 How It Works

1. **User uploads a document** → Text extraction and topic identification
2. **Topic selection** → User chooses a specific topic from the document
3. **Activity generation** → AI creates interactive activities based on the document content
4. **Practice and learning** → User attempts activities with immediate feedback

