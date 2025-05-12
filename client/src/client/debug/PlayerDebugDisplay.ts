import Phaser from 'phaser';
import type { GameScene } from '../scenes/GameScene';
import type { PlayerSprite } from '../objects/PlayerSprite';
import type { IAttackInstance } from '../interfaces/IAttackInstance';
import { EntityDebugDisplay } from './EntityDebugDisplay';

export class PlayerDebugDisplay extends EntityDebugDisplay<PlayerSprite> {
    constructor(scene: GameScene) {
        super(scene);
        this.TEXT_STYLE.color = '#00ffff'; // Different color for player debug display
    }

    protected getEntityInfoLines(player: PlayerSprite): string[] {
        const lines: string[] = [];
        lines.push(`ID: ${player.entityId.substring(0, 8)}`);
        lines.push(`Player ID: ${player.playerId}`);
        lines.push(`Pos: ${player.x.toFixed(1)}, ${player.y.toFixed(1)}`);
        lines.push(`HP: ${player.currentStats.hp.toFixed(0)}/${player.currentStats.maxHp.toFixed(0)}`);
        lines.push(`Speed: ${player.currentStats.maxSpeed.toFixed(1)}`);
        lines.push(`Defense: ${player.currentStats.defense.toFixed(1)}`);

        lines.push('--- Stats (Current) ---');
        lines.push(`  DMG Mod: ${player.currentStats.damageModifier?.toFixed(2)}`);
        lines.push(`  Atk Cool Mod: ${player.currentStats.attackCooldownModifier?.toFixed(2)}`);
        lines.push(`  Proj Speed Mod: ${player.currentStats.projectileSpeedModifier?.toFixed(2)}`);
        lines.push(`  Proj Size Mod: ${player.currentStats.projectileSizeModifier?.toFixed(2)}`);
        lines.push(`  XP Gain Mod: ${player.currentStats.xpGainModifier?.toFixed(2)}`);
        lines.push(`  Luck: ${player.currentStats.luck?.toFixed(2)}`);
        lines.push(`  Crit Chance: ${player.currentStats.baseCriticalHitChance?.toFixed(2)}`);
        lines.push(`  Crit DMG Mult: ${player.currentStats.criticalHitDamageMultiplier?.toFixed(2)}`);

        lines.push('--- Active Attacks ---');
        if (player.activeAttacks.length > 0) {
            player.activeAttacks.forEach((attackInstance: IAttackInstance, index: number) => {
                const def = attackInstance.definition;
                const cooldownTime = this.scene.time.now - (attackInstance.lastFiredTimestamp || 0);
                const actualCooldown = (def.attackCooldown * (player.currentStats.attackCooldownModifier ?? 1.0));
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

        // Status effects
        if (player.activeStatusEffects.size > 0) {
            lines.push('--- Status Effects ---');
            let count = 0;
            player.activeStatusEffects.forEach((effect, id) => {
                if (count < 5) { // Limit display to 5 effects for space
                    const duration = effect.duration ? `(${Math.ceil((effect.appliedAt! + effect.duration - this.scene.time.now) / 1000)}s)` : '(∞)';
                    lines.push(`  ${effect.name} ${duration}`);
                    count++;
                } else if (count === 5) {
                    const remaining = player.activeStatusEffects.size - 5;
                    if (remaining > 0) {
                        lines.push(`  ... and ${remaining} more`);
                    }
                    count++;
                }
            });
        }

        return lines;
    }
} 