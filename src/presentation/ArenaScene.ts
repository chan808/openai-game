import Phaser from 'phaser';

import { GameClock } from '../core/GameClock';
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
  SLOW_WORLD_TIME_SCALE,
  SWORDSMAN_RADIUS,
  SWORDSMAN_RESPAWN_FRAMES,
} from '../content/tuning';
import {
  createInitialGameState,
  type ArcherState,
  type EnemyState,
  type ProjectileState,
  type ResourceState,
  type SwordsmanState,
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
import {
  PhaserInputSource,
  WEAPON_SLOT_HINT,
} from './PhaserInputSource';
import { SkillBindings } from './SkillBindings';
import { SkillLoadoutUi } from './SkillLoadoutUi';

const PLAYER_COLOR = 0x4f7cff;
const PLAYER_HIT_COLOR = 0xff5f65;
const PLAYER_INVULNERABLE_COLOR = 0xffa3a8;
const SWORDSMAN_COLOR = 0xd65f5f;
const SWORDSMAN_HIT_COLOR = 0xffffff;
const SWORDSMAN_WINDUP_COLOR = 0xff9b73;
const SWORDSMAN_ATTACK_COLOR = 0xff4f4f;
const ARCHER_COLOR = 0xe0a44f;
const ARCHER_HIT_COLOR = 0xffffff;
const ARCHER_TELEGRAPH_COLOR = 0xffc46b;
const ENEMY_ARROW_COLOR = 0xff806b;
const AIM_COLOR = 0xdde6ff;
const LONGSWORD_COLOR = 0x8ec5ff;
const ARROW_COLOR = 0xffd166;
const MAGIC_COLOR = 0x75f4c1;
const ARENA_BORDER_COLOR = 0x34405a;
const WALL_COLOR = 0x252d40;
const WALL_EDGE_COLOR = 0x4e5b78;
const PILLAR_COLOR = 0x30394f;
const SLOW_COLOR = 0x8a9dff;
const TELEPORT_READY_COLOR = 0xb8c4ff;
const TELEPORT_COOLDOWN_COLOR = 0x59627f;
const RESOURCE_BACKGROUND_COLOR = 0x151a26;
const HEALTH_COLOR = 0x65d17a;
const MANA_COLOR = 0x598cff;
const RESOURCE_BAR_WIDTH = 180;
const RESOURCE_BAR_HEIGHT = 12;

export class ArenaScene extends Phaser.Scene {
  private readonly clock = new GameClock();
  private readonly state = createInitialGameState();
  private graphics!: Phaser.GameObjects.Graphics;
  private statusText!: Phaser.GameObjects.Text;
  private inputSource!: PhaserInputSource;
  private skillLoadoutUi!: SkillLoadoutUi;
  private readonly skillBindings = new SkillBindings();
  private lastPlayerHitCount = 0;

  constructor() {
    super('arena');
  }

  create(): void {
    this.graphics = this.add.graphics();
    this.statusText = this.add.text(16, 58, '', {
      color: '#ffffff',
      fontFamily: 'monospace',
      fontSize: '18px',
    });
    this.inputSource = new PhaserInputSource(this, this.skillBindings);
    this.skillLoadoutUi = new SkillLoadoutUi(
      this,
      this.skillBindings,
      this.inputSource,
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.skillLoadoutUi.destroy();
      this.inputSource.destroy();
    });

    this.renderState();
  }

  update(_time: number, delta: number): void {
    this.clock.advance(delta, (step) => {
      updateGame(this.state, this.inputSource, step);
    });
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
      slow,
      teleport,
    } = this.state;

    this.graphics.clear();
    if (slow.active) {
      this.graphics.fillStyle(SLOW_COLOR, 0.1);
      this.graphics.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
    }
    this.renderTerrain(slow.active);

    const teleportReady = teleport.cooldownFramesRemaining === 0;
    const teleportColor = teleportReady
      ? TELEPORT_READY_COLOR
      : TELEPORT_COOLDOWN_COLOR;
    this.graphics.lineStyle(1, teleportColor, 0.28);
    this.graphics.lineBetween(
      player.x,
      player.y,
      teleport.destinationX,
      teleport.destinationY,
    );
    this.graphics.fillStyle(teleportColor, teleportReady ? 0.14 : 0.05);
    this.graphics.fillCircle(
      teleport.destinationX,
      teleport.destinationY,
      PLAYER_RADIUS,
    );
    this.graphics.lineStyle(2, teleportColor, 0.75);
    this.graphics.strokeCircle(
      teleport.destinationX,
      teleport.destinationY,
      PLAYER_RADIUS,
    );

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
      this.renderProjectile(projectile);
    }

    for (const enemy of enemies) {
      this.renderEnemy(enemy);
    }

    this.graphics.fillStyle(
      player.hitFlashFramesRemaining > 0 ? PLAYER_HIT_COLOR : PLAYER_COLOR,
      1,
    );
    this.graphics.fillCircle(player.x, player.y, PLAYER_RADIUS);
    if (player.invulnerabilityFramesRemaining > 0) {
      const alpha = this.state.frame % 6 < 3 ? 0.9 : 0.35;
      this.graphics.lineStyle(2, PLAYER_INVULNERABLE_COLOR, alpha);
      this.graphics.strokeCircle(player.x, player.y, PLAYER_RADIUS + 4);
    }

    const displayedAim =
      longswordAttack.activeFramesRemaining > 0
        ? longswordAttack
        : player;
    this.graphics.lineStyle(3, AIM_COLOR, 1);
    this.graphics.lineBetween(
      player.x,
      player.y,
      player.x + displayedAim.aimX * (PLAYER_RADIUS + 28),
      player.y + displayedAim.aimY * (PLAYER_RADIUS + 28),
    );

    this.renderResourceBar(
      16,
      16,
      player.health,
      HEALTH_COLOR,
      player.hitFlashFramesRemaining > 0 ? PLAYER_HIT_COLOR : 0xffffff,
    );
    this.renderResourceBar(16, 36, player.mana, MANA_COLOR);

    const enemyStatus = enemies
      .map(
        (enemy) =>
          `${enemy.kind}: ${enemy.action} ${Math.ceil(enemy.health.current)}/${enemy.health.maximum}`,
      )
      .join('\n');
    this.statusText.setText(
      `HP ${formatResource(player.health)} | MP ${formatResource(player.mana)}\n` +
      `weapon: ${selectedWeapon}\n${WEAPON_SLOT_HINT}\n` +
        `formation: ${this.state.formation.phase}\n` +
        `time: ${slow.active ? `SLOW x${SLOW_WORLD_TIME_SCALE}` : 'normal'}\n` +
        `${enemyStatus}\n` +
        `defeats: ${player.defeatCount}`,
    );
    this.skillLoadoutUi.render(
      slow.active,
      teleport.cooldownFramesRemaining,
    );
  }

  private renderTerrain(slowActive: boolean): void {
    this.graphics.fillStyle(WALL_COLOR, 1);
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

    this.graphics.lineStyle(
      2,
      slowActive ? SLOW_COLOR : WALL_EDGE_COLOR,
      1,
    );
    this.graphics.strokeRect(
      ARENA_WALL_THICKNESS,
      ARENA_WALL_THICKNESS,
      ARENA_WIDTH - ARENA_WALL_THICKNESS * 2,
      ARENA_HEIGHT - ARENA_WALL_THICKNESS * 2,
    );

    for (const obstacle of TERRAIN_OBSTACLES) {
      this.graphics.fillStyle(PILLAR_COLOR, 1);
      this.graphics.fillRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
      );
      this.graphics.lineStyle(
        2,
        slowActive ? SLOW_COLOR : ARENA_BORDER_COLOR,
        1,
      );
      this.graphics.strokeRect(
        obstacle.x,
        obstacle.y,
        obstacle.width,
        obstacle.height,
      );
    }
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

    this.graphics.fillStyle(
      swordsman.hitFlashFramesRemaining > 0
        ? SWORDSMAN_HIT_COLOR
        : SWORDSMAN_COLOR,
      1,
    );
    this.graphics.fillCircle(
      swordsman.x,
      swordsman.y,
      SWORDSMAN_RADIUS,
    );
    this.graphics.lineStyle(4, SWORDSMAN_WINDUP_COLOR, 1);
    this.graphics.lineBetween(
      swordsman.x,
      swordsman.y,
      swordsman.x + swordsman.aimX * (SWORDSMAN_RADIUS + 12),
      swordsman.y + swordsman.aimY * (SWORDSMAN_RADIUS + 12),
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

    if (archer.action === 'windup') {
      this.renderArcherTelegraph(archer);
    }

    this.graphics.fillStyle(
      archer.hitFlashFramesRemaining > 0 ? ARCHER_HIT_COLOR : ARCHER_COLOR,
      1,
    );
    this.graphics.fillCircle(archer.x, archer.y, ARCHER_RADIUS);

    const perpendicularX = -archer.aimY;
    const perpendicularY = archer.aimX;
    this.graphics.lineStyle(3, ARCHER_TELEGRAPH_COLOR, 1);
    this.graphics.lineBetween(
      archer.x + perpendicularX * 12,
      archer.y + perpendicularY * 12,
      archer.x - perpendicularX * 12,
      archer.y - perpendicularY * 12,
    );
    this.graphics.lineBetween(
      archer.x,
      archer.y,
      archer.x + archer.aimX * (ARCHER_RADIUS + 14),
      archer.y + archer.aimY * (ARCHER_RADIUS + 14),
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
    this.graphics.fillStyle(RESOURCE_BACKGROUND_COLOR, 0.9);
    this.graphics.fillRect(barX, barY, barWidth, barHeight);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRect(barX, barY, barWidth * healthRatio, barHeight);
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

    this.graphics.fillStyle(RESOURCE_BACKGROUND_COLOR, 0.9);
    this.graphics.fillRect(x, y, RESOURCE_BAR_WIDTH, RESOURCE_BAR_HEIGHT);
    this.graphics.fillStyle(color, 1);
    this.graphics.fillRect(
      x,
      y,
      RESOURCE_BAR_WIDTH * ratio,
      RESOURCE_BAR_HEIGHT,
    );
    this.graphics.lineStyle(borderColor === 0xffffff ? 1 : 2, borderColor, 0.8);
    this.graphics.strokeRect(x, y, RESOURCE_BAR_WIDTH, RESOURCE_BAR_HEIGHT);
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
        this.graphics.lineStyle(4, arrowColor, 1);
        this.graphics.lineBetween(
          projectile.x - directionX * 18,
          projectile.y - directionY * 18,
          projectile.x + directionX * 6,
          projectile.y + directionY * 6,
        );
        this.graphics.fillStyle(arrowColor, 1);
        this.graphics.fillCircle(
          projectile.x,
          projectile.y,
          BOW_PROJECTILE_RADIUS,
        );
        return;
      }
      case 'magic':
        this.graphics.fillStyle(MAGIC_COLOR, 0.35);
        this.graphics.fillCircle(
          projectile.x,
          projectile.y,
          MAGIC_PROJECTILE_RADIUS + 5,
        );
        this.graphics.fillStyle(MAGIC_COLOR, 1);
        this.graphics.fillCircle(
          projectile.x,
          projectile.y,
          MAGIC_PROJECTILE_RADIUS,
        );
        return;
    }

    const exhaustiveKind: never = kind;
    void exhaustiveKind;
  }
}

function formatResource(resource: ResourceState): string {
  return `${Math.ceil(resource.current)}/${resource.maximum}`;
}
