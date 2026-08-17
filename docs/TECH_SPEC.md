# ECHO — Technical Constraints

이 문서는 첫 프로토타입부터 반드시 지켜야 하는 기술 경계만 정의한다. 아직 플레이로 검증하지 않은 게임 시스템의 상세 설계는 포함하지 않는다.

## 스택

- Node.js 22.12+
- TypeScript strict
- Vite
- Phaser 4.2.1
- Vitest
- 정적 웹 빌드

Phaser는 반드시 `4.2.1`로 정확히 고정한다. 설치와 스모크 테스트가 끝나기 전에는 게임 로직을 구현하지 않는다.

## 절대 규칙

1. 게임 로직은 60Hz 고정 타임스텝으로만 진행한다.
2. Phaser Arcade/Matter Physics를 사용하지 않는다.
3. Phaser는 presentation 계층에서 렌더링, 브라우저 입력, 카메라, 오디오와 이펙트만 담당한다.
4. 이동·공격·충돌 상태는 순수 TypeScript 데이터와 함수로 처리한다.
5. 액터는 키보드와 마우스를 직접 읽지 않고 `InputSource`만 받는다.
6. 플레이테스트로 조정할 게임필 수치는 `src/content/tuning.ts`에 둔다. 기술 상수는 담당 모듈에 이름을 붙여 둔다.
7. 네트워크, 저장소, 플랫폼 인터페이스는 실제로 필요해질 때까지 만들지 않는다.

## 첫 프로토타입 구조

처음부터 최종 폴더 구조를 만들지 않는다. 첫 동작에 필요한 파일만 생성한다.

```text
src/
  main.ts
  core/
    GameClock.ts
    GameClock.test.ts
    InputSource.ts
  game/
    GameState.ts
    updateGame.ts
  presentation/
    ArenaScene.ts
    PhaserInputSource.ts
  content/
    tuning.ts
```

- `core`와 `game`은 Phaser, DOM, 브라우저 이벤트를 import하지 않는다.
- `presentation`이 Phaser API를 담당한다. `main.ts`는 Phaser 부트스트랩과 의존성 조립만 하며 게임 규칙을 갖지 않는다.
- 실제 기능이 생길 때만 파일을 분리한다.

## 고정 타임스텝

Phaser의 렌더 프레임 경과시간은 `GameClock` 누적기에만 전달한다. 게임 업데이트는 `GameClock`이 생성한 고정 스텝으로 실행한다.

```ts
interface SimulationStep {
  frame: number;
  dt: number;
}
```

- 한 렌더 프레임에서 실행할 최대 catch-up 횟수를 제한한다.
- 탭 복귀 후 남은 과도한 누적시간은 버린다.
- `Date.now()`, `performance.now()`, `requestAnimationFrame` 델타를 게임 규칙에서 직접 읽지 않는다.
- 첫 테스트는 정상 프레임, 긴 프레임, catch-up 제한을 검증한다.

슬로우와 히트스톱은 첫 프로토타입 이후 별도 단계에서 설계한다. 추가되더라도 시뮬레이션은 계속 60Hz로 실행하고, 시간 효과는 결정론적인 게임 상태와 규칙으로 표현한다. 전역·플레이어 제외·엔티티별 적용 여부는 플레이테스트 후 결정하며, 지금 관련 필드나 추상화를 추가하지 않는다.

## 입력 모델

첫 프로토타입은 동작의 의미만 표현하고 실제 키는 어댑터가 결정한다.

```ts
interface InputFrame {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  primaryPressed: boolean;
}

interface InputSource {
  sample(frame: number): InputFrame;
}
```

- `moveX`, `moveY`, `aimX`, `aimY`는 정규화된 방향이다.
- `primaryPressed`는 브라우저 입력의 상승 에지를 어댑터가 보관했다가 다음 시뮬레이션 틱에서 한 번만 반환하고 즉시 비운다.
- 한 렌더 프레임에서 여러 catch-up 틱이 실행되어도 클릭 한 번이 여러 공격으로 소비되면 안 된다.
- 임시 키 배정은 `PhaserInputSource` 한 파일에서만 변경한다.
- 슬로우, 순간이동, 장비 선택 필드는 해당 기능을 구현할 때 추가한다.

이 형태는 나중에 로컬 입력을 녹화하거나 네트워크 입력으로 교체할 수 있게 하지만, 지금 리플레이나 네트워크 구현을 요구하지 않는다.

## 첫 게임 상태

첫 프로토타입 상태는 다음 정보만 가진다.

- 플레이어 위치와 조준 방향
- 피격 대상 위치, 적중 횟수와 피격 표시의 남은 프레임
- 기본 공격의 활성 여부, 남은 프레임과 쿨다운
- 현재 시뮬레이션 프레임

장비, 경험치, 층, 보스, 적응 통계 필드는 아직 추가하지 않는다.

## 이동과 충돌

- 플레이어와 피격 대상은 원 충돌체로 시작한다.
- 아레나 경계는 축 정렬 사각형으로 처리한다.
- 기본 공격은 조준 방향의 단순한 원 또는 부채꼴 하나로 시작한다.
- Phaser 물리 바디와 충돌 이벤트에 판정을 맡기지 않는다.

정확한 이동 속도, 공격 거리, 공격 간격, 충돌 크기는 임시 값으로 두고 플레이테스트 후 확정한다.

## 렌더링

첫 화면은 도형만 사용한다.

- 플레이어: 원 또는 삼각형
- 조준 방향: 짧은 선
- 피격 대상: 사각형 또는 원
- 공격 판정: 디버그 표시 가능
- 배경: 단색

애니메이션, 파티클, 카메라 효과, 외부 에셋은 기본 조작이 확정된 뒤 추가한다. 렌더 보간도 60Hz 상태 표시가 고주사율 화면에서 실제로 거슬릴 때 presentation 계층에만 추가한다.

## 테스트

첫 게임 로직 작업에서 필요한 테스트는 `GameClock`뿐이다. 이후 순수 로직을 추가할 때 해당 기능의 테스트를 함께 추가한다.

매 변경 후 실행한다.

```bash
npm test
npm run build
```

## 나중에 확장할 때 지킬 경계

- 장비는 키가 아니라 슬롯 ID로 선택한다.
- 게임 상태에는 Phaser 객체를 저장하지 않는다.
- 엔티티가 여러 개 생기면 안정적인 ID와 업데이트 순서를 사용한다.
- 랜덤이 생기면 `Math.random()` 대신 시드 기반 `Rng`를 추가한다.
- 멀티플레이 서버와 Spring Boot 연동은 기본 전투와 게임 방향이 확정된 뒤 별도 설계한다.

이 항목들은 미래 구현을 미리 만들라는 의미가 아니다. 현재 코드를 특정 입력 장치나 Phaser 객체에 묶지 말라는 경계다.
