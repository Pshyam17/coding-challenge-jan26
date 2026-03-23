# Coding Challenge - Matchmaking System

## Introduction

Hey! Welcome to our little take home challenge. We won't force Leetcode problems down your throat. Instead, what we do here at Clera is build, so therefore, we expect you to build cool stuff too!

But what and why are we building? Well, a lot of the world revolves around matchmaking. The fact that you and I exist is proof of that. A not so insignificant portion of what shapes a person's life is determined by matchmaking: friends, love, jobs. I mean hell, what we're doing right now at this very moment is matchmaking. Despite its prevalence, it is still quite the difficult task. So let's tackle it together—on a small scale at least. Our goal is to connect apples to oranges. Just because we shouldn't compare apples to oranges, doesn't mean we can't try to create a perfect pear… pair.

## Problem Statement

The abstract idea of the project is simple. In one basket we have apples, each apple has preferences that it wishes its orange to fulfill. In another basket we have oranges, each orange obviously also has preferences that it wishes a potential apple to meet. Our job is to:

1. Match them based on their joint preferences
2. Communicate to both parties that we've found them a match

We're going to be creating a small fullstack application that will encompass everything from frontend, edge functions as our backend and a bit of creative problem solving on your end to make this come to life.

## Tech Stack

Let me lay out the tech stack real quick before I get into more specifics.

### Frontend
- React
- Next.js
- Tailwind CSS
- Zustand
- Effect

### Backend
- Trigger.dev
- Supabase Edge Functions
- SurrealDB

### Agentic Components
- AI SDK

## Implementation Details

### Data Setup

In the `data` folder you will find a JSON file called `raw_apples_and_oranges.json`. It contains an array of apples and oranges with relevant attributes and their preferences. The first task is to create a SurrealDB instance that will hold this data. All design decisions regarding data storage are up to you, whatever helps achieve the goal best. This gives us our main pool of apples and oranges to draw from during the system's core cycle.

### Core System

Now that we have our data and access to it, we need to implement the core of our system. Two edge functions are provided: `get-incoming-apple` and `get-incoming-orange`. Both follow the same task flow:

#### Task Flow

1. **Generate a new fruit instance** ✅ *Implemented*
   - Uses `generateApple()` or `generateOrange()` from `_shared/generateFruit.ts`
   - Attributes are randomly generated using a normal distribution
   - Preferences are generated with relaxed constraints (not too strict)

2. **Capture the fruit's communication** ✅ *Implemented*
   - `communicateAttributes(fruit)` - Returns a human-readable description of the fruit's physical characteristics
   - `communicatePreferences(fruit)` - Returns a human-readable description of what the fruit is looking for in a match
   - Both functions have extensive variability with multiple templates and phrasings

3. **Store the new fruit in SurrealDB** ✅ *Implemented*
   - Connect to SurrealDB instance
   - Insert the fruit record with attributes and preferences

4. **Match the fruit to potential partners** ✅ *Implemented*
   - Query existing fruits of the opposite type from SurrealDB
   - Calculate compatibility scores based on preference matching
   - Return ranked matches

5. **Communicate matching results via LLM** ✅ *Implemented*
   - Generate natural language response about the matches
   - Include match explanations and compatibility scores if time allows

#### Running the Backend Locally

```bash
# Start Supabase local environment (from project root)
npx supabase start

# Serve edge functions (in a separate terminal)
npx supabase functions serve --no-verify-jwt

# Test the functions
curl http://127.0.0.1:54321/functions/v1/get-incoming-apple -H "Content-Type: application/json" -d '{}'
curl http://127.0.0.1:54321/functions/v1/get-incoming-orange -H "Content-Type: application/json" -d '{}'
```

#### Running the Frontend Locally

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

The frontend will be available at `http://localhost:3000`. The dashboard is at `/dashboard`.

### Visualization

To tie it all together, you will create a visualization (you may choose the medium) of this flow. In other words, it should be possible for us to "start a new conversation" and visualize the resulting "conversation".

### Metrics & Analytics

Our goal is to match as best we can, but how do I know if our solution is any good? You tell me! In the frontend application, include an admin dashboard with metrics that you can track and help convince me that the system is performing well and we are creating great pears.

## Hard Requirements

- The data must be loaded into and queried from SurrealDB
- The communication between the system and the fruits need to be visualized in a medium of your choosing
- You must communicate the matchmaking results through an LLM

## Additional Notes

