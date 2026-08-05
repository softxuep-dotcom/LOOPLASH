import type { GameRuntime } from '../game/runtime/GameRuntime';
import type { PatternDefinition, RuntimeSnapshot } from '../game/core/types';
import { PATTERN_BY_ID } from '../game/content/patterns';
import { WORLD_RULE_BY_ID } from '../game/content/worldRules';
import { SEAMS } from '../game/content/patterns';
import { i18n } from '../localization/I18n';

const SEAM_BY_ID = Object.fromEntries(SEAMS.map((seam) => [seam.id, seam]));

export class HudController {
  private readonly unsubscribe: () => void;
  private snapshot: RuntimeSnapshot | null = null;
  private lastRenderKey = '';

  constructor(
    private readonly root: HTMLElement,
    private readonly runtime: GameRuntime
  ) {
    this.root.addEventListener('click', this.handleClick);
    this.root.addEventListener('change', this.handleChange);
    this.unsubscribe = runtime.subscribe((snapshot) => this.render(snapshot));
  }

  destroy(): void {
    this.unsubscribe();
    this.root.removeEventListener('click', this.handleClick);
    this.root.removeEventListener('change', this.handleChange);
  }

  private render(snapshot: RuntimeSnapshot): void {
    this.snapshot = snapshot;
    document.body.classList.toggle('reduced-motion', snapshot.reducedMotion);
    document.body.classList.toggle('high-contrast', snapshot.highContrast);
    document.body.classList.toggle('pull-cast', snapshot.controlMode !== 'drag-anchor');
    const renderKey = JSON.stringify(snapshot);
    if (renderKey === this.lastRenderKey) return;
    this.lastRenderKey = renderKey;
    const objective = i18n.t(`objective.${snapshot.objective.id}`, { target: snapshot.objective.target });
    const patternSlots = snapshot.patternSlots.map((id, index) => {
      const pattern = id ? PATTERN_BY_ID[id] : undefined;
      return `<span class="stitch ${pattern ? `family-${pattern.family}` : 'empty'}" title="${pattern ? i18n.t(pattern.nameKey) : ''}">
        ${pattern ? pattern.glyph : index + 1}
      </span>`;
    }).join('');
    const essence = snapshot.essences.map((family) => `<span class="essence family-${family}" title="${i18n.t(`essence.${family}`)}"></span>`).join('');
    const hearts = Array.from({ length: snapshot.maxHearts }, (_, index) =>
      `<span class="heart ${index < snapshot.hearts ? 'full' : ''}">${index < snapshot.hearts ? '◆' : '◇'}</span>`).join('');
    const shields = Array.from({ length: 2 }, (_, index) =>
      `<span class="shield-pip ${index < snapshot.shield ? 'full' : ''}">${index < snapshot.shield ? '⬢' : '⬡'}</span>`).join('');
    const seams = snapshot.activeSeams.map((id) => {
      const seam = SEAM_BY_ID[id];
      return seam ? `<span class="seam-chip">${i18n.t(seam.nameKey)}</span>` : '';
    }).join('');
    const rule = snapshot.worldRules.at(-1);
    const ruleDefinition = rule ? WORLD_RULE_BY_ID[rule] : undefined;
    const hasBuild = snapshot.patternSlots.some(Boolean) || snapshot.worldRules.length > 0;
    const patternNotice = snapshot.patternNoticeId ? PATTERN_BY_ID[snapshot.patternNoticeId] : undefined;
    const capturedSlots = Array.from({ length: snapshot.projectileCapacity }, (_, index) =>
      `<span class="shot-slot ${index < snapshot.capturedShots ? 'loaded' : ''}">${index < snapshot.capturedShots ? '◆' : '◇'}</span>`
    ).join('');

    this.root.innerHTML = `
      <div class="top-hud">
        <div class="hud-cluster identity">
          <span class="logo-mark">⌁</span>
          <span class="stage-label">${snapshot.biome.toUpperCase()} · ${snapshot.stage + 1}/5</span>
        </div>
        <div class="hud-cluster objective-block">
          <span class="eyebrow">${i18n.t('hud.objective')}</span>
          <strong>${objective}</strong>
          <span class="progress-text">${Math.min(snapshot.objective.current, snapshot.objective.target)} / ${snapshot.objective.target}</span>
          <span class="progress-track"><span style="width:${Math.min(100, snapshot.objective.current / snapshot.objective.target * 100)}%"></span></span>
        </div>
        <div class="hud-cluster stats">
          <div class="score"><span>${i18n.t('hud.score')}</span><strong>${snapshot.score.toLocaleString()}</strong></div>
          <div class="hearts" aria-label="${snapshot.hearts} health">${hearts}</div>
          <div class="shields" aria-label="${snapshot.shield} shield">${shields}</div>
          <button class="icon-button" data-action="pause" aria-label="${i18n.t('hud.pause')}">Ⅱ</button>
        </div>
      </div>

      ${snapshot.phase !== 'ready' ? `<div class="left-hud">
        ${snapshot.tutorialStep >= 2 ? `<div class="meter flow-meter"><span>${i18n.t('hud.flow')}</span><strong>x${snapshot.flow.toFixed(1)}</strong>
          <i><b style="width:${snapshot.flow / 3 * 100}%"></b></i>
        </div>` : ''}
        <div class="meter tension-meter"><span>${i18n.t(snapshot.controlMode !== 'drag-anchor' ? 'hud.strain' : 'hud.tension')}</span><strong>${Math.round(snapshot.tension * 100)}%</strong>
          <i><b style="width:${Math.min(100, snapshot.tension * 100)}%"></b><em></em></i>
        </div>
        ${snapshot.stage > 0 ? `<div class="parry-bank ${snapshot.capturedShots > 0 ? 'armed' : ''}">
          <div class="parry-title"><span>${i18n.t('hud.parry')}</span><strong>${snapshot.capturedShots}/${snapshot.projectileCapacity}</strong></div>
          <div class="shot-slots" aria-label="${snapshot.capturedShots} / ${snapshot.projectileCapacity}">${capturedSlots}</div>
          <small>${i18n.t(snapshot.capturedShots > 0 ? 'hud.parryReady' : 'hud.parryHint')}</small>
        </div>` : ''}
        ${snapshot.tutorialStep >= 2 ? `<div class="essence-row" aria-label="Recipe essences">${essence}${'<span class="essence empty"></span>'.repeat(Math.max(0, 3 - snapshot.essences.length))}</div>` : ''}
      </div>` : ''}

      ${hasBuild ? `<aside class="build-hud" aria-label="Current build">
        <div class="build-title"><span>${i18n.t('hud.patterns')}</span>${ruleDefinition ? `<b>${ruleDefinition.glyph} ${i18n.t(ruleDefinition.nameKey)}</b>` : ''}</div>
        <div class="stitch-ring">${patternSlots}</div>
        ${seams ? `<div class="seam-list"><span>${i18n.t('hud.seams')}</span>${seams}</div>` : ''}
      </aside>` : ''}

      ${snapshot.bannerKey && snapshot.phase !== 'ready' ? `<div class="banner" role="status">${i18n.t(snapshot.bannerKey)}</div>` : ''}
      ${patternNotice && snapshot.phase === 'playing' ? `<div class="pattern-toast family-${patternNotice.family}" role="status">
        <span>${patternNotice.glyph}</span><div><small>${i18n.t('choice.equipped')}</small><b>${i18n.t(patternNotice.nameKey)}</b><em>${this.patternEffects(patternNotice)}</em></div>
      </div>` : ''}
      ${this.renderTutorial(snapshot)}
      ${this.renderOverlay(snapshot)}
      <div class="screen-reader-status" aria-live="polite">${objective}: ${Math.min(snapshot.objective.current, snapshot.objective.target)} / ${snapshot.objective.target}</div>
    `;
  }

  private renderTutorial(snapshot: RuntimeSnapshot): string {
    if (snapshot.phase !== 'playing') return '';
    const key = snapshot.stage === 0
      ? snapshot.tutorialStep <= 1 ? 'tutorial.snapRemote' : 'tutorial.clearMore'
      : snapshot.stage === 1 && snapshot.tutorialStep < 4 ? 'tutorial.chord'
        : snapshot.stage === 2 && snapshot.objective.current < 2 ? 'tutorial.rescueSmallLoops' : '';
    const lesson = snapshot.stage === 0 ? Math.min(2, snapshot.tutorialStep + 1) : snapshot.stage === 1 ? 3 : 4;
    return key ? `<div class="tutorial-tip"><span>${lesson}</span>${i18n.t(key)}</div>` : '';
  }

  private renderOverlay(snapshot: RuntimeSnapshot): string {
    if (snapshot.phase === 'ready') {
      return `<section class="overlay ready-overlay">
        <div class="quick-start">
          <span class="sup-title">ONE STROKE · ONE LOOP</span>
          <h1>${i18n.t('game.title')}</h1>
          <p>${i18n.t('ready.firstTask')}</p>
          <div class="drag-hint"><span class="mouse-gesture">⌁</span>${i18n.t('ready.hintFixed')}</div>
        </div>
      </section>`;
    }
    if (snapshot.phase === 'pattern-choice') {
      return this.choiceOverlay('choice.pattern', snapshot.patternChoices.map((id) => {
        const pattern = PATTERN_BY_ID[id];
        return pattern ? {
          id,
          action: 'pattern',
          glyph: pattern.glyph,
          title: i18n.t(pattern.nameKey),
          description: i18n.t(pattern.descriptionKey),
          effect: this.patternEffects(pattern),
          className: `family-${pattern.family}`
        } : null;
      }));
    }
    if (snapshot.phase === 'rule-choice') {
      return this.choiceOverlay('choice.rule', snapshot.ruleChoices.map((id) => {
        const rule = WORLD_RULE_BY_ID[id];
        return rule ? {
          id,
          action: 'rule',
          glyph: rule.glyph,
          title: i18n.t(rule.nameKey),
          description: i18n.t(rule.descriptionKey),
          className: 'world-rule'
        } : null;
      }));
    }
    if (snapshot.phase === 'paused') {
      return `<section class="overlay modal-overlay"><div class="modal-card">
        <span class="modal-glyph">Ⅱ</span><h2>${i18n.t('hud.pause')}</h2>
        <button class="primary-button" data-action="resume">${i18n.t('hud.resume')}</button>
        ${this.settings(snapshot)}
      </div></section>`;
    }
    if (snapshot.phase === 'gameover' || snapshot.phase === 'victory') {
      const victory = snapshot.phase === 'victory';
      return `<section class="overlay modal-overlay"><div class="modal-card result-card ${victory ? 'victory' : ''}">
        <span class="modal-glyph">${victory ? '✦' : '⌁'}</span>
        <h2>${i18n.t(victory ? 'result.victory' : 'result.gameover')}</h2>
        <p>${i18n.t('result.score')}</p><strong class="result-score">${snapshot.score.toLocaleString()}</strong>
        <small>${i18n.t('result.best')}</small>
        <button class="primary-button" data-action="restart">${i18n.t('hud.retry')}</button>
        ${this.settings(snapshot)}
      </div></section>`;
    }
    return '';
  }

  private choiceOverlay(
    headingKey: string,
    choices: Array<{ id: string; action: string; glyph: string; title: string; description: string; effect?: string; className: string } | null>
  ): string {
    return `<section class="overlay modal-overlay choice-overlay"><div class="choice-shell">
      <span class="sup-title">STITCH COMPLETE</span><h2>${i18n.t(headingKey)}</h2>
      <div class="choice-grid">${choices.filter(Boolean).map((choice) => choice && `<button class="choice-card ${choice.className}" data-action="${choice.action}" data-id="${choice.id}">
        <span class="choice-glyph">${choice.glyph}</span><b>${choice.title}</b><small>${choice.description}</small>
        ${choice.effect ? `<span class="choice-effect">${choice.effect}</span>` : ''}<i>${i18n.t('choice.choose')}</i>
      </button>`).join('')}</div>
    </div></section>`;
  }

  private patternEffects(pattern: PatternDefinition): string {
    const modifiers = pattern.modifiers;
    const effects: string[] = [];
    if (modifiers.chordRepeats) effects.push(i18n.t('pattern.effect.chordRepeats', { value: modifiers.chordRepeats }));
    if (modifiers.chordDamage) effects.push(i18n.t('pattern.effect.chordDamage', { value: Math.round(modifiers.chordDamage * 100) }));
    if (modifiers.snapBlast) effects.push(i18n.t('pattern.effect.snapBlast', { value: Math.round(modifiers.snapBlast) }));
    if (modifiers.flowGrace) effects.push(i18n.t('pattern.effect.flowGrace', { value: modifiers.flowGrace.toFixed(2) }));
    if (modifiers.anchorPull) effects.push(i18n.t('pattern.effect.anchorPull', { value: Math.round(modifiers.anchorPull * 100) }));
    if (modifiers.tensionRate && modifiers.tensionRate < 0) effects.push(i18n.t('pattern.effect.tensionRate', { value: Math.round(-modifiers.tensionRate * 100) }));
    if (modifiers.captureTolerance) effects.push(i18n.t('pattern.effect.captureTolerance', { value: Math.round(modifiers.captureTolerance * 100) }));
    if (modifiers.scoreMultiplier) effects.push(i18n.t('pattern.effect.scoreMultiplier', { value: Math.round(modifiers.scoreMultiplier * 100) }));
    if (modifiers.tightShield) effects.push(i18n.t('pattern.effect.tightShield', { value: modifiers.tightShield }));
    if (modifiers.healEvery) effects.push(i18n.t('pattern.effect.healEvery', { value: modifiers.healEvery }));
    if (modifiers.reflectedPower) effects.push(i18n.t('pattern.effect.reflectedPower', { value: Math.round(modifiers.reflectedPower * 100) }));
    if (modifiers.projectileCapacity) effects.push(i18n.t('pattern.effect.projectileCapacity', { value: modifiers.projectileCapacity }));
    return effects.join(' · ');
  }

