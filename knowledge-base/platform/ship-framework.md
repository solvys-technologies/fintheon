# SHIP Framework: Systems Planning Methodology

## Overview

The SHIP framework is a four-step methodology for building AI-powered applications without getting stuck in endless debugging cycles. It emphasizes **system architecture and planning** over traditional coding skills, treating AI as skilled labor that follows your blueprints rather than making decisions for you.

## Core Philosophy

> "The skill you actually need isn't coding. It's system architecture. You're not becoming technical in the traditional sense—you're becoming an architect, a planner, and a decision maker."

Think of AI as your construction crew: skilled labor you no longer have to pay for. You provide the blueprints; they execute the work.

## The SHIP Framework

### S - Systems Planning

**Before touching any AI coder, plan your app's high-level components first.**

#### What to Do:

- Take 10 minutes to write down your app's high-level components
- Identify all required system components:
  - Where will data live?
  - Do you need user login?
  - What integrations are required?
  - What features are essential vs. nice-to-have?

#### Why It Matters:

- Without planning, AI creates messy projects and gets lost in its own code
- With a clear plan, AI can create clean, organized projects
- Prevents feature creep and scope confusion

#### Example Questions:

- What data needs to be stored?
- Who needs access to what?
- What external services are required?
- What's the minimum viable version?

---

### H - Handpick Your Tools

**You make the tool decisions, not the AI. Research options and choose based on your needs.**

#### What to Do:

1. **Research options** for each system component
   - Use Grok, ChatGPT, or Claude for fast research
   - Compare costs, features, and limitations
   - Ask: "What are my options for [component]?"

2. **Evaluate trade-offs**
   - Cost analysis (free tiers, pricing models)
   - Feature requirements
   - Vendor lock-in considerations
   - Learning curve and complexity

3. **Make informed decisions**
   - Don't let AI choose for you
   - Consider simplicity vs. flexibility
   - Balance single-service simplicity vs. multi-service flexibility

4. **Create a written plan**
   - Ask AI to create a detailed implementation plan
   - Copy this plan for the next step
   - Include multiple phases if needed

#### Magic Phrase for Research:

> "Answer without technical jargon. I'm not an engineer. Help me understand so I can make decisions."

#### Common Trade-offs:

- **Single Service (e.g., Supabase)**: One dashboard, simpler learning, but vendor lock-in
- **Multiple Services (e.g., Clerk + Vercel + Stripe)**: More flexibility, but more complexity

#### Why It Matters:

- AI often recommends multiple services when one could work
- AI can't understand your specific constraints (budget, timeline, team size)
- You avoid expensive mistakes and over-engineering

---

### I - Initial Test Build

**Build the ugliest possible minimal version to prove the concept works. No pretty designs, no extra features.**

#### What to Do:

1. Take the written plan from Step H
2. Build the **absolute minimum** to prove your system works
3. Skip everything non-essential:
   - Skip login systems (unless core to concept)
   - Skip password resets
   - Skip pretty designs
   - Skip extra features

4. Focus on **core functionality only**
   - For an AI chatbot: Just prove AI can connect to your data
   - For a marketplace: Just prove listings can be created and viewed
   - For an app: Just prove the core workflow works

#### Why It Matters:

- Saves hundreds of hours by catching unworkable concepts early
- Proves technical feasibility before investing in polish
- Identifies blockers before building the full app
- Example: Built iPhone app for 3 months only to discover Apple would never approve it

#### Key Principle:

> "Build the ugliest possible version in just a couple of hours just to prove that the concept actually works."

---

### P - Production Build

**Throw away the test and rebuild from scratch. Don't try to salvage messy test code.**

#### What to Do:

1. **Don't try to fix the test version**
   - Don't spend days untangling messy code
   - Don't try to polish the minimal build
   - Every fix creates two new bugs

2. **Start fresh with all your knowledge**
   - You now know exactly what works
   - You know which tools you chose and why
   - You have a proven concept

3. **Refine your plan**
   - Update your plan based on test learnings
   - Add the features you skipped in the test
   - Include proper architecture and design

4. **Build the real app**
   - Use the same AI coding tool
   - Give it your battle-tested blueprint
   - Build with confidence

#### Why It Matters:

- Test code is messy and hard to maintain
- Starting fresh is faster than fixing broken code
- You're now in the top 1% of AI builders
- You're giving AI a battle-tested blueprint, not guessing

#### Key Principle:

> "While everyone else says 'build me an app,' you are giving the AI a battle-tested blueprint."

---

## Complete Workflow Example

### Example: Custom AI Chatbot Platform

#### Step 1: Systems Planning (S)

Identify components:

- User login/authentication
- Data storage (chat history, user data)
- File storage (if needed for documents)
- AI chatbot brain (LLM integration)
- Payments/subscriptions (if monetizing)

#### Step 2: Handpick Tools (H)

Research options:

- **Auth**: Clerk vs. Supabase Auth\*\*
- **Database**: Vercel Postgres vs. Supabase
- **Storage**: Vercel Blob vs. Supabase Storage
- **AI**: OpenAI, Anthropic, Grok
- **Payments**: Stripe vs. Lemon Squeezy

Decision process:

- AI might recommend: Clerk + Vercel Postgres + Vercel Blob
- But Supabase does all three in one service
- Trade-off: Simplicity vs. vendor lock-in
- **You decide**: For MVP, choose Supabase for simplicity

Create written plan:

- Ask AI: "Create a detailed plan with multiple phases that I can copy to an AI coding tool"
- Get phased implementation plan
- Copy for next step

#### Step 3: Initial Test Build (I)

Build minimal version:

- Skip login (or use simplest possible)
- Skip password resets
- Skip pretty UI
- Just prove: AI can connect to data and respond

Test and validate:

- Does the core concept work?
- Are there any blockers?
- Is the approach feasible?

#### Step 4: Production Build (P)

Throw away test code

- Don't try to fix or polish it
- Start completely fresh

Rebuild with knowledge:

- Use refined plan from test learnings
- Add all features (login, UI, etc.)
- Build with proper architecture
- Give AI your battle-tested blueprint

---

## Key Takeaways

1. **Planning > Coding**: Spend 10 minutes planning saves hours of debugging
2. **You Decide**: Don't let AI choose your tools—research and decide yourself
3. **Test First**: Build ugly minimal version to prove concept works
4. **Rebuild Fresh**: Don't salvage test code—start over with knowledge

## Mindset Shift

- **From**: "I need to learn to code"
- **To**: "I need to learn system architecture"

- **From**: "AI, build me an app"
- **To**: "AI, here's my blueprint—execute it"

- **From**: "I'm not technical"
- **To**: "I'm an architect, not a coder"

## When to Use SHIP

- Building new features or applications
- Planning major refactors
- Evaluating new integrations
- Starting new projects
- When stuck in debugging cycles

## Integration with Development Workflow

The SHIP framework should be applied:

- **Before** writing any code
- **Before** choosing new tools/services
- **Before** starting new features
- **When** stuck in debugging cycles
- **When** planning architecture changes

---

**Source**: Based on methodology from Rob's AI coding workshop and YouTube content  
**Last Updated**: January 2025
