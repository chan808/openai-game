# ECHO — Deployment

현재 배포 대상은 Cloudflare Workers Static Assets다. 게임은 `dist/`의 정적 파일로 배포하며, 서버 코드와 런타임 시크릿은 아직 추가하지 않는다.

Cloudflare는 신규 정적·풀스택 프로젝트에 Workers Static Assets 사용을 권장한다. Pages는 계속 동작하지만 새 기능과 최적화는 Workers에 집중된다.

## 배포 구조

```text
GitHub main
  -> Cloudflare Workers Builds
  -> npm run verify
  -> npx wrangler deploy
  -> echo-game.<account-subdomain>.workers.dev
```

- `main` 푸시는 프로덕션 배포로 사용한다.
- 다른 브랜치와 Pull Request는 Cloudflare의 버전별 Preview URL로 검증한다.
- 로컬에서 수동 배포할 때만 `npm run deploy`를 사용한다.
- `wrangler.jsonc`의 `name`과 Cloudflare 대시보드의 Worker 이름은 같아야 한다.

## 최초 Cloudflare 연결

1. 변경 사항을 커밋하고 GitHub의 `main`에 푸시한다.
2. Cloudflare Dashboard에서 **Workers & Pages -> Create application -> Import a repository**를 선택한다.
3. GitHub 저장소 `chan808/openai-game` 접근을 허용하고 저장소를 선택한다.
4. Worker 이름을 `echo-game`으로 지정한다.
5. Production branch를 `main`으로 지정한다.
6. Build command를 `npm run verify`로 지정한다.
7. Deploy command를 `npx wrangler deploy`로 지정한다.
8. Non-production branch deploy command는 기본값 `npx wrangler versions upload`를 유지한다.
9. Root directory는 저장소 루트로 둔다.
10. 첫 배포 후 제공되는 `workers.dev` 주소에서 게임 실행과 브라우저 콘솔 오류를 확인한다.

Node.js 버전은 `.node-version`과 `package.json`에서 22로 고정한다. Cloudflare가 의존성 설치를 자동으로 수행하므로 별도 설치 명령은 지정하지 않는다.

## 평소 작업 흐름

```text
작업 브랜치 생성
  -> 로컬 npm run verify
  -> GitHub push
  -> Cloudflare Preview URL에서 외부 테스트
  -> 피드백 반영
  -> main 병합
  -> 프로덕션 URL 자동 갱신
```

지인에게는 프로덕션 URL보다 해당 테스트 버전의 Preview URL을 전달하면, 진행 중인 변경이 안정된 버전에 섞이는 일을 피할 수 있다. 피드백에는 사용한 URL, 브라우저, 입력 장치와 재현 순서를 함께 받는다.

## 수동 배포

Cloudflare 로그인이 완료된 개발 환경에서는 다음 명령을 사용할 수 있다.

```bash
npm run deploy:preview
npm run deploy
```

`deploy:preview`는 프로덕션 트래픽을 바꾸지 않는 버전 URL을 만들고, `deploy`는 현재 Worker를 프로덕션으로 배포한다. 일반 작업에서는 GitHub 연동 배포를 우선한다.

## 향후 API와 Hive 연동

점수와 계정 요구사항이 확정되기 전에는 Worker 엔트리나 `/api` 라우트를 만들지 않는다. 필요해지면 같은 Worker에 서버 엔트리를 추가하고 정적 에셋과 API를 한 배포 단위로 유지한다.

```text
Browser
  -> /api/score
  -> Cloudflare Worker
  -> Hive API
```

Hive Certification Key 같은 서버 자격 증명은 Cloudflare Runtime Secret으로만 저장한다. `VITE_` 접두사 환경 변수, 저장소, 클라이언트 번들에는 절대 넣지 않는다.

멀티플레이나 WebSocket이 실제로 필요해지면 별도 검토한다. 외부 플레이테스트 배포만을 위해 Durable Objects, D1, KV, R2 또는 백엔드 프레임워크를 미리 추가하지 않는다.
