# lovesick1

Discord 채팅방을 `shared-memory app`처럼 쓰는 실험용 봇.

여러 명이 나눈 대화, 약속, 사진, 링크를 기억하고 `/ask`, `/memory`, `/schedule` 같은 명령으로 다시 꺼내는 방향으로 만들고 있다.

## 현재 상태

동작하는 핵심:

- Discord 메시지 수집
- 최근 대화 + RAG 검색
- user/shared/relationship memory 저장
- 약속 이벤트 추출
- 사진/링크 memory 저장
- `/ask` 질의 응답
- `/memory`, `/schedule`, `/forget`

정리된 것:

- 음악 재생 기능 제거
- TTS 제거
- 이미지 생성 기능 제거
- 예전 웹 채팅 API 제거

아직 남아 있는 것:

- 관리자 대시보드 일부에 설정 UI 흔적
- 프리셋/대시보드 구조는 계속 정리 중

## 주요 명령

- `/ask`
- `/summary`
- `/memory`
- `/schedule`
- `/forget`
- `/mode`
- `/status`

## 실행

```bash
npm install
npm run typecheck
npm run dev
```

Docker:

```bash
docker compose up -d --build
```

`data/`는 볼륨으로 유지해야 memory/event 데이터가 보존된다.

## 환경변수

```bash
cp .env.example .env
```

최소 필요:

- `DISCORD_TOKEN`
- `OWNER_ID`
- `DASHBOARD_SECRET`
- `AI_PROVIDER`
- 해당 provider의 API 키

중요:

- 현재 서버 런타임은 `Codex 구독만으로 직접 동작하지 않는다`
- 운영에는 `google`, `openai`, `anthropic` 중 하나의 API 키가 필요하다

자세한 배포/온보딩은 [ONBOARDING.md](/Users/dusehd1/Projects/lovesick1/ONBOARDING.md)를 본다.
