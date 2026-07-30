# Lecture Lab AI

Build a web application called "Lecture Lab AI" - an automated classroom activity generator for teachers.

## CORE PURPOSE

Teachers upload their lecture material (PPT, PDF, DOCX, TXT), and the AI generates classroom-ready activities based SOLELY on the uploaded content. No external knowledge. No general AI responses. Everything must come from the uploaded document.

## WORKFLOW

1. Teacher uploads lecture material (PPT, PDF, DOCX, or TXT)

2. AI extracts and displays all topics from the uploaded material

3. Teacher selects a topic from the extracted list

4. Teacher selects activity type from the 10 modes below

5. AI generates activities based ONLY on the selected topic from the uploaded material

## ACTIVITY MODES (10 Total)

### Mode 1: Quick Recap Mode

Generate a revision activity for last 5 minutes of class.

Include:

- Key points summary (3-5 bullet points)

- Important concepts with brief explanations

- Quick oral questions (5 questions with answers)

- Memory triggers (mnemonics or easy ways to remember)

### Mode 2: MCQ Generator

Generate MCQs with these options:

Difficulty levels: Easy, Medium, Hard, Mixed

Question count: 5, 10, or 20

RULES:

- Easy: Basic recall questions from the document

- Medium: Application/understanding questions from the document

- Hard: Analysis/evaluation questions from the document

- Different questions per difficulty level (no repetition)

- Each MCQ: 4 options, correct answer, short explanation

- All questions must come from the uploaded material

### Mode 3: Fill in the Blanks

Generate missing word questions.

Requirements:

- Based on important terminology from the document

- Include the answer key

- Suitable for classroom participation

- Generate 5-8 blanks

### Mode 4: Terminology Flashcards

Create concept flashcards.

Format:

- Front: Term/concept from document

- Back: Simple explanation from document

- Generate 5-10 flashcards

### Mode 5: Socratic Short Questions

Generate thinking-based questions (NOT direct memory questions).

Questions should make students explain:

- Why something happens

- How something works

- Reasoning behind concepts

- Comparisons between concepts

Generate 5-7 questions based on the document.

### Mode 6: Seminar / Debate Prompts

Generate classroom discussion topics.

Requirements:

- 5 prompts

- Encourage opinions and technical reasoning

- Based on the document's content

Example: "Should [concept from document] always require [application from document]?"

### Mode 7: Workshops & Simulation Activities

Generate practical classroom activities.

Include:

- Activity title

- Instructions (step-by-step)

- Student task

- Expected learning outcome

- Must be possible inside a classroom

### Mode 8: Real World Examples

Generate examples connecting the topic with real applications.

Include:

- Scenario (real-world situation)

- Explanation (how concept applies)

- Where concept is used in real life

Generate 3-5 examples

### Mode 9: Reverse Questioning Mode

Teacher provides a concept from the document.

AI generates 5-8 possible questions students could ask about that concept.

Purpose: Improve understanding from different angles.

### Mode 10: Find the Mistake Activity

Generate intentionally incorrect statements based on the document.

Students must:

- Identify the mistake

- Explain the correction

Include:

- Wrong statement (based on document but slightly incorrect)

- Hint

- Correct explanation with reference to the document

Generate 3-5 mistakes

## CRITICAL RULES

1. ALL generated content must come ONLY from the uploaded document

2. Match the selected topic specifically

3. Avoid generic AI-generated questions that don't exist in the document

4. Content should be suitable for engineering/college students

5. Activities should fit 10-15 minute classroom time

6. Keep explanations teacher-friendly and clear

7. If the document doesn't contain information about a topic, do NOT generate activities for it

8. Do NOT use external knowledge or general AI training data

## OUTPUT FORMAT

Return structured JSON only. No markdown. No extra explanation. Use this exact structure:

{

  "quickRecap": {

    "keyPoints": ["point1", "point2", "point3"],

    "importantConcepts": [{"concept": "", "explanation": ""}],

    "oralQuestions": [{"question": "", "answer": ""}],

    "memoryTriggers": ["trigger1", "trigger2"]

  },

  "mcqs": {

    "easy": [{"question": "", "options": ["A", "B", "C", "D"], "correct": "A", "explanation": ""}],

    "medium": [{"question": "", "options": ["A", "B", "C", "D"], "correct": "B", "explanation": ""}],

    "hard": [{"question": "", "options": ["A", "B", "C", "D"], "correct": "C", "explanation": ""}]

  },

  "fillBlanks": [{"sentence": "The ___ is important", "answer": "concept", "explanation": ""}],

  "flashcards": [{"front": "Term", "back": "Explanation"}],

  "socraticQuestions": [{"question": "Why does X happen?", "hint": "Think about Y"}],

  "debates": [{"topic": "Should X always require Y?", "context": "From document"}],

  "workshops": [{"title": "", "instructions": "", "task": "", "outcome": ""}],

  "examples": [{"scenario": "", "explanation": "", "application": ""}],

  "reverseQuestions": [{"question": "What if X happens?", "context": "Student might ask"}],

  "findMistakes": [{"wrongStatement": "", "hint": "", "correctExplanation": ""}]

}

## UI DESIGN REQUIREMENTS

- Clean, modern design suitable for teachers

- Step-by-step progress indicator (Upload → Topics → Select Activity → Results)

- File upload area with drag-and-drop support

- Topics displayed as clickable cards/buttons

- Activity types displayed as a grid of clickable cards with icons

- Results displayed in organized sections with clear labels

- Difficulty levels color-coded (Green=Easy, Orange=Medium, Red=Hard)

- Responsive design for all screen sizes

## TECHNICAL REQUIREMENTS

- Use Lovable's built-in AI connector for document analysis

- All AI responses must be based solely on the uploaded document

- No chat interface - this is an automated activity generator

- Show results immediately after topic and activity type selection

- Display loading states during generation

- Allow downloading/exporting activities as PDF or printing

## BUILD THIS APPLICATION NOW

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://docu-activity-bot.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0a82fc4a-2600-4fe0-9d35-389f5d8f5258).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
