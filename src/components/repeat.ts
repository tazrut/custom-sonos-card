import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import MediaControlService from '../services/media-control-service';
import Store from '../model/store';
import { MediaPlayer } from '../model/media-player';
import { mdiRepeat, mdiRepeatOff, mdiRepeatOnce } from '@mdi/js';
import './icon-button';

class Repeat extends LitElement {
  @property({ attribute: false }) store!: Store;
  private activePlayer!: MediaPlayer;
  private mediaControlService!: MediaControlService;

  render() {
    this.activePlayer = this.store.activePlayer;
    this.mediaControlService = this.store.mediaControlService;
    // sonos-card: lets the touch layout colour the button while it is on
    this.toggleAttribute('active', !!this.activePlayer?.attributes.repeat && this.activePlayer.attributes.repeat !== 'off');

    return html`<sonos-icon-button @click=${this.repeat} .path=${this.repeatIcon()}></sonos-icon-button> `;
  }

  private repeat = async () => await this.mediaControlService.repeat(this.activePlayer);

  private repeatIcon() {
    const repeatState = this.activePlayer?.attributes.repeat;
    return repeatState === 'all' ? mdiRepeat : repeatState === 'one' ? mdiRepeatOnce : mdiRepeatOff;
  }
}

customElements.define('sonos-repeat', Repeat);
