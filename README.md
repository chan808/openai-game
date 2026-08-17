# ECHO

시간 조작과 위치 이동을 중심으로 실험하는 브라우저 탑다운 액션 게임이다.

현재는 이동, 조준, 기본 공격의 조작감을 확인하는 최소 전투 프로토타입 단계다. 장비, 적응형 적, 진행 구조는 기본 조작을 직접 플레이한 뒤 결정한다.

## 기술

- TypeScript strict
- Vite
- Phaser 4.2.1
- Vitest

## 문서

- [제품 방향](./PRD.md)
- [기술 제약](./docs/TECH_SPEC.md)
- [배포와 원격 플레이테스트](./docs/DEPLOYMENT.md)
- [개발 기록](./docs/DEVLOG.md)

## 개발 명령

```bash
npm install
npm run dev
npm run verify
```

## 현재 조작

- `WASD`: 이동
- 포인터와 왼쪽 클릭: 조준과 기본 공격
- `1`, `2`, `3`: 롱소드, 활, 마법 전환
- `Space` 누르기: MP를 소모해 슬로우 유지

Cloudflare 로그인이 완료된 환경에서는 `npm run deploy:preview`로 공유 가능한 Preview를 만들고, `npm run deploy`로 프로덕션에 배포할 수 있다. 평소에는 GitHub와 연결된 Cloudflare Workers Builds를 사용한다.

구체적인 키 배정과 튜닝 값은 아직 확정 사양이 아니다.
