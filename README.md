# ReviewForge

음식점, 카페, 뷰티샵, 숙박, 클래스 등 지역 방문형 체험단의 신청부터 방문 후기 작성과 미션 검수까지 돕는 AI Creator Agent.

ReviewForge의 MVP 범위는 직접 방문하는 Local Experience Campaign이며, 제품을 배송받아 리뷰하는 Product Campaign은 포함하지 않는다.

## Problem

지역 방문형 체험단 사용자는 공고마다 선정 가능성을 높일 신청 문구를 작성하고, 선정 후 직접 방문해 촬영한 사진과 경험을 정리한 뒤 리뷰 미션을 다시 확인해야 한다.

## Solution

### Apply

Get selected with a campaign-specific application message.

Campaign URL + Applicant Highlights → Campaign Analysis → Application Message

### Write Review

Turn your real visit into a compliant review.

Campaign URL + Visit Photos + Personal Note → Blog Draft → Compliance QA

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
