# ECHO

시간 조작과 위치 이동을 중심으로 실험하는 브라우저 탑다운 액션 게임이다.

현재는 이동, 조준, 기본 공격과 검병·궁병 조합의 조작감을 확인하는 최소 전투 프로토타입 단계다. 방패병, 마법사, 장비 드롭과 적응형 진행 구조는 현재 두 적의 전투를 직접 플레이한 뒤 한 단계씩 검증한다.

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
- 기본 `Space`: MP를 소모해 슬로우 유지
- 기본 마우스 오른쪽 클릭: 커서 방향으로 순간이동
- `Tab`: 스킬창 열기·닫기

하단의 Q, E, R, Space와 마우스 오른쪽 버튼 슬롯에는 스킬창에서 슬로우와 순간이동을 드래그해 배치할 수 있다. 순간이동은 슬로우와 별개로 사용할 수 있으며, 기본 쿨타임이 있지만 공격이 적중하면 즉시 다시 사용할 수 있다.

Cloudflare 로그인이 완료된 환경에서는 `npm run deploy:preview`로 공유 가능한 Preview를 만들고, `npm run deploy`로 프로덕션에 배포할 수 있다. 평소에는 GitHub와 연결된 Cloudflare Workers Builds를 사용한다.

구체적인 키 배정과 튜닝 값은 아직 확정 사양이 아니다.
