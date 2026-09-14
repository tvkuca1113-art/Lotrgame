import Phaser from 'phaser';
import type { ResourceBundle } from '@/types';
import { t } from '@/content/locale';
import { stageById } from '@/content/stages';
import { getState } from '@/systems/state';
import { Button, HEX, FONT_BODY, FONT_TITLE, Panel, formatTime, PALETTE } from '@/ui/kit';
import { RESIDENTS } from '@/content/buildings';
import type { CompletionResult } from '@/systems/campaign';
import { campaignComplete } from '@/systems/campaign';
import { levelProgress } from '@/systems/progression';
import { play } from '@/audio/library';
import { phase } from '@/systems/gamestate';
import { music } from '@/audio/music';

/** The stage-complete summary: what was earned, and what it unlocked. */
export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  create(data: { stage: number; result: CompletionResult; explore: ResourceBundle; elapsedMs: number; bossDefeated: boolean }): void {
    phase.set('STAGE_COMPLETE');
    const state = getState();
    const def = stageById(data.stage)!;
    const cam = this.cameras.main;
    this.cameras.main.setBackgroundColor(PALETTE.charcoal);
    music.play('home');
    play('stage_clear');

    const w = Math.min(560, cam.width - 40);
    const panel = new Panel(this, (cam.width - w) / 2, 70, w, Math.min(cam.height - 180, 460), 'parchment');
    const lines: { text: string; colour: string; size?: number }[] = [];
    lines.push({ text: t('hud.stage_clear'), colour: HEX.gold, size: 26 });
    lines.push({ text: `${t('common.stage')} ${data.stage} — ${t(def.nameKey)}`, colour: HEX.parchment, size: 17 });
    lines.push({ text: `${t('common.time')}: ${formatTime(data.elapsedMs)}`, colour: HEX.muted });

    const gained = mergeBundles(data.result.granted, data.explore);
    const rewardLine = (['gold', 'wood', 'stone', 'iron', 'shards'] as const)
      .filter((k) => (gained[k] ?? 0) > 0)
      .map((k) => `+${gained[k]} ${t(`resource.${k}`)}`)
      .join('    ');
    if (rewardLine) lines.push({ text: rewardLine, colour: HEX.gold });
    lines.push({ text: `+${data.result.xp} ${t('hud.xp')}`, colour: HEX.parchment });
    if (data.result.levels > 0) lines.push({ text: `${t('hud.level')} ${state.player.level}`, colour: HEX.good, size: 18 });

    if (data.result.ringDiscovered) {
      lines.push({ text: `${t('inv.rings')}: ${t(`ring.${data.result.ringDiscovered}.name`)}`, colour: HEX.gold, size: 17 });
      lines.push({ text: t(`ring.${data.result.ringDiscovered}.active`), colour: HEX.muted });
    }
    if (data.result.duplicateShards > 0) {
      lines.push({ text: t('ring.duplicate', t(`ring.${def.firstClear.ringId}.name`), data.result.duplicateShards), colour: HEX.winter });
    }
    if (data.result.slotUnlocked) {
      lines.push({ text: `${t(`ring.slot.${data.result.slotUnlocked}`)} — ${t('common.new')}`, colour: HEX.good });
    }
    if (data.result.residentRescued) {
      const r = RESIDENTS.find((x) => x.id === data.result.residentRescued);
      if (r) lines.push({ text: `${t(r.nameKey)} — ${t(r.roleKey)}`, colour: HEX.good });
    }
    if (data.result.monumentUnlocked) lines.push({ text: t('build.monument.desc'), colour: HEX.gold });
    if (data.result.seasonChanged) lines.push({ text: t('season.changed'), colour: HEX.winter });
    else lines.push({ text: t('season.advance'), colour: HEX.muted });

    const lp = levelProgress(state);
    lines.push({ text: `${t('hud.xp')} ${lp.current} / ${lp.needed}`, colour: HEX.muted });

    let y = 22;
    for (const l of lines) {
      const txt = this.add.text(20, y, l.text, {
        fontFamily: l.size && l.size > 18 ? FONT_TITLE : FONT_BODY,
        fontSize: `${l.size ?? 14}px`,
        color: l.colour,
        wordWrap: { width: w - 40 },
      });
      panel.add(txt);
      y += txt.height + 8;
    }
    panel.resize(w, Math.min(cam.height - 160, y + 24));

    const finished = campaignComplete(state) && data.stage === 30 && !state.campaign.endingChosen;
    const btn = new Button(this, cam.width / 2, Math.min(cam.height - 54, 70 + y + 58),
      finished ? t('story.ending.choice') : t('home.title'),
      () => {
        play('ui_confirm');
        if (finished) this.scene.start('Ending', {});
        else this.scene.start('Home', {});
      }, { width: 240 });
    void btn;
    this.input.keyboard?.once('keydown-ENTER', () => {
      if (finished) this.scene.start('Ending', {});
      else this.scene.start('Home', {});
    });
  }
}

function mergeBundles(a: ResourceBundle, b: ResourceBundle): ResourceBundle {
  const out: ResourceBundle = {};
  for (const k of ['gold', 'wood', 'stone', 'iron', 'shards'] as const) {
    const v = (a[k] ?? 0) + (b[k] ?? 0);
    if (v) out[k] = v;
  }
  return out;
}
