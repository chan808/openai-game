import Phaser from 'phaser';

import { FIXED_STEP_SECONDS, GameClock } from '../core/GameClock';
import {
  ARCHER_RADIUS,
  ARCHER_RESPAWN_FRAMES,
  ARCHER_WINDUP_FRAMES,
  ARENA_HEIGHT,
  ARENA_WALL_THICKNESS,
  ARENA_WIDTH,
  BOW_PROJECTILE_RADIUS,
  LONGSWORD_BLADE_RADIUS,
  LONGSWORD_REACH,
  LONGSWORD_SWING_RADIANS,
  MAGIC_PROJECTILE_RADIUS,
  PLAYER_DAMAGE_SHAKE_DURATION_MS,
  PLAYER_DAMAGE_SHAKE_INTENSITY,
  PLAYER_RADIUS,
  SWORDSMAN_RADIUS,
  SWORDSMAN_RESPAWN_FRAMES,
  TELEPORT_ECHO_DURATION_FRAMES,
} from '../content/tuning';
import {
  createInitialGameState,
  type ArcherState,
  type EnemyState,
  type PlayerState,
  type ProjectileState,
  type ResourceState,
  type SwordsmanState,
  type UltimatePhase,
  type UltimateRecordedProjectile,
} from '../game/GameState';
import {
  getLongswordSwingAngle,
  getLongswordSwingDirection,
} from '../game/longsword';
import { getSwordsmanAttackReach } from '../game/swordsman';
import {
  getTerrainRayDistance,
  TERRAIN_OBSTACLES,
} from '../game/terrain';
import { updateGame } from '../game/updateGame';
import { getUltimateReplayFrame } from '../game/ultimate';
import {
  PhaserInputSource,
  WEAPON_SLOT_HINT,
} from './PhaserInputSource';
import { PatternReportUi } from './PatternReportUi';
import { SkillBindings } from './SkillBindings';
import { SkillLoadoutUi } from './SkillLoadoutUi';
import { VISUAL_METRICS, VISUAL_PALETTE } from './visualTheme';

const PLAYER_COLOR = VISUAL_PALETTE.player;
const PLAYER_HIT_COLOR = VISUAL_PALETTE.playerHit;
const PLAYER_INVULNERABLE_COLOR = VISUAL_PALETTE.playerInvulnerable;
const SWORDSMAN_COLOR = VISUAL_PALETTE.swordsman;
const SWORDSMAN_HIT_COLOR = VISUAL_PALETTE.text;
const SWORDSMAN_WINDUP_COLOR = VISUAL_PALETTE.swordsmanLight;
const SWORDSMAN_ATTACK_COLOR = VISUAL_PALETTE.swordsmanAttack;
const ARCHER_COLOR = VISUAL_PALETTE.archer;
const ARCHER_HIT_COLOR = VISUAL_PALETTE.text;
const ARCHER_TELEGRAPH_COLOR = VISUAL_PALETTE.archerLight;
const ENEMY_ARROW_COLOR = VISUAL_PALETTE.enemyArrow;
const AIM_COLOR = VISUAL_PALETTE.aim;
const LONGSWORD_COLOR = VISUAL_PALETTE.longsword;
const ARROW_COLOR = VISUAL_PALETTE.arrow;
const MAGIC_COLOR = VISUAL_PALETTE.magic;
const TELEPORT_READY_COLOR = VISUAL_PALETTE.teleportReady;
const TELEPORT_COOLDOWN_COLOR = VISUAL_PALETTE.teleportCooldown;
const TELEPORT_ECHO_COLOR = VISUAL_PALETTE.teleportEcho;
const LAST_KNOWN_POSITION_COLOR = VISUAL_PALETTE.lastKnownPosition;
const RESOURCE_BACKGROUND_COLOR = VISUAL_PALETTE.resourceBackground;
const HEALTH_COLOR = VISUAL_PALETTE.health;
const ULTIMATE_CHARGE_COLOR = VISUAL_PALETTE.ultimate;
const ULTIMATE_RECORD_COLOR = VISUAL_PALETTE.ultimateRecord;
const ULTIMATE_REPLAY_COLOR = VISUAL_PALETTE.ultimateReplay;
const RESOURCE_BAR_WIDTH = VISUAL_METRICS.resourceBarWidth;
const RESOURCE_BAR_HEIGHT = VISUAL_METRICS.resourceBarHeight;

export class ArenaScene extends Phaser.Scene {
  private readonly clock = new GameClock();
  private readonly state = createInitialGameState();
  private graphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private inputSource!: PhaserInputSource;
  private skillLoadoutUi!: SkillLoadoutUi;
  private patternReportUi!: PatternReportUi;
  private readonly skillBindings = new SkillBindings();
  private lastPlayerHitCount = 0;

  constructor() {
    super('arena');
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.statusText = this.add.text(ARENA_WIDTH - 16, 16, '', {
      align: 'right',
      color: '#96a5bd',
      fontFamily: 'monospace',
      fontSize: '12px',
      lineSpacing: 3,
    }).setOrigin(1, 0).setDepth(100);
    this.inputSource = new PhaserInputSource(this, this.skillBindings);
    this.skillLoadoutUi = new SkillLoadoutUi(
      this,
      this.skillBindings,
      this.inputSource,
    );
    this.patternReportUi = new PatternReportUi(
      this,
      this.inputSource,
      () => !this.skillLoadoutUi.isOpen(),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.patternReportUi.destroy();
      this.skillLoadoutUi.destroy();
      this.inputSource.destroy();
    });

