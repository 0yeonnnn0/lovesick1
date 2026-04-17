# Lovesick1 Onboarding

`lovesick1`은 Discord 채팅방을 shared-memory 앱처럼 쓰는 봇이다.  
여러 명이 나눈 대화, 약속, 사진, 링크를 기억하고 `/ask`, `/memory`, `/schedule` 같은 명령으로 다시 꺼내는 방향으로 구성되어 있다.

## 1. 현재 구조 이해

- Discord가 기본 UI다.
- 기억 데이터는 로컬 `data/` 디렉터리에 저장된다.
- AI 응답/추출은 `google`, `openai`, `anthropic`, `codex` 중 하나를 사용한다.
- `codex`는 API 직접 호출이 아니라 로컬 Codex CLI 런타임을 사용한다.

## 2. Codex 관련

현재 프로젝트는 `codex exec` 기반의 실험적 Codex 런타임을 지원한다.

- `AI_PROVIDER=codex`면 서버가 로컬 `codex` 바이너리를 실행한다.
- 이 방식은 서버에 Codex CLI가 설치되어 있어야 하고, 미리 `codex login`으로 로그인돼 있어야 한다.
- 공식 문서 기준으로 Codex CLI는 `Sign in with ChatGPT`와 `API key` 둘 다 지원한다.
- 공식 문서는 자동화 기본값으로는 API key를 권장하지만, trusted runner에서는 ChatGPT-managed auth도 가능하다고 안내한다.

공식 참고:

- Authentication: https://developers.openai.com/codex/auth
- Non-interactive mode: https://developers.openai.com/codex/noninteractive
- Codex SDK: https://developers.openai.com/codex/sdk

현재 lovesick1의 Codex 경로 제약:

- `codex exec` 기반이라 응답 속도가 일반 API보다 느릴 수 있다.
- 이미지 입력은 inline vision으로 넘기지 않고 텍스트 문맥만 넘긴다.
- 서버는 trusted environment여야 한다.

## 3. Discord 준비

Discord Developer Portal에서 새 앱을 만든다.

필수 설정:

- `Bot` 생성
- Bot Token 발급
- `MESSAGE CONTENT INTENT` 켜기
- `GUILD MEMBERS INTENT` 켜기

초대 링크 생성 시 권장 권한:

- `View Channels`
- `Send Messages`
- `Read Message History`
- `Use Slash Commands`

OAuth2 scope:

- `bot`
- `applications.commands`

## 4. 환경변수 준비

```bash
cp .env.example .env
```

최소 예시:

```env
DISCORD_TOKEN=your_discord_bot_token
OWNER_ID=your_discord_user_id
DASHBOARD_PORT=3000
DASHBOARD_SECRET=change_this_to_a_real_secret

AI_PROVIDER=google
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MODEL=gemini-2.5-flash-lite
```

선택:

- `OPENAI_API_KEY`, `OPENAI_MODEL`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`
- `CODEX_BIN`, `CODEX_MODEL`
- `CODEX_AUTH_DIR`
- `VAULT_PATH`

Codex 예시:

```env
AI_PROVIDER=codex
CODEX_BIN=codex
CODEX_MODEL=gpt-5.4
CODEX_AUTH_DIR=./.codex
```

그리고 서버에 auth 캐시 디렉터리를 준비한다:

```bash
mkdir -p ./.codex
codex login
cp ~/.codex/auth.json ./.codex/auth.json
```

## 5. 로컬 실행

```bash
npm install
npm run typecheck
npm run dev
```

정상이라면:

- Discord 로그인 완료 로그
- 슬래시 커맨드 등록 로그
- `http://localhost:3000` 대시보드 접근 가능

## 6. Docker 배포

이 프로젝트는 `docker-compose.yml`에 `./data:/app/data` 볼륨을 걸어둔 상태를 기준으로 한다.  
이 볼륨이 없으면 memory/event/log 데이터가 컨테이너 재생성 시 유실될 수 있다.

`AI_PROVIDER=codex`면 compose가 `${CODEX_AUTH_DIR:-./.codex}:/root/.codex`도 같이 마운트한다.  
즉 호스트 쪽 `CODEX_AUTH_DIR/auth.json`이 있어야 컨테이너 안의 Codex CLI가 로그인 상태를 재사용할 수 있다.

이 이미지에는 `@openai/codex` CLI가 같이 설치된다.

소스 없이 운영하려면 GitHub Container Registry 이미지를 바로 받을 수도 있다.

이미지:

```bash
ghcr.io/0yeonnnn0/lovesick1:latest
```

`main` 브랜치 푸시 시 GitHub Actions가 이 이미지를 갱신하도록 설정돼 있다.

실행:

```bash
docker compose up -d --build
docker compose logs -f
```

중요 확인:

- 봇 로그인 완료
- 슬래시 커맨드 등록 완료
- 에러 없이 provider 로드
- Codex 사용 시 `Codex 인증이 필요합니다` 오류가 없는지 확인

## 7. NAS/서버 운영 체크리스트

- `data/` 백업
- `.env`는 Git에 올리지 않기
- 외부 공개가 필요 없으면 `3000` 포트는 내부망만 허용
- 모델 API 사용량/쿼터 확인
- Discord 토큰 재발급 절차 메모
- Codex를 쓸 경우 `codex login` 세션 유지 확인
- Codex를 쓸 경우 `CODEX_AUTH_DIR/auth.json` 백업 및 권한 확인

## 8. 첫 테스트 순서

1. 테스트용 채널 하나를 만든다.
2. 아래처럼 말해본다.
   - `나 요즘 재즈 좋아해`
   - `토요일 7시에 성수에서 보자`
   - 사진 1장 업로드
   - 링크 1개 공유
3. 아래 명령을 확인한다.
   - `/memory`
   - `/schedule`
   - `/ask 우리 다음 약속 언제지?`
   - `/ask 아까 올린 사진 기억나?`
4. 오탐이면 `/forget <id>`로 삭제한다.

## 9. 현재 명령 세트

- `/ask`
- `/summary`
- `/memory`
- `/schedule`
- `/forget`
- `/status`

## 10. 현재 알려진 제약

- memory extraction은 아직 완전한 정밀 추출기가 아니라 `휴리스틱 + AI 혼합`이다.
- 사진 검색은 전문 이미지 검색이 아니라 `요약/태그 기반 회상`이다.
- Codex 경로는 `codex exec` 기반의 실험적 통합이다.
- Codex를 쓰려면 서버에 설치된 CLI와 로그인 세션이 필요하다.
- Docker에서는 `CODEX_AUTH_DIR -> /root/.codex` 마운트가 빠지면 인증이 풀린다.

## 11. 추천 운영 방식

초기에는 작은 개인 Discord 서버에서 먼저 검증하는 게 맞다.

추천 검증 포인트:

- 중복 기억이 과도하게 쌓이지 않는지
- 약속 추출이 실제로 유용한지
- 사진/링크 회상이 자연스러운지
- 오탐을 `/forget`으로 감당 가능한지
