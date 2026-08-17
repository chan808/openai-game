export const SIMULATION_HZ = 60;
export const FIXED_STEP_SECONDS = 1 / SIMULATION_HZ;
export const FIXED_STEP_MILLISECONDS = 1_000 / SIMULATION_HZ;
export const MAX_CATCH_UP_TICKS = 5;

const ACCUMULATOR_EPSILON_MILLISECONDS = 1e-9;

export interface SimulationStep {
  frame: number;
  dt: number;
}

export class GameClock {
  private accumulatorMilliseconds = 0;
  private frame = 0;

  advance(
    renderDeltaMilliseconds: number,
    runSimulationStep: (step: SimulationStep) => void,
  ): number {
    this.accumulatorMilliseconds += renderDeltaMilliseconds;

    let stepsRun = 0;
    while (
      this.accumulatorMilliseconds + ACCUMULATOR_EPSILON_MILLISECONDS >=
        FIXED_STEP_MILLISECONDS &&
      stepsRun < MAX_CATCH_UP_TICKS
    ) {
      this.accumulatorMilliseconds -= FIXED_STEP_MILLISECONDS;
      this.frame += 1;
      stepsRun += 1;
      runSimulationStep({ frame: this.frame, dt: FIXED_STEP_SECONDS });
    }

    if (
      Math.abs(this.accumulatorMilliseconds) <
      ACCUMULATOR_EPSILON_MILLISECONDS
    ) {
      this.accumulatorMilliseconds = 0;
    }

    if (
      this.accumulatorMilliseconds + ACCUMULATOR_EPSILON_MILLISECONDS >=
      FIXED_STEP_MILLISECONDS
    ) {
      this.accumulatorMilliseconds = 0;
    }

    return stepsRun;
  }
}
