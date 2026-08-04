import type { GameRuntime } from '../game/runtime/GameRuntime';
import type { RuntimeSnapshot } from '../game/core/types';
import { NEEDLE_LIST } from '../game/content/needles';
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
    const seams = snapshot.activeSeams.map((id) => {
      const seam = SEAM_BY_ID[id];
      return seam ? `<span class="seam-chip">${i18n.t(seam.nameKey)}</span>` : '';
    }).join('');
    const rule = snapshot.worldRules.at(-1);
    const ruleDefinition = rule ? WORLD_RULE_BY_ID[rule] : undefined;

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
          <button class="icon-button" data-action="pause" aria-label="${i18n.t('hud.pause')}">Ⅱ</button>
        </div>
      </div>

      <div class="left-hud">
        <div class="meter flow-meter"><span>${i18n.t('hud.flow')}</span><strong>x${snapshot.flow.toFixed(1)}</strong>
          <i><b style="width:${snapshot.flow / 3 * 100}%"></b></i>
        </div>
        <div class="meter tension-meter"><span>${i18n.t('hud.tension')}</span><strong>${Math.round(snapshot.tension * 100)}%</strong>
          <i><b style="width:${Math.min(100, snapshot.tension * 100)}%"></b><em></em></i>
        </div>
        <div class="essence-row" aria-label="Recipe essences">${essence}${'<span class="essence empty"></span>'.repeat(Math.max(0, 3 - snapshot.essences.length))}</div>
      </div>

      <aside class="build-hud" aria-label="Current build">
        <div class="build-title"><span>${i18n.t('hud.patterns')}</span>${ruleDefinition ? `<b>${ruleDefinition.glyph} ${i18n.t(ruleDefinition.nameKey)}</b>` : ''}</div>
        <div class="stitch-ring">${patternSlots}</div>
        ${seams ? `<div class="seam-list"><span>${i18n.t('hud.seams')}</span>${seams}</div>` : ''}
      </aside>

      ${snapshot.bannerKey && snapshot.phase !== 'ready' ? `<div class="banner" role="status">${i18n.t(snapshot.bannerKey)}</div>` : ''}
      ${this.renderTutorial(snapshot)}
      ${this.renderOverlay(snapshot)}
      <div class="screen-reader-status" aria-live="polite">${objective}: ${snapshot.objective.current} / ${snapshot.objective.target}</div>
    `;
  }

  private renderTutorial(snapshot: RuntimeSnapshot): string {
    if (snapshot.phase !== 'playing' && snapshot.phase !== 'ready') return '';
    const key = snapshot.tutorialStep <= 0 ? 'tutorial.deploy'
      : snapshot.tutorialStep === 1 ? 'tutorial.snap'
        : snapshot.tutorialStep === 2 ? 'tutorial.parry'
          : snapshot.tutorialStep === 3 ? 'tutorial.chord' : '';
    return key ? `<div class="tutorial-tip ${snapshot.phase === 'ready' ? 'ready-tip' : ''}"><span>${snapshot.tutorialStep + 1}</span>${i18n.t(key)}</div>` : '';
  }

  private renderOverlay(snapshot: RuntimeSnapshot): string {
    if (snapshot.phase === 'ready') {
      return `<section class="overlay ready-overlay">
        <div class="title-lockup">
          <span class="sup-title">PLAYER FIT PROTOTYPE</span>
          <h1>${i18n.t('game.title')}</h1>
          <p>${i18n.t('game.tagline')}</p>
          <div class="drag-hint"><span class="mouse-gesture">⌁</span>${i18n.t('ready.hint')}</div>
        </div>
        <div class="needle-picker" aria-label="${i18n.t('ready.chooseNeedle')}">
          ${NEEDLE_LIST.map((needle) => `<button class="needle-card ${snapshot.needleId === needle.id ? 'selected' : ''}" data-action="needle" data-id="${needle.id}">
            <span class="needle-glyph" style="--needle-color:#${needle.color.toString(16).padStart(6, '0')}">${needle.glyph}</span>
            <b>${i18n.t(needle.nameKey)}</b><small>${i18n.t(needle.descriptionKey)}</small>
          </button>`).join('')}
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
    choices: Array<{ id: string; action: string; glyph: string; title: string; description: string; className: string } | null>
  ): string {
    return `<section class="overlay modal-overlay choice-overlay"><div class="choice-shell">
      <span class="sup-title">STITCH COMPLETE</span><h2>${i18n.t(headingKey)}</h2>
      <div class="choice-grid">${choices.filter(Boolean).map((choice) => choice && `<button class="choice-card ${choice.className}" data-action="${choice.action}" data-id="${choice.id}">
        <span class="choice-glyph">${choice.glyph}</span><b>${choice.title}</b><small>${choice.description}</small><i>CHOOSE</i>
      </button>`).join('')}</div>
    </div></section>`;
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
