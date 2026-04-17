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
- 선택한 provider에 맞는 설정
  - `codex`면 `CODEX_BIN`, `CODEX_MODEL`, `CODEX_AUTH_DIR`
  - `google`면 `GOOGLE_API_KEY`
  - `openai`면 `OPENAI_API_KEY`
  - `anthropic`면 `ANTHROPIC_API_KEY`

중요:

- `codex`는 API 직접 호출이 아니라 로컬 Codex CLI 런타임을 사용한다
- Docker/NAS에서 Codex를 쓸 때는 `CODEX_AUTH_DIR/auth.json` 마운트가 필요하다

자세한 배포/온보딩은 [ONBOARDING.md](/Users/dusehd1/Projects/lovesick1/ONBOARDING.md)를 본다.
