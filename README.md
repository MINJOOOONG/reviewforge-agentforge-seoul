# ReviewForge

체험단 신청부터 방문 후 후기 작성과 미션 검수까지 자동화하는 AI Creator Agent.

## Problem

체험단 사용자는 공고마다 신청 문구를 작성하고, 선정 후에는 사진을 정리하고 후기 작성 조건을 다시 확인해야 한다.

## Solution

### Apply

Campaign URL → Campaign Analysis → Application Message

### Write Review

Campaign URL + Photos + Personal Note → Blog Draft → Compliance QA

## Tech Stack

- Next.js
- TypeScript
- Bright Data
- Qwen Cloud
- Nosana
- Daytona

## Sponsor Integration

- Bright Data — 체험단 공개 페이지 수집
- Qwen Cloud — 캠페인 이해 및 콘텐츠 생성
- Nosana — 업로드 미디어 GPU 분석
- Daytona — 생성된 후기의 요구사항 코드 기반 검증

## Flow

```text
APPLY
Bright Data → Qwen Cloud

WRITE REVIEW
Bright Data → Nosana → Qwen Cloud → Daytona
```

## Run

```bash
npm install
npm run dev
```

환경변수는 `.env.example` 참고.

## Demo Mode

API 인증정보 없이도 UI 및 전체 제품 흐름을 시연할 수 있는 Demo Mode를 지원한다.
