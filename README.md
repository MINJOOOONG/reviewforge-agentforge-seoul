# ReviewForge

**A creator assistant that helps local experience bloggers get selected, turn real visits into grounded reviews, and check every campaign mission.**

### [Try the live demo →](https://reviewforge-agentforge-seoul.vercel.app)

ReviewForge was built for local experience campaigns—restaurants, cafés, beauty studios, stays, and classes that creators visit in person. Product-shipping campaigns are outside the scope of this MVP.

## Why I Built It

I am a power blogger who loves discovering great restaurants, cafés, and places through blogger experience campaigns. The experiences are exciting; the repetitive work around them is not.

Every application asks for another carefully tailored message. After getting selected and completing the visit, I still have to organize photos, turn scattered notes into a full blog post, reread the campaign brief, count keywords, and check every mission before publishing. Some days, writing the post itself feels like the hardest part.

I built ReviewForge to automate that repetitive work without inventing the experience. It reads each campaign, helps me write a relevant application, turns my real photos and personal notes into a grounded draft, and checks the result against the original mission.

## The Product

### Apply — Get Selected

```text
Campaign URL + Applicant Highlights
→ Campaign Analysis
→ Personalized Application Messages
```

ReviewForge reads the actual campaign brief and creates one personalized application message. Personal highlights—such as age, location, interests, or content strengths—are used only when the creator provides them.

### Write Review — Stay Compliant

```text
Campaign URL + Visit Photos + Personal Note
→ Media Analysis
→ Grounded Blog Draft
→ Mission Compliance QA
```

The draft is grounded in the campaign requirements, uploaded visit media, and the creator's firsthand notes. A deterministic verifier checks photo and video counts, length, keywords, hashtags, links, and conditional missions.

## Processing Flow

```text
APPLY
Public URL → Web Reader → Application Writer

WRITE REVIEW
Public URL + Photos + Note → Review Writer → Requirement Check
```

## Tech Stack

- Next.js
- TypeScript
- Built-in public web reader
- Local campaign and writing engine

## Run Locally

```bash
npm install
npm run dev
```

No API keys are required. Use `.env.example` only if you want to toggle Demo Mode.

## Demo Mode

Demo Mode lets users explore both flows with sample inputs. With Demo Mode off, ReviewForge reads the submitted public campaign URL directly.
