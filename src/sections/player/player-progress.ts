import { css, html, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import Store from '../../model/store';
import { styleMap } from 'lit-html/directives/style-map.js';

class PlayerProgress extends LitElement {
  @property({ attribute: false }) store!: Store;

  @state() private playingProgress!: number;
  private tracker?: NodeJS.Timeout;
  @query('.bar')
  private progressBar?: HTMLElement;
  private mediaDuration = 0;
  /** Touch layout: thick draggable bar with the times underneath. */
  @property({ type: Boolean }) touch = false;
  /** Position being dragged to (0..1), shown instead of the playing position until the seek is sent. */
  @state() private dragRatio?: number;

  disconnectedCallback() {
    if (this.tracker) {
      clearInterval(this.tracker);
      this.tracker = undefined;
    }
    super.disconnectedCallback();
  }

  render() {
    this.mediaDuration = this.store.activePlayer?.attributes.media_duration || 0;
    const showProgress = this.mediaDuration > 0;
    if (showProgress) {
      this.trackProgress();
    }
    if (this.touch) {
      return this.renderTouch(showProgress);
    }
    return html`
      <div class="progress" ?hidden=${!showProgress}>
        <span>${convertProgress(this.playingProgress)}</span>
        <div class="bar" @click=${this.handleSeek}>
          <div class="progress-bar" style=${this.progressBarStyle(this.mediaDuration)}></div>
        </div>
        <span> -${convertProgress(this.mediaDuration - this.playingProgress)}</span>
      </div>
    `;
  }

  private renderTouch(showProgress: boolean) {
    const duration = this.mediaDuration;
    const played = this.dragRatio !== undefined ? this.dragRatio * duration : this.playingProgress;
    const ratio = duration > 0 ? Math.min(1, Math.max(0, played / duration)) : 0;
    const percent = `${ratio * 100}%`;
    return html`
      <div class="touch-progress ${this.dragRatio !== undefined ? 'dragging' : ''}" ?hidden=${!showProgress}>
        <div
          class="touch-track"
          @pointerdown=${this.onPointerDown}
          @pointermove=${this.onPointerMove}
          @pointerup=${this.onPointerUp}
          @pointercancel=${this.onPointerCancel}
        >
          <div class="touch-rail"><div class="touch-fill" style="width:${percent}"></div></div>
          <div class="touch-knob" style="left:${percent}"></div>
        </div>
        <div class="touch-times">
          <span>${convertProgress(played)}</span>
          <span>-${convertProgress(duration - played)}</span>
        </div>
      </div>
    `;
  }

  /** Ratio along the track from a pointer position; rect and clientX are both visual pixels, so CSS zoom is fine. */
  private ratioAt(ev: PointerEvent) {
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    return rect.width > 0 ? Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)) : 0;
  }

  private onPointerDown = (ev: PointerEvent) => {
    if (!this.mediaDuration) {
      return;
    }
    ev.preventDefault();
    (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
    this.dragRatio = this.ratioAt(ev);
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (this.dragRatio !== undefined) {
      this.dragRatio = this.ratioAt(ev);
    }
  };

  private onPointerUp = async (ev: PointerEvent) => {
    if (this.dragRatio === undefined) {
      return;
    }
    const ratio = this.ratioAt(ev);
    (ev.currentTarget as HTMLElement).releasePointerCapture?.(ev.pointerId);
    const position = this.mediaDuration * ratio;
    this.playingProgress = position;
    this.dragRatio = undefined;
    await this.store.mediaControlService.seek(this.store.activePlayer, position);
  };

  private onPointerCancel = () => {
    this.dragRatio = undefined;
  };

  private async handleSeek(e: MouseEvent) {
    const progressWidth = this.progressBar!.offsetWidth;
    const percent = e.offsetX / progressWidth;
    const position = this.mediaDuration * percent;
    await this.store.mediaControlService.seek(this.store.activePlayer, position);
  }

  private progressBarStyle(mediaDuration: number) {
    return styleMap({ width: `${(this.playingProgress / mediaDuration) * 100}%` });
  }

  trackProgress() {
    const position = this.store.activePlayer?.attributes.media_position || 0;
    const playing = this.store.activePlayer?.isPlaying();
    const updatedAt = this.store.activePlayer?.attributes.media_position_updated_at || 0;
    if (playing) {
      this.playingProgress = position + (Date.now() - new Date(updatedAt).getTime()) / 1000.0;
    } else {
      this.playingProgress = position;
    }
    if (!this.tracker) {
      this.tracker = setInterval(() => this.trackProgress(), 1000);
    }
    if (!playing) {
      clearInterval(this.tracker);
      this.tracker = undefined;
    }
  }
  static get styles() {
    return css`
      .progress {
        width: 100%;
        font-size: x-small;
        display: flex;
        --paper-progress-active-color: lightgray;
      }

      [hidden] {
        display: none !important;
      }

      .bar {
        display: flex;
        flex-grow: 1;
        align-items: center;
        padding: 5px;
        cursor: pointer;
      }

      .touch-progress {
        width: 100%;
        user-select: none;
        -webkit-user-select: none;
      }
      .touch-track {
        position: relative;
        height: 36px;
        display: flex;
        align-items: center;
        cursor: pointer;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
      }
      .touch-rail {
        position: relative;
        flex: 1;
        height: 8px;
        border-radius: 4px;
        overflow: hidden;
        background: rgba(127, 127, 127, 0.3);
      }
      .touch-fill {
        height: 100%;
        background: var(--accent-color);
        transition: width 0.25s linear;
      }
      .touch-knob {
        position: absolute;
        top: 50%;
        width: 18px;
        height: 18px;
        margin: -9px 0 0 -9px;
        border-radius: 50%;
        background: var(--accent-color);
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
        transition:
          left 0.25s linear,
          transform 0.15s;
      }
      .dragging .touch-fill,
      .dragging .touch-knob {
        transition: none;
      }
      .dragging .touch-knob {
        transform: scale(1.4);
      }
      .touch-times {
        display: flex;
        justify-content: space-between;
        margin-top: -2px;
        font-size: calc(var(--sonos-font-size, 1rem) * 1.05);
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        color: var(--secondary-text-color);
      }
      .dragging .touch-times span:first-child {
        color: var(--accent-color);
      }

      .progress-bar {
        background-color: var(--accent-color);
        height: 50%;
        transition: width 0.1s linear;
      }
    `;
  }
}

export const convertProgress = (duration: number): string => {
  if (duration == null || !isFinite(duration)) {
    return '';
  }
  const date = new Date(duration * 1000).toISOString().substring(11, 19);
  const time = date.startsWith('00:') ? date.substring(3) : date;
  return time.replace(/^0(\d)/, '$1');
};

customElements.define('sonos-progress', PlayerProgress);
