import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { EnemySprite } from '../objects/EnemySprite';
import type { IAttackInstance } from '../interfaces/IAttackInstance';
import { BehaviorState } from '../interfaces/IBehavior';
import { EntityDebugDisplay } from './EntityDebugDisplay';

export class EnemyDebugDisplay extends EntityDebugDisplay<EnemySprite> {
    constructor(scene: GameScene) {
        super(scene);
    }

    protected getEntityInfoLines(enemy: EnemySprite): string[] {
        const lines: string[] = [];
        lines.push(`ID: ${enemy.entityId.substring(0, 8)}`);
        lines.push(`Type: ${enemy.enemyType}`);
        lines.push(`Pos: ${enemy.x.toFixed(1)}, ${enemy.y.toFixed(1)}`);
        lines.push(`HP: ${enemy.currentStats.hp.toFixed(0)}/${enemy.currentStats.maxHp.toFixed(0)}`);
        lines.push(`Speed: ${enemy.currentStats.maxSpeed.toFixed(1)}`);
        lines.push(`Defense: ${enemy.currentStats.defense.toFixed(1)}`);

        // Behavior State
        const currentStateId = enemy.behaviorStateMachine?.currentState?.id;
        const behaviorStateName = currentStateId !== undefined ? BehaviorState[currentStateId] : 'N/A';
        lines.push(`Behavior: ${behaviorStateName}`);
        if (enemy.isFleeing) {
            lines.push(`(FLEEING!)`);
        }

        // Target Player Info (if target exists)
        if (enemy.targetPlayer) {
            const distToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, enemy.targetPlayer.x, enemy.targetPlayer.y);
            lines.push(`Target: Player (Dist: ${distToPlayer.toFixed(1)})`);
        } else {
            lines.push(`Target: None`);
        }

        lines.push('--- Stats (Current) ---');
        lines.push(`  DMG Mod: ${enemy.currentStats.damageModifier?.toFixed(2)}`);
        lines.push(`  Atk Cool Mod: ${enemy.currentStats.attackCooldownModifier?.toFixed(2)}`);
        lines.push(`  Proj Speed Mod: ${enemy.currentStats.projectileSpeedModifier?.toFixed(2)}`);
        lines.push(`  Proj Size Mod: ${enemy.currentStats.projectileSizeModifier?.toFixed(2)}`);
        lines.push(`  Melee DMG: ${enemy.currentStats.meleeDamage?.toFixed(1)}`);
        lines.push(`  Proj DMG: ${enemy.currentStats.projectileDamage?.toFixed(1)}`);
        lines.push(`  Proj Speed: ${enemy.currentStats.projectileSpeed?.toFixed(1)}`);

        lines.push('--- Base Stats ---');
        lines.push(`  MaxHP: ${enemy.baseStats.maxHp.toFixed(0)}`);
        lines.push(`  MaxSpeed: ${enemy.baseStats.maxSpeed.toFixed(1)}`);
        lines.push(`  XP Val: ${enemy.baseStats.xpValue}`);

        lines.push('--- Active Attacks ---');
        if (enemy.activeAttacks.length > 0) {
            enemy.activeAttacks.forEach((attackInstance: IAttackInstance, index: number) => {
                const def = attackInstance.definition;
                const cooldownTime = this.scene.time.now - (attackInstance.lastFiredTimestamp || 0);
                const actualCooldown = (def.attackCooldown * (enemy.currentStats.attackCooldownModifier ?? 1.0));
                const cdProgress = Math.min(1, cooldownTime / actualCooldown);
                const cdBar = '[' + '#'.repeat(Math.floor(cdProgress * 10)).padEnd(10, '-') + ']';

                lines.push(`  [${index + 1}] ${def.name} (ID: ${def.id})`);
                lines.push(`    Type: ${def.type}, Range: ${def.range}`);
                lines.push(`    DMG: ${def.damage}, Cooldown: ${(actualCooldown / 1000).toFixed(1)}s ${cdBar}`);
                if (def.projectileType) {
                    lines.push(`    Projectile: ${def.projectileType}`);
                }
                if (def.projectilesPerShot && def.projectilesPerShot > 1) {
                    lines.push(`    Proj/Shot: ${def.projectilesPerShot}, Spread: ${def.spreadAngle}°`);
                }
            });
        } else {
            lines.push('  (None)');
        }
        // Sight and Attack Ranges
        lines.push('--- Ranges ---');
        lines.push(`  Sight: ${enemy.sightRange}`);
        lines.push(`  Melee Atk: ${enemy.meleeAttackRange}`);
        if (enemy.isRanged && enemy.rangedAttackRange) {
            lines.push(`  Ranged Atk: ${enemy.rangedAttackRange}`);
        }

        return lines;
    }
} 