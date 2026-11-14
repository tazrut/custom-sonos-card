import { css, html, LitElement, nothing, PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { mdiClose, mdiMinus, mdiPlus } from '@mdi/js';
import { HassEntity } from 'home-assistant-js-websocket';
import Store from '../model/store';
import { MediaPlayer } from '../model/media-player';
import { getEntityNameWithoutDevice } from '../utils/entity-name-utils';
import { browserText, BrowserStringKey } from '../sections/media-browser/i18n';

const SLEEP_MINUTES = [15, 30, 45, 60, 90];

/**
 * Touch sheet with a speaker's settings (bass, treble, balance, loudness, crossfade, … plus source and
 * sleep timer), built from the entities of the speaker's device. Big sliders with -/+ and big toggles.
 * Fires `close`.
 */
export class SpeakerSettingsSheet extends LitElement {
  @property({ attribute: false }) store!: Store;
  @property({ attribute: false }) player!: MediaPlayer;
  @state() private entityIds?: string[];
  /** Values being dragged or just sent, shown until Home Assistant reports the new state. */
  @state() private pending: Record<string, number> = {};

  protected willUpdate(changed: PropertyValues) {
    if (changed.has('player') && this.player && (changed.get('player') as MediaPlayer | undefined)?.id !== this.player.id) {
      this.entityIds = undefined;
      this.store.hassService
        .getRelatedEntities(this.player, 'switch', 'number', 'sensor')
        .then((entities) => (this.entityIds = entities.filter(Boolean).map((e) => e.entity_id)))
        .catch(() => (this.entityIds = []));
    }
    if (changed.has('store')) {
      // drop pending values once Home Assistant reports them
      const states = this.store.hass.states;
      const pending = Object.fromEntries(Object.entries(this.pending).filter(([id, v]) => Number(states[id]?.state) !== v));
      if (Object.keys(pending).length !== Object.keys(this.pending).length) {
        this.pending = pending;
      }
    }
  }

  private t(key: BrowserStringKey, vars?: Record<string, string | number>) {
    return browserText(this.store.hass, key, vars);
  }

  private entities() {
    const states = this.store.hass.states;
    const list = (this.entityIds ?? []).map((id) => states[id]).filter((e): e is HassEntity => !!e && e.state !== 'unavailable');
    const domain = (e: HassEntity) => e.entity_id.split('.')[0];
    return {
      numbers: list.filter((e) => domain(e) === 'number'),
      switches: list.filter((e) => domain(e) === 'switch'),
      sensors: list.filter((e) => domain(e) === 'sensor' || domain(e) === 'binary_sensor'),
    };
  }

  private name(entity: HassEntity) {
    return getEntityNameWithoutDevice(this.store.hass, entity, this.player.name);
  }

  private close = () => this.dispatchEvent(new CustomEvent('close'));

  render() {
    if (!this.player) {
      return nothing;
    }
    const { numbers, switches, sensors } = this.entities();
    const members = this.store.activePlayer?.members ?? [];
    const sources = (this.player.attributes.source_list as string[] | undefined) ?? [];
    const isSonos = this.player.attributes.platform === 'sonos' || this.store.config.entityPlatform === 'sonos';
    return html`
      <div class="backdrop" @click=${this.close}></div>
      <div class="sheet" role="dialog" aria-label=${this.t('speakerSettings')}>
        <div class="head">
          <div class="head-text">
            <div class="title">${this.t('speakerSettings')}</div>
            <div class="subtitle">${this.player.name}</div>
          </div>
          <button class="close" @click=${this.close} aria-label=${this.t('close')}><ha-svg-icon .path=${mdiClose}></ha-svg-icon></button>
        </div>
        <div class="body">
          ${
            members.length > 1
              ? html`<div class="chips members">
                  ${members.map((m) => html`<button class="chip ${m.id === this.player.id ? 'on' : ''}" @click=${() => (this.player = m)}>${m.name}</button>`)}
                </div>`
              : nothing
          }
          ${this.entityIds === undefined ? html`<div class="loading"><ha-spinner size="small"></ha-spinner></div>` : nothing}
          ${
            numbers.length
              ? html`<div class="section-label">${this.t('sound')}</div>
                  ${numbers.map((e) => this.renderNumber(e))}`
              : nothing
          }
          ${
            switches.length || sensors.length
              ? html`<div class="section-label">${this.t('options')}</div>
                  ${switches.map((e) => this.renderSwitch(e))} ${sensors.map((e) => this.renderSensor(e))}`
              : nothing
          }
          ${
            sources.length
              ? html`<div class="section-label">${this.t('source')}</div>
                  <div class="chips">
                    ${sources.map(
                      (source) =>
                        html`<button class="chip ${source === this.player.attributes.source ? 'on' : ''}" @click=${() => this.selectSource(source)}>
                          ${source}
                        </button>`,
                    )}
                  </div>`
              : nothing
          }
          ${
            isSonos
              ? html`<div class="section-label">${this.t('sleepTimer')}</div>
                  <div class="chips">
                    ${SLEEP_MINUTES.map((m) => html`<button class="chip" @click=${() => this.setSleep(m)}>${this.t('minutes', { count: m })}</button>`)}
                    <button class="chip off" @click=${this.clearSleep}>${this.t('sleepOff')}</button>
                  </div>`
              : nothing
          }
          ${
            this.entityIds !== undefined && !numbers.length && !switches.length && !sensors.length && !sources.length && !isSonos
              ? html`<div class="empty">${this.t('noSettings')}</div>`
              : nothing
          }
        </div>
      </div>
    `;
  }

  private renderNumber(entity: HassEntity) {
    const min = Number(entity.attributes.min ?? 0);
    const max = Number(entity.attributes.max ?? 100);
    const step = Number(entity.attributes.step ?? 1);
    const value = this.pending[entity.entity_id] ?? Number(entity.state);
    const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
    const unit = entity.attributes.unit_of_measurement ? ` ${entity.attributes.unit_of_measurement}` : '';
    const set = (v: number) => this.setNumber(entity, Math.min(max, Math.max(min, v)));
    return html`
      <div class="setting">
        <div class="setting-head">
          <ha-state-icon .stateObj=${entity} .hass=${this.store.hass}></ha-state-icon>
          <span class="setting-name">${this.name(entity)}</span>
          <span class="setting-value">${Number.isFinite(value) ? value : entity.state}${unit}</span>
        </div>
        <div class="number-row">
          <button class="round" @click=${() => set(value - step)} aria-label="-"><ha-svg-icon .path=${mdiMinus}></ha-svg-icon></button>
          <input
            type="range"
            min=${min}
            max=${max}
            step=${step}
            .value=${String(value)}
            style="--percent:${percent}%"
            @input=${(e: Event) => (this.pending = { ...this.pending, [entity.entity_id]: Number((e.target as HTMLInputElement).value) })}
            @change=${(e: Event) => set(Number((e.target as HTMLInputElement).value))}
          />
          <button class="round" @click=${() => set(value + step)} aria-label="+"><ha-svg-icon .path=${mdiPlus}></ha-svg-icon></button>
        </div>
      </div>
    `;
  }

  private renderSwitch(entity: HassEntity) {
    const on = entity.state === 'on';
    return html`
      <button class="setting toggle-row" role="switch" aria-checked=${on} @click=${() => this.toggle(entity)}>
        <ha-state-icon .stateObj=${entity} .hass=${this.store.hass}></ha-state-icon>
        <span class="setting-name">${this.name(entity)}</span>
        <span class="toggle ${on ? 'on' : ''}"><span class="knob"></span></span>
      </button>
    `;
  }

  private renderSensor(entity: HassEntity) {
    const unit = entity.attributes.unit_of_measurement ? ` ${entity.attributes.unit_of_measurement}` : '';
    const hass = this.store.hass as unknown as { formatEntityState?: (e: HassEntity) => string };
    const value = hass.formatEntityState?.(entity) ?? `${entity.state}${unit}`;
    return html`
      <div class="setting toggle-row static">
        <ha-state-icon .stateObj=${entity} .hass=${this.store.hass}></ha-state-icon>
        <span class="setting-name">${this.name(entity)}</span>
        <span class="setting-value">${value}</span>
      </div>
    `;
  }

  private async setNumber(entity: HassEntity, value: number) {
    this.pending = { ...this.pending, [entity.entity_id]: value };
    await this.store.hassService.callService('number', 'set_value', { entity_id: entity.entity_id, value });
  }

  private async toggle(entity: HassEntity) {
    await this.store.hassService.callService('switch', entity.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: entity.entity_id });
  }

  private async selectSource(source: string) {
    await this.store.hassService.callService('media_player', 'select_source', { entity_id: this.player.id, source });
  }

  private setSleep = async (minutes: number) => {
    await this.store.hassService.setSleepTimer(this.player, minutes * 60);
    this.close();
  };

  private clearSleep = async () => {
    await this.store.hassService.cancelSleepTimer(this.player);
    this.close();
  };

  static get styles() {
    return css`
      :host {
        position: absolute;
        inset: 0;
        z-index: 30;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
      }
      .backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.45);
        animation: fade 0.15s ease-out;
      }
      .sheet {
        position: relative;
        display: flex;
        flex-direction: column;
        max-height: 92%;
        border-radius: 20px 20px 0 0;
        background: var(--card-background-color, #1c1c1c);
        color: var(--primary-text-color);
        box-shadow: 0 -8px 30px rgba(0, 0, 0, 0.4);
        animation: up 0.2s ease-out;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 8px 8px 20px;
        border-bottom: 1px solid var(--divider-color);
      }
      .head-text {
        flex: 1;
        min-width: 0;
      }
      .title {
        font-weight: 600;
        font-size: 1.15rem;
      }
      .subtitle {
        font-size: 0.85rem;
        color: var(--secondary-text-color);
      }
      button {
        font: inherit;
        color: inherit;
        border: none;
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .close {
        width: 52px;
        height: 52px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(127, 127, 127, 0.16);
        --mdc-icon-size: 26px;
      }
      .body {
        overflow-y: auto;
        padding: 4px 14px 16px;
      }
      .loading,
      .empty {
        display: flex;
        justify-content: center;
        padding: 24px;
        color: var(--secondary-text-color);
      }
      .section-label {
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--secondary-text-color);
        padding: 16px 6px 6px;
      }
      .setting {
        padding: 6px;
      }
      .setting-head,
      .toggle-row {
        display: flex;
        align-items: center;
        gap: 14px;
        width: 100%;
        min-height: 52px;
        text-align: left;
        box-sizing: border-box;
      }
      .toggle-row {
        border-radius: 12px;
        padding: 0 6px;
      }
      .toggle-row:not(.static):active {
        background: rgba(127, 127, 127, 0.16);
      }
      ha-state-icon {
        --mdc-icon-size: 26px;
        color: var(--secondary-text-color);
        flex: none;
      }
      .setting-name {
        flex: 1;
        font-size: 1rem;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .setting-value {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
      .number-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding-bottom: 4px;
      }
      .round {
        width: 48px;
        height: 48px;
        flex: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(127, 127, 127, 0.16);
        --mdc-icon-size: 24px;
      }
      .round:active {
        background: rgba(127, 127, 127, 0.3);
      }
      input[type='range'] {
        flex: 1;
        min-width: 0;
        height: 44px;
        margin: 0;
        background: transparent;
        -webkit-appearance: none;
        appearance: none;
        touch-action: none;
      }
      input[type='range']::-webkit-slider-runnable-track {
        height: 12px;
        border-radius: 6px;
        background: linear-gradient(to right, var(--accent-color) var(--percent), rgba(127, 127, 127, 0.3) var(--percent));
      }
      input[type='range']::-moz-range-track {
        height: 12px;
        border-radius: 6px;
        background: rgba(127, 127, 127, 0.3);
      }
      input[type='range']::-moz-range-progress {
        height: 12px;
        border-radius: 6px;
        background: var(--accent-color);
      }
      input[type='range']::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 30px;
        height: 30px;
        margin-top: -9px;
        border-radius: 50%;
        border: none;
        background: var(--primary-text-color, #fff);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      }
      input[type='range']::-moz-range-thumb {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        background: var(--primary-text-color, #fff);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
      }
      .toggle {
        position: relative;
        width: 58px;
        height: 34px;
        flex: none;
        border-radius: 17px;
        background: rgba(127, 127, 127, 0.35);
        transition: background 0.15s;
      }
      .toggle .knob {
        position: absolute;
        top: 4px;
        left: 4px;
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        transition: transform 0.15s;
      }
      .toggle.on {
        background: var(--accent-color);
      }
      .toggle.on .knob {
        transform: translateX(24px);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 4px 6px;
      }
      .chip {
        min-height: 48px;
        padding: 0 18px;
        border-radius: 24px;
        background: rgba(127, 127, 127, 0.16);
        font-weight: 500;
      }
      .chip:active {
        background: rgba(127, 127, 127, 0.3);
      }
      .chip.on {
        background: var(--accent-color);
        color: var(--text-primary-color, #fff);
      }
      .members {
        padding-top: 12px;
      }
      .chip.off {
        border: 1px solid var(--divider-color);
        background: none;
      }
      @keyframes up {
        from {
          transform: translateY(100%);
        }
      }
      @keyframes fade {
        from {
          opacity: 0;
        }
      }
    `;
  }
}

if (!customElements.get('sonos-speaker-settings')) {
  customElements.define('sonos-speaker-settings', SpeakerSettingsSheet);
}