  private settings(snapshot: RuntimeSnapshot): string {
    return `<div class="settings-row">
      <label><input type="checkbox" data-setting="motion" ${snapshot.reducedMotion ? 'checked' : ''}> ${i18n.t('hud.reducedMotion')}</label>
      <label><input type="checkbox" data-setting="contrast" ${snapshot.highContrast ? 'checked' : ''}> ${i18n.t('hud.highContrast')}</label>
    </div>`;
  }

  private readonly handleClick = (event: Event): void => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === 'pause') this.snapshot?.phase === 'paused' ? this.runtime.resume() : this.runtime.pause();
    if (action === 'resume') this.runtime.resume();
    if (action === 'restart') this.runtime.restart();
    if (action === 'needle' && id) this.runtime.chooseNeedle(id as 'dawn' | 'twin' | 'moon');
    if (action === 'pattern' && id) this.runtime.choosePattern(id);
    if (action === 'rule' && id) this.runtime.chooseRule(id);
  };

  private readonly handleChange = (event: Event): void => {
    const input = (event.target as HTMLElement).closest<HTMLInputElement>('input[data-setting]');
    if (!input) return;
    if (input.dataset.setting === 'motion') this.runtime.setReducedMotion(input.checked);
    if (input.dataset.setting === 'contrast') this.runtime.setHighContrast(input.checked);
  };
}