    this.renderState();
  }

  update(_time: number, delta: number): void {
    if (!this.skillLoadoutUi.isOpen() && !this.patternReportUi.isOpen()) {
      this.clock.advance(delta, (step) => {
        updateGame(this.state, this.inputSource, step);
      });
    }
    this.playPlayerDamageFeedback();
    this.renderState();
  }

  private playPlayerDamageFeedback(): void {
    if (this.state.player.hitCount === this.lastPlayerHitCount) {
      return;
    }

    this.lastPlayerHitCount = this.state.player.hitCount;
    this.cameras.main.shake(
      PLAYER_DAMAGE_SHAKE_DURATION_MS,
      PLAYER_DAMAGE_SHAKE_INTENSITY,
    );
  }

  private renderState(): void {
    const {
      player,
      enemies,
      selectedWeapon,
      longswordAttack,
      projectiles,
      teleport,
      ultimate,
      formation,
    } = this.state;

    this.graphics.clear();
    this.renderTerrain();
    if (ultimate.phase !== 'inactive') {
      const timeColor =
        ultimate.phase === 'recording'
          ? ULTIMATE_RECORD_COLOR
          : ULTIMATE_REPLAY_COLOR;
      this.graphics.fillStyle(timeColor, 0.12);
      this.graphics.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    }

    if (formation.phase === 'searching') {
      const { lastKnownPlayerX, lastKnownPlayerY } = formation;
      this.graphics.lineStyle(2, LAST_KNOWN_POSITION_COLOR, 0.65);
      this.graphics.strokeCircle(lastKnownPlayerX, lastKnownPlayerY, 12);
      this.graphics.lineBetween(
        lastKnownPlayerX - 8,
        lastKnownPlayerY,
        lastKnownPlayerX + 8,
        lastKnownPlayerY,
      );
      this.graphics.lineBetween(
        lastKnownPlayerX,
        lastKnownPlayerY - 8,
        lastKnownPlayerX,
        lastKnownPlayerY + 8,
      );
    }

    const teleportReady = teleport.cooldownFramesRemaining === 0;
    const teleportColor = teleportReady
      ? TELEPORT_READY_COLOR
      : TELEPORT_COOLDOWN_COLOR;
    this.graphics.lineStyle(1, teleportColor, 0.22);
    this.graphics.lineBetween(
      player.x,
      player.y,
      teleport.destinationX,
      teleport.destinationY,
    );
    this.graphics.fillStyle(teleportColor, teleportReady ? 0.1 : 0.035);
    this.graphics.fillCircle(
      teleport.destinationX,
      teleport.destinationY,
      PLAYER_RADIUS + 6,
    );
    this.graphics.lineStyle(3, teleportColor, teleportReady ? 0.88 : 0.42);
    for (let index = 0; index < 6; index += 1) {
      const startAngle = index * Math.PI / 3 + this.state.frame * 0.008;
      this.graphics.beginPath();
      this.graphics.arc(
        teleport.destinationX,
        teleport.destinationY,
        PLAYER_RADIUS + 5,
        startAngle,
        startAngle + 0.52,
      );
      this.graphics.strokePath();
    }
    this.graphics.lineStyle(1, teleportColor, 0.55);
    this.graphics.lineBetween(
      teleport.destinationX - 7,
      teleport.destinationY,
      teleport.destinationX + 7,
      teleport.destinationY,
    );
    this.graphics.lineBetween(
      teleport.destinationX,
      teleport.destinationY - 7,
      teleport.destinationX,
      teleport.destinationY + 7,
    );

    if (teleport.echo.framesRemaining > 0) {
      const lifeRatio =
        teleport.echo.framesRemaining / TELEPORT_ECHO_DURATION_FRAMES;
      this.graphics.fillStyle(TELEPORT_ECHO_COLOR, 0.12 + lifeRatio * 0.2);
      this.graphics.fillCircle(
        teleport.echo.x,
        teleport.echo.y,
        PLAYER_RADIUS,
      );
      this.graphics.lineStyle(3, TELEPORT_ECHO_COLOR, 0.25 + lifeRatio * 0.55);
      this.graphics.strokeCircle(
        teleport.echo.x,
        teleport.echo.y,
        PLAYER_RADIUS,
      );
    }

    if (longswordAttack.activeFramesRemaining > 0) {
      const aimAngle = Math.atan2(
        longswordAttack.aimY,
        longswordAttack.aimX,
      );
      const swingAngle = getLongswordSwingAngle(longswordAttack);
      const swingDirection = getLongswordSwingDirection(longswordAttack);
      const unobstructedReach = getTerrainRayDistance(
        player.x,
        player.y,
        swingDirection.x,
        swingDirection.y,
        LONGSWORD_REACH,
        LONGSWORD_BLADE_RADIUS,
      );

      this.graphics.fillStyle(LONGSWORD_COLOR, 0.18);
      this.graphics.beginPath();
      this.graphics.moveTo(player.x, player.y);
      this.graphics.arc(
        player.x,
        player.y,
        unobstructedReach,
        aimAngle - LONGSWORD_SWING_RADIANS / 2,
        swingAngle,
      );
      this.graphics.closePath();
      this.graphics.fillPath();

      this.graphics.lineStyle(5, LONGSWORD_COLOR, 1);
      this.graphics.lineBetween(
        player.x +
          swingDirection.x * Math.min(PLAYER_RADIUS, unobstructedReach),
        player.y +
          swingDirection.y * Math.min(PLAYER_RADIUS, unobstructedReach),
        player.x + swingDirection.x * unobstructedReach,
        player.y + swingDirection.y * unobstructedReach,
      );
    }

    for (const projectile of projectiles) {
      if (projectile.timeDomain === 'world') {
        this.renderProjectile(projectile);
      }
    }
    if (ultimate.phase === 'recording') {
      for (const projectile of ultimate.projectileLaunches) {
        this.renderRecordedProjectile(projectile, 0.5);
      }
    }

    for (const enemy of enemies) {
      this.renderEnemy(enemy);
    }

    this.renderUltimateReplay();

    this.renderPlayer(player, ultimate.phase === 'replaying' ? 0.25 : 1);

    const displayedAim =
      longswordAttack.activeFramesRemaining > 0
        ? longswordAttack
        : player;
    if (ultimate.phase !== 'replaying') {
      this.graphics.lineStyle(3, AIM_COLOR, 1);
      this.graphics.lineBetween(
        player.x,
        player.y,
        player.x + displayedAim.aimX * (PLAYER_RADIUS + 28),
        player.y + displayedAim.aimY * (PLAYER_RADIUS + 28),
      );
    }

    this.renderResourceBar(
      16,
      16,
      player.health,
      HEALTH_COLOR,
      player.hitFlashFramesRemaining > 0 ? PLAYER_HIT_COLOR : 0xffffff,
    );
    this.renderResourceBar(
      16,
      36,
      ultimate.charge,
      ULTIMATE_CHARGE_COLOR,
    );

    const enemyStatus = enemies
      .map(
        (enemy) =>
          `${enemy.kind.toUpperCase()} ${Math.ceil(enemy.health.current)}/${enemy.health.maximum}`,
      )
      .join('  ·  ');
    this.statusText.setText(
      `${selectedWeapon.toUpperCase()}  ·  ${formation.phase.toUpperCase()}\n` +
        `${formatUltimatePhase(ultimate.phase, ultimate.phaseFramesRemaining)}  ·  ${enemyStatus}\n` +
        `${WEAPON_SLOT_HINT}  ·  DEFEATS ${player.defeatCount}`,
    );
    this.skillLoadoutUi.render(
      teleport.cooldownFramesRemaining,
      ultimate.charge.current,
      ultimate.charge.maximum,
      ultimate.phase,
      ultimate.phaseFramesRemaining,
    );
  }

  private renderTerrain(): void {
    const inset = VISUAL_METRICS.floorInset;
    const tileSize = VISUAL_METRICS.floorTileSize;

    this.graphics.fillStyle(VISUAL_PALETTE.void, 1);
    this.graphics.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    this.graphics.fillStyle(VISUAL_PALETTE.floor, 1);
    this.graphics.fillRect(
      inset,
      inset,
      ARENA_WIDTH - inset * 2,
      ARENA_HEIGHT - inset * 2,
    );

    this.graphics.lineStyle(1, VISUAL_PALETTE.floorLine, 0.34);
    for (let x = inset + tileSize; x < ARENA_WIDTH - inset; x += tileSize) {
      this.graphics.lineBetween(x, inset, x, ARENA_HEIGHT - inset);
    }
    for (let y = inset + tileSize; y < ARENA_HEIGHT - inset; y += tileSize) {
      this.graphics.lineBetween(inset, y, ARENA_WIDTH - inset, y);
    }

    this.graphics.lineStyle(2, VISUAL_PALETTE.floorAccent, 0.22);
    for (let y = inset + tileSize / 2; y < ARENA_HEIGHT - inset; y += tileSize) {
      const row = Math.floor(y / tileSize);
      for (
        let x = inset + tileSize / 2;
        x < ARENA_WIDTH - inset;
        x += tileSize
      ) {
        const direction = (Math.floor(x / tileSize) + row) % 2 === 0 ? 1 : -1;
        this.graphics.lineBetween(x - 8, y, x + 5, y + direction * 5);
        this.graphics.lineBetween(
          x + 5,
          y + direction * 5,
          x + 11,
          y + direction,
        );
      }
    }

    this.graphics.fillStyle(VISUAL_PALETTE.wallShadow, 0.9);
    this.graphics.fillRect(0, 0, ARENA_WIDTH, ARENA_WALL_THICKNESS + 8);
    this.graphics.fillRect(
      0,
      ARENA_HEIGHT - ARENA_WALL_THICKNESS,
      ARENA_WIDTH,
      ARENA_WALL_THICKNESS,
    );
    this.graphics.fillRect(0, 0, ARENA_WALL_THICKNESS + 8, ARENA_HEIGHT);
    this.graphics.fillRect(
      ARENA_WIDTH - ARENA_WALL_THICKNESS,
      0,
      ARENA_WALL_THICKNESS,
      ARENA_HEIGHT,
    );

    this.graphics.fillStyle(VISUAL_PALETTE.wall, 1);
    this.graphics.fillRect(0, 0, ARENA_WIDTH, ARENA_WALL_THICKNESS);
    this.graphics.fillRect(
      0,
      ARENA_HEIGHT - ARENA_WALL_THICKNESS,
      ARENA_WIDTH,
      ARENA_WALL_THICKNESS,
    );
    this.graphics.fillRect(0, 0, ARENA_WALL_THICKNESS, ARENA_HEIGHT);
    this.graphics.fillRect(
      ARENA_WIDTH - ARENA_WALL_THICKNESS,
      0,
      ARENA_WALL_THICKNESS,
      ARENA_HEIGHT,
    );

    this.graphics.lineStyle(3, VISUAL_PALETTE.wallEdge, 0.82);
    this.graphics.strokeRect(
      ARENA_WALL_THICKNESS,
      ARENA_WALL_THICKNESS,
      ARENA_WIDTH - ARENA_WALL_THICKNESS * 2,
      ARENA_HEIGHT - ARENA_WALL_THICKNESS * 2,
    );
    this.graphics.lineStyle(2, VISUAL_PALETTE.wallTop, 0.8);
    for (let x = 64; x < ARENA_WIDTH; x += 96) {
      this.graphics.lineBetween(x, 0, x, ARENA_WALL_THICKNESS);
      this.graphics.lineBetween(
        x + 48,
        ARENA_HEIGHT - ARENA_WALL_THICKNESS,
        x + 48,
        ARENA_HEIGHT,
      );
    }
    for (let y = 56; y < ARENA_HEIGHT; y += 88) {
      this.graphics.lineBetween(0, y, ARENA_WALL_THICKNESS, y);
      this.graphics.lineBetween(
        ARENA_WIDTH - ARENA_WALL_THICKNESS,
        y + 44,
        ARENA_WIDTH,
        y + 44,
      );
    }

    for (const obstacle of TERRAIN_OBSTACLES) {
      this.graphics.fillStyle(VISUAL_PALETTE.pillarShadow, 0.62);
      this.graphics.fillRoundedRect(
        obstacle.x + 10,
        obstacle.y + 12,
        obstacle.width,
        obstacle.height,
        8,
      );
      this.graphics.fillStyle(VISUAL_PALETTE.pillar, 1);
      this.graphics.fillRoundedRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        7,
      );
      this.graphics.fillStyle(VISUAL_PALETTE.pillarTop, 0.75);
      this.graphics.fillRoundedRect(
        obstacle.x + 7,
        obstacle.y + 7,
        obstacle.width - 14,
        15,
        4,
      );
      this.graphics.lineStyle(3, VISUAL_PALETTE.pillarEdge, 0.9);
      this.graphics.strokeRoundedRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
        7,
      );
      this.graphics.lineStyle(2, VISUAL_PALETTE.floorAccent, 0.7);
      this.graphics.strokeCircle(
        obstacle.x + obstacle.width / 2,
        obstacle.y + obstacle.height / 2,
        13,
      );
      this.graphics.lineBetween(
        obstacle.x + obstacle.width / 2 - 9,
        obstacle.y + obstacle.height / 2,
        obstacle.x + obstacle.width / 2 + 9,
        obstacle.y + obstacle.height / 2,
      );
    }
  }

  private renderUltimateReplay(): void {
    const replayFrame = getUltimateReplayFrame(this.state);
    if (replayFrame === null) {
      return;
    }

    for (const enemy of this.state.enemies) {
      if (enemy.action === 'dead') {
        continue;
      }
      const offsetX = replayFrame.x - enemy.x;
      const offsetY = replayFrame.y - enemy.y;
      const distance = Math.hypot(offsetX, offsetY);
      if (distance === 0) {
        continue;
      }
      const directionX = offsetX / distance;
      const directionY = offsetY / distance;
      const radius =
        enemy.kind === 'swordsman' ? SWORDSMAN_RADIUS : ARCHER_RADIUS;
      this.graphics.lineStyle(2, ULTIMATE_REPLAY_COLOR, 0.38);
      this.graphics.lineBetween(
        enemy.x + directionX * radius,
        enemy.y + directionY * radius,
        enemy.x + directionX * (radius + 34),
        enemy.y + directionY * (radius + 34),
      );
    }

    this.graphics.fillStyle(ULTIMATE_REPLAY_COLOR, 0.35);
    this.graphics.fillCircle(
      replayFrame.x,
      replayFrame.y,
      PLAYER_RADIUS + 7,
    );
    this.graphics.fillStyle(ULTIMATE_REPLAY_COLOR, 0.9);
    this.graphics.fillCircle(
      replayFrame.x,
      replayFrame.y,
      PLAYER_RADIUS,
    );
    this.graphics.lineStyle(3, AIM_COLOR, 0.8);
    this.graphics.lineBetween(
      replayFrame.x,
      replayFrame.y,
      replayFrame.x + replayFrame.aimX * (PLAYER_RADIUS + 28),
      replayFrame.y + replayFrame.aimY * (PLAYER_RADIUS + 28),
    );

    for (const projectile of replayFrame.projectiles) {
      this.renderRecordedProjectile(projectile, 0.9);
    }

    if (replayFrame.rangedAttackFired === 'bow') {
      this.graphics.lineStyle(6, ARROW_COLOR, 0.9);
      this.graphics.lineBetween(
        replayFrame.x,
        replayFrame.y,
        replayFrame.x + replayFrame.aimX * 64,
        replayFrame.y + replayFrame.aimY * 64,
      );
    } else if (replayFrame.rangedAttackFired === 'magic') {
      this.graphics.fillStyle(MAGIC_COLOR, 0.7);
      this.graphics.fillCircle(
        replayFrame.x + replayFrame.aimX * (PLAYER_RADIUS + 18),
        replayFrame.y + replayFrame.aimY * (PLAYER_RADIUS + 18),
        MAGIC_PROJECTILE_RADIUS,
      );
    }

    if (!replayFrame.longswordActive) {
      return;
    }

    const reach = getTerrainRayDistance(
      replayFrame.x,
      replayFrame.y,
      replayFrame.longswordAimX,
      replayFrame.longswordAimY,
      LONGSWORD_REACH,
      LONGSWORD_BLADE_RADIUS,
    );
    this.graphics.lineStyle(7, ULTIMATE_REPLAY_COLOR, 0.9);
    this.graphics.lineBetween(
      replayFrame.x,
      replayFrame.y,
      replayFrame.x + replayFrame.longswordAimX * reach,
      replayFrame.y + replayFrame.longswordAimY * reach,
    );
  }

  private renderPlayer(player: PlayerState, alpha: number): void {
    const color =
      player.hitFlashFramesRemaining > 0 ? PLAYER_HIT_COLOR : PLAYER_COLOR;
    const sideX = -player.aimY;
    const sideY = player.aimX;

    this.renderActorShadow(player.x, player.y, PLAYER_RADIUS);
    this.graphics.fillStyle(VISUAL_PALETTE.ink, 0.96 * alpha);
    this.graphics.fillCircle(player.x, player.y, PLAYER_RADIUS + 4);
    this.graphics.lineStyle(3, VISUAL_PALETTE.playerLight, 0.82 * alpha);
    this.graphics.strokeCircle(player.x, player.y, PLAYER_RADIUS + 2);

    this.graphics.fillStyle(color, alpha);
    this.graphics.beginPath();
    this.graphics.moveTo(
      player.x + player.aimX * (PLAYER_RADIUS + 3),
      player.y + player.aimY * (PLAYER_RADIUS + 3),
    );
    this.graphics.lineTo(
      player.x + sideX * 13 - player.aimX * 6,
      player.y + sideY * 13 - player.aimY * 6,
    );
    this.graphics.lineTo(
      player.x - player.aimX * 15,
      player.y - player.aimY * 15,
    );
    this.graphics.lineTo(
      player.x - sideX * 13 - player.aimX * 6,
      player.y - sideY * 13 - player.aimY * 6,
    );
    this.graphics.closePath();
    this.graphics.fillPath();

    this.graphics.fillStyle(VISUAL_PALETTE.playerCore, 0.96 * alpha);
    this.graphics.fillCircle(
      player.x + player.aimX * 5,
      player.y + player.aimY * 5,
      6,
    );
    this.graphics.lineStyle(2, VISUAL_PALETTE.ink, 0.72 * alpha);
    this.graphics.lineBetween(
      player.x + sideX * 9 - player.aimX * 6,
      player.y + sideY * 9 - player.aimY * 6,
      player.x - sideX * 9 - player.aimX * 6,
      player.y - sideY * 9 - player.aimY * 6,
    );

    if (player.invulnerabilityFramesRemaining > 0) {
      const invulnerabilityAlpha = this.state.frame % 6 < 3 ? 0.95 : 0.32;
      this.graphics.lineStyle(
        3,
        PLAYER_INVULNERABLE_COLOR,
        invulnerabilityAlpha,
      );
      this.graphics.strokeCircle(player.x, player.y, PLAYER_RADIUS + 8);
    }
  }

  private renderActorShadow(x: number, y: number, radius: number): void {
    this.graphics.fillStyle(VISUAL_PALETTE.ink, 0.48);
    this.graphics.fillEllipse(
      x,
      y + VISUAL_METRICS.actorShadowOffsetY,
      radius * 2.35,
      radius * 2.35 * VISUAL_METRICS.actorShadowScaleY,
    );
  }

  private renderEnemy(enemy: EnemyState): void {
    switch (enemy.kind) {
      case 'swordsman':
        this.renderSwordsman(enemy);
        return;
      case 'archer':
        this.renderArcher(enemy);
        return;
    }
  }

  private renderSwordsman(swordsman: SwordsmanState): void {
    if (swordsman.action === 'dead') {
      this.renderRespawn(
        swordsman,
        SWORDSMAN_RADIUS,
        SWORDSMAN_RESPAWN_FRAMES,
        SWORDSMAN_COLOR,
      );
      return;
    }

    this.renderActorShadow(swordsman.x, swordsman.y, SWORDSMAN_RADIUS);
    const attackReach = getSwordsmanAttackReach(swordsman);
    const attackEndX = swordsman.x + swordsman.aimX * attackReach;
    const attackEndY = swordsman.y + swordsman.aimY * attackReach;
    if (swordsman.action === 'windup') {
      this.graphics.lineStyle(8, SWORDSMAN_WINDUP_COLOR, 0.28);
      this.graphics.lineBetween(
        swordsman.x,
        swordsman.y,
        attackEndX,
        attackEndY,
      );
    } else if (swordsman.action === 'attacking') {
      this.graphics.lineStyle(10, SWORDSMAN_ATTACK_COLOR, 0.9);
      this.graphics.lineBetween(
        swordsman.x,
        swordsman.y,
        attackEndX,
        attackEndY,
      );
    }

    const bodyColor =
      swordsman.hitFlashFramesRemaining > 0
        ? SWORDSMAN_HIT_COLOR
        : SWORDSMAN_COLOR;
    const sideX = -swordsman.aimY;
    const sideY = swordsman.aimX;

    this.graphics.fillStyle(VISUAL_PALETTE.ink, 0.98);
    this.graphics.fillCircle(
      swordsman.x,
      swordsman.y,
      SWORDSMAN_RADIUS + 4,
    );
    this.graphics.fillStyle(bodyColor, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(
      swordsman.x + swordsman.aimX * (SWORDSMAN_RADIUS + 2),
      swordsman.y + swordsman.aimY * (SWORDSMAN_RADIUS + 2),
    );
    this.graphics.lineTo(
      swordsman.x + sideX * 17 - swordsman.aimX * 4,
      swordsman.y + sideY * 17 - swordsman.aimY * 4,
    );
    this.graphics.lineTo(
      swordsman.x - swordsman.aimX * 18,
      swordsman.y - swordsman.aimY * 18,
    );
    this.graphics.lineTo(
      swordsman.x - sideX * 17 - swordsman.aimX * 4,
      swordsman.y - sideY * 17 - swordsman.aimY * 4,
    );
    this.graphics.closePath();
    this.graphics.fillPath();

    this.graphics.fillStyle(VISUAL_PALETTE.softInk, 1);
    this.graphics.fillCircle(
      swordsman.x + swordsman.aimX * 5,
      swordsman.y + swordsman.aimY * 5,
      9,
    );
    this.graphics.lineStyle(3, SWORDSMAN_WINDUP_COLOR, 0.95);
    this.graphics.lineBetween(
      swordsman.x + sideX * 7,
      swordsman.y + sideY * 7,
      swordsman.x - sideX * 7,
      swordsman.y - sideY * 7,
    );
    this.graphics.lineStyle(5, VISUAL_PALETTE.text, 0.9);
    this.graphics.lineBetween(
      swordsman.x + sideX * 11 + swordsman.aimX * 3,
      swordsman.y + sideY * 11 + swordsman.aimY * 3,
      swordsman.x + sideX * 11 + swordsman.aimX * 29,
      swordsman.y + sideY * 11 + swordsman.aimY * 29,
    );
    this.graphics.lineStyle(3, SWORDSMAN_COLOR, 0.95);
    this.graphics.lineBetween(
      swordsman.x + sideX * 5 + swordsman.aimX * 10,
      swordsman.y + sideY * 5 + swordsman.aimY * 10,
      swordsman.x + sideX * 17 + swordsman.aimX * 10,
      swordsman.y + sideY * 17 + swordsman.aimY * 10,
    );

    this.renderEnemyHealthBar(swordsman, SWORDSMAN_RADIUS, SWORDSMAN_COLOR);
  }

  private renderArcher(archer: ArcherState): void {
    if (archer.action === 'dead') {
      this.renderRespawn(
        archer,
        ARCHER_RADIUS,
        ARCHER_RESPAWN_FRAMES,
        ARCHER_COLOR,
      );
      return;
    }

    this.renderActorShadow(archer.x, archer.y, ARCHER_RADIUS);
    if (archer.action === 'windup') {
      this.renderArcherTelegraph(archer);
    }

    const bodyColor =
      archer.hitFlashFramesRemaining > 0 ? ARCHER_HIT_COLOR : ARCHER_COLOR;
    const perpendicularX = -archer.aimY;
    const perpendicularY = archer.aimX;

    this.graphics.fillStyle(VISUAL_PALETTE.ink, 0.98);
    this.graphics.fillCircle(archer.x, archer.y, ARCHER_RADIUS + 4);
    this.graphics.fillStyle(bodyColor, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(
      archer.x + archer.aimX * (ARCHER_RADIUS + 3),
      archer.y + archer.aimY * (ARCHER_RADIUS + 3),
    );
    this.graphics.lineTo(
      archer.x + perpendicularX * 15 - archer.aimX * 7,
      archer.y + perpendicularY * 15 - archer.aimY * 7,
    );
    this.graphics.lineTo(
      archer.x - archer.aimX * 17,
      archer.y - archer.aimY * 17,
    );
    this.graphics.lineTo(
      archer.x - perpendicularX * 15 - archer.aimX * 7,
      archer.y - perpendicularY * 15 - archer.aimY * 7,
    );
    this.graphics.closePath();
    this.graphics.fillPath();
    this.graphics.fillStyle(VISUAL_PALETTE.softInk, 1);
    this.graphics.fillCircle(
      archer.x + archer.aimX * 4,
      archer.y + archer.aimY * 4,
      7,
    );

    const aimAngle = Math.atan2(archer.aimY, archer.aimX);
    const bowCenterX = archer.x + archer.aimX * 13;
    const bowCenterY = archer.y + archer.aimY * 13;
    const bowEndOffset = 15;
    this.graphics.lineStyle(3, ARCHER_TELEGRAPH_COLOR, 1);
    this.graphics.beginPath();
    this.graphics.arc(
      bowCenterX,
      bowCenterY,
      17,
      aimAngle - Math.PI / 2,
      aimAngle + Math.PI / 2,
      false,
    );
    this.graphics.strokePath();
    this.graphics.lineBetween(
      bowCenterX + perpendicularX * bowEndOffset,
      bowCenterY + perpendicularY * bowEndOffset,
      bowCenterX - perpendicularX * bowEndOffset,
      bowCenterY - perpendicularY * bowEndOffset,
    );
    this.graphics.lineStyle(2, VISUAL_PALETTE.text, 0.9);
    this.graphics.lineBetween(
      archer.x - archer.aimX * 7,
      archer.y - archer.aimY * 7,
      archer.x + archer.aimX * (ARCHER_RADIUS + 16),
      archer.y + archer.aimY * (ARCHER_RADIUS + 16),
    );
    this.renderEnemyHealthBar(archer, ARCHER_RADIUS, ARCHER_COLOR);
  }

  private renderArcherTelegraph(archer: ArcherState): void {
    const distance = getTerrainRayDistance(
      archer.x,
      archer.y,
      archer.aimX,
      archer.aimY,
      Math.hypot(ARENA_WIDTH, ARENA_HEIGHT),
      BOW_PROJECTILE_RADIUS,
    );
    const progress =
      1 - archer.actionFramesRemaining / ARCHER_WINDUP_FRAMES;
    const alpha = 0.12 + progress * 0.28;

    this.graphics.lineStyle(2, ARCHER_TELEGRAPH_COLOR, alpha);
    this.graphics.lineBetween(
      archer.x,
      archer.y,
      archer.x + archer.aimX * distance,
      archer.y + archer.aimY * distance,
    );

    for (let offset = 54; offset < distance; offset += 54) {
      const x = archer.x + archer.aimX * offset;
      const y = archer.y + archer.aimY * offset;
      this.graphics.lineStyle(3, ARCHER_TELEGRAPH_COLOR, alpha);
      this.graphics.lineBetween(
        x - archer.aimX * 10,
        y - archer.aimY * 10,
        x + archer.aimX * 5,
        y + archer.aimY * 5,
      );
    }
  }

  private renderEnemyHealthBar(
    enemy: EnemyState,
    radius: number,
    color: number,
  ): void {
    const barWidth = 64;
    const barHeight = 6;
    const barX = enemy.x - barWidth / 2;
    const barY = enemy.y - radius - 14;
    const healthRatio = enemy.health.current / enemy.health.maximum;
    this.graphics.fillStyle(VISUAL_PALETTE.ink, 0.82);
    this.graphics.fillRoundedRect(
      barX - 2,
      barY - 2,
      barWidth + 4,
      barHeight + 4,
      3,
    );
    this.graphics.fillStyle(RESOURCE_BACKGROUND_COLOR, 0.96);
    this.graphics.fillRoundedRect(barX, barY, barWidth, barHeight, 2);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRoundedRect(
      barX + 1,
      barY + 1,
      Math.max(2, (barWidth - 2) * healthRatio),
      barHeight - 2,
      1,
    );
  }

  private renderRespawn(
    enemy: EnemyState,
    radius: number,
    respawnFrames: number,
    color: number,
  ): void {
    const respawnRatio = enemy.actionFramesRemaining / respawnFrames;
    this.graphics.lineStyle(3, color, 0.3);
    this.graphics.strokeCircle(enemy.x, enemy.y, radius * respawnRatio);
  }

  private renderResourceBar(
    x: number,
    y: number,
    resource: ResourceState,
    color: number,
    borderColor = 0xffffff,
  ): void {
    const ratio = resource.current / resource.maximum;

    this.graphics.fillStyle(VISUAL_PALETTE.ink, 0.72);
    this.graphics.fillRoundedRect(
      x - 4,
      y - 4,
      RESOURCE_BAR_WIDTH + 8,
      RESOURCE_BAR_HEIGHT + 8,
      5,
    );
    this.graphics.fillStyle(RESOURCE_BACKGROUND_COLOR, 0.96);
    this.graphics.fillRoundedRect(
      x,
      y,
      RESOURCE_BAR_WIDTH,
      RESOURCE_BAR_HEIGHT,
      3,
    );
    if (ratio > 0) {
      this.graphics.fillStyle(color, 1);
      this.graphics.fillRoundedRect(
        x + 2,
        y + 2,
        Math.max(3, (RESOURCE_BAR_WIDTH - 4) * ratio),
        RESOURCE_BAR_HEIGHT - 4,
        2,
      );
    }
    this.graphics.lineStyle(
      borderColor === 0xffffff ? 1 : 2,
      borderColor === 0xffffff ? VISUAL_PALETTE.wallEdge : borderColor,
      0.86,
    );
    this.graphics.strokeRoundedRect(
      x,
      y,
      RESOURCE_BAR_WIDTH,
      RESOURCE_BAR_HEIGHT,
      3,
    );

    this.graphics.lineStyle(1, VISUAL_PALETTE.ink, 0.58);
    for (let segment = 1; segment < 5; segment += 1) {
      const segmentX = x + RESOURCE_BAR_WIDTH * segment / 5;
      this.graphics.lineBetween(
        segmentX,
        y + 2,
        segmentX,
        y + RESOURCE_BAR_HEIGHT - 2,
      );
    }
  }

  private renderProjectile(projectile: ProjectileState): void {
    const kind = projectile.kind;

    switch (kind) {
      case 'arrow': {
        const speed = Math.hypot(
          projectile.velocityX,
          projectile.velocityY,
        );
        const directionX = projectile.velocityX / speed;
        const directionY = projectile.velocityY / speed;

        const arrowColor =
          projectile.owner === 'player' ? ARROW_COLOR : ENEMY_ARROW_COLOR;
        this.graphics.lineStyle(8, VISUAL_PALETTE.ink, 0.55);
        this.graphics.lineBetween(
          projectile.x - directionX * 23,
          projectile.y - directionY * 23,
          projectile.x + directionX * 8,
          projectile.y + directionY * 8,
        );
        this.graphics.lineStyle(4, arrowColor, 1);
        this.graphics.lineBetween(
          projectile.x - directionX * 24,
          projectile.y - directionY * 24,
          projectile.x + directionX * 8,
          projectile.y + directionY * 8,
        );
        const sideX = -directionY;
        const sideY = directionX;
        this.graphics.lineStyle(3, arrowColor, 0.95);
        this.graphics.lineBetween(
          projectile.x + directionX * 8,
          projectile.y + directionY * 8,
          projectile.x - directionX * 1 + sideX * 6,
          projectile.y - directionY * 1 + sideY * 6,
        );
        this.graphics.lineBetween(
          projectile.x + directionX * 8,
          projectile.y + directionY * 8,
          projectile.x - directionX * 1 - sideX * 6,
          projectile.y - directionY * 1 - sideY * 6,
        );
        return;
      }
      case 'magic':
        this.graphics.fillStyle(VISUAL_PALETTE.ink, 0.52);
        this.graphics.fillCircle(
          projectile.x,
          projectile.y,
          MAGIC_PROJECTILE_RADIUS + 9,
        );
        this.graphics.fillStyle(MAGIC_COLOR, 0.22);
        this.graphics.fillCircle(
          projectile.x,
          projectile.y,
          MAGIC_PROJECTILE_RADIUS + 7,
        );
        this.graphics.fillStyle(MAGIC_COLOR, 0.94);
        this.graphics.fillCircle(
          projectile.x,
          projectile.y,
          MAGIC_PROJECTILE_RADIUS,
        );
        this.graphics.fillStyle(VISUAL_PALETTE.text, 0.9);
        this.graphics.fillCircle(
          projectile.x - 2,
          projectile.y - 2,
          3,
        );
        this.graphics.lineStyle(2, MAGIC_COLOR, 0.72);
        this.graphics.beginPath();
        this.graphics.arc(
          projectile.x,
          projectile.y,
          MAGIC_PROJECTILE_RADIUS + 11,
          this.state.frame * 0.08 + projectile.id,
          this.state.frame * 0.08 + projectile.id + Math.PI * 1.2,
        );
        this.graphics.strokePath();
        return;
    }

    const exhaustiveKind: never = kind;
    void exhaustiveKind;
  }

  private renderRecordedProjectile(
    projectile: UltimateRecordedProjectile,
    alpha: number,
  ): void {
    switch (projectile.kind) {
      case 'arrow': {
        const speed = Math.hypot(
          projectile.velocityX,
          projectile.velocityY,
        );
        const directionX = projectile.velocityX / speed;
        const directionY = projectile.velocityY / speed;
        this.graphics.lineStyle(4, ARROW_COLOR, alpha);
        this.graphics.lineBetween(
          projectile.x - directionX * 18,
          projectile.y - directionY * 18,
          projectile.x + directionX * 6,
          projectile.y + directionY * 6,
        );
        this.graphics.fillStyle(ARROW_COLOR, alpha);
        this.graphics.fillCircle(
          projectile.x,
          projectile.y,
          BOW_PROJECTILE_RADIUS,
        );
        return;
      }
      case 'magic':
        this.graphics.fillStyle(MAGIC_COLOR, alpha * 0.35);
        this.graphics.fillCircle(
          projectile.x,
          projectile.y,
          MAGIC_PROJECTILE_RADIUS + 5,
        );
        this.graphics.fillStyle(MAGIC_COLOR, alpha);
        this.graphics.fillCircle(
          projectile.x,
          projectile.y,
          MAGIC_PROJECTILE_RADIUS,
        );
        return;
    }
  }
}

function formatUltimatePhase(
  phase: UltimatePhase,
  framesRemaining: number,
): string {
  switch (phase) {
    case 'inactive':
      return 'normal';
    case 'recording':
      return `STOP ${(framesRemaining * FIXED_STEP_SECONDS).toFixed(1)}s`;
    case 'replaying':
      return `ECHO ${(framesRemaining * FIXED_STEP_SECONDS).toFixed(1)}s`;
  }
}