- You may serve the edge functions locally.

- We encourage you to utilize AI as you see fit throughout this challenge; seeing as you will need to build many aspects of the solution quickly. Regardless of how the code is created, you will be expected to own it. This ownership includes:
  - Explaining all generated code
  - Justifying all design decisions
  - Displaying creativity in your solution

- Also feel free to change anything and everything in the template. Just because someone wrote it, doesn't mean it is right or perfect. So let's hold each other accountable and call out anything we see to keep the collective quality up and solve the problem together.

## File Structure

```
Root
├── frontend/                          # Next.js application
│   ├── app/
│   │   ├── dashboard/                 # Admin dashboard with metrics
│   │   └── page.tsx                   # Main entry point
│   └── lib/
│       ├── store.ts                   # Zustand state management
│       └── utils.ts                   # Utility functions
│
├── supabase/
│   ├── config.toml                    # Supabase local configuration
│   └── functions/
│       ├── _shared/
│       │   ├── generateFruit.ts       # Fruit generation & communication
│       │   ├── generateFruit.test.ts  # Deno tests
│       │   └── deno.json              # Shared dependencies
│       ├── get-incoming-apple/
│       │   ├── index.ts               # Apple edge function
│       │   └── deno.json
│       └── get-incoming-orange/
│           ├── index.ts               # Orange edge function
│           └── deno.json
│
├── data/
│   ├── README.md                      # Data schema documentation
│   └── raw_apples_and_oranges.json    # Seed data (40 fruits)
│
├── package.json                       # Root dependencies (supabase CLI)
└── README.md                          # This file
```

Changes implemented: 

Phase 1: Data Infrastructure and Modeling

Task: Defined SurrealDB Schema and Seeding
Action: Created the core database schema including graph relations, indexes, and narrative fields. Developed a startup script to automate environment provisioning.
Logic: Instead of a traditional relational structure, I used a graph-native approach. Apples and oranges are modeled as nodes, while matches are represented as first-class relationship edges. This allows for complex traversals and real-time analytical queries on match data without expensive join operations.

Task: Edge Function Connectivity
Action: Integrated SurrealDB clients and REST API connection helpers into the Supabase Edge Function environment.
Logic: To ensure high performance and low latency within the Deno runtime, I transitioned from the standard SDK to direct REST API calls. This avoids compatibility issues with server v3.x and ensures the edge runtime can communicate with the database via 0.0.0.0 binding.

Phase 2: Core Matchmaking Engine

Task: Bidirectional Scoring and Harmonic Mean
Action: Implemented a shared scoring library utilizing the harmonic mean to calculate fruit compatibility.
Logic: Standard averages can lead to "unrequited" matches where only one party is satisfied. By using the harmonic mean, the algorithm penalizes significant gaps between Apple and Orange preferences, ensuring a high score only occurs when there is mutual satisfaction.

Task: LLM Pipeline and Narrative Generation
Action: Connected the matching pipeline to NVIDIA NIM (Llama 3) and interpolated record IDs directly in SurrealQL.
Logic: Every successful match is passed through an LLM to generate a natural language explanation. By storing this narrative directly on the match edge in SurrealDB, the system maintains a historical record of the "why" behind every pairing, enabling persistent agentic memory.

Phase 3: Dashboard and Visualization

Task: Real-time Analytics and Dashboard Loader
Action: Developed a comprehensive dashboard loader that aggregates metrics (satisfaction rates, average scores, and distribution) directly from SurrealDB.
Logic: I utilized raw SurrealQL to perform on-the-fly aggregations of graph data. This offloads heavy computation to the database layer, allowing the frontend to remain lightweight while still providing deep insights into system performance.

Task: Interactive Conversation Flow and Match Graph
Action: Built a live narrative feed and a custom SVG Match Graph to visualize the network of fruit connections.
Logic: To fulfill the visualization requirements, I designed a step-by-step UI flow that captures the arrival, communication, and result phases. The SVG graph provides a visual representation of the network density and match strength using dynamic stroke widths based on compatibility scores.

Phase 4: System Refinement and Polish
Task: State Persistence and Type Safety
Action: Integrated Zustand persistence and resolved TypeScript inference failures across the frontend.
Logic: I implemented middleware to ensure that the dashboard state and conversation history survive browser refreshes. This simulates a long-running autonomous agent rather than a stateless web app. Explicit type interfaces were added to ensure the reliability of the data flow from the database to the UI.