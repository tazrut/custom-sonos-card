import { css, html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import Store from '../../model/store';
import {
  mdiFastForward,
  mdiPauseCircle,
  mdiPlayBoxMultiple,
  mdiPlayCircle,
  mdiRewind,
  mdiSkipNext,
  mdiSkipPrevious,
  mdiStopCircle,
  mdiVolumeMinus,
  mdiVolumePlus,
} from '@mdi/js';
import { findPlayer } from '../../utils/utils';
import './player-favorite-button';
import '../../components/icon-button';

class PlayerControls extends LitElement {
  @property({ attribute: false }) store!: Store;
  /** Touch layout: bigger buttons, shuffle/repeat coloured when on, volume with -/+ buttons. */
  @property({ type: Boolean }) touch = false;

  render() {
    const {
      stopInsteadOfPause,
      volumeEntityId,
      controlsColor,
      controlsLargeIcons,
      showVolumeUpAndDownButtons,
      hideControlFavoriteButton,
      hideControlShuffleButton,
      hideControlPrevTrackButton,
      showFastForwardAndRewindButtons,
      hideControlNextTrackButton,
      hideControlRepeatButton,
      showBrowseMediaButton,
      hideVolume,
    } = this.store.config.player ?? {};
    const playing = this.store.activePlayer.isPlaying();
    const pauseOrStopIcon = stopInsteadOfPause ? mdiStopCircle : mdiPauseCircle;
    const playPauseIcon = playing ? pauseOrStopIcon : mdiPlayCircle;
    const playPauseHandler = playing ? this.pauseOrStop : this.play;
    const volumePlayer = this.getVolumePlayer();
    const updateMemberVolumes = !volumeEntityId;
    const hidePower = this.store.hidePower(true) === true;
    const controlsColorStyle = controlsColor ? `--controls-color: ${controlsColor}` : '';
    return html`
      <div class="main" id="mediaControls" style=${controlsColorStyle || nothing}>
        <div class="icons ${controlsLargeIcons ? 'large-icons' : ''} ${this.touch ? 'touch-icons' : ''}">
          <div class="flex-1">
            <sonos-player-favorite-button ?hidden=${!!hideControlFavoriteButton} .store=${this.store}></sonos-player-favorite-button>
          </div>
          <sonos-icon-button ?hidden=${!showVolumeUpAndDownButtons || this.touch} @click=${this.volDown} .path=${mdiVolumeMinus}></sonos-icon-button>
          <sonos-shuffle ?hidden=${!!hideControlShuffleButton} .store=${this.store}></sonos-shuffle>
          <sonos-icon-button ?hidden=${!!hideControlPrevTrackButton} @click=${this.prev} .path=${mdiSkipPrevious}></sonos-icon-button>
          <sonos-icon-button ?hidden=${!showFastForwardAndRewindButtons} @click=${this.rewind} .path=${mdiRewind}></sonos-icon-button>
          <sonos-icon-button @click=${playPauseHandler} .path=${playPauseIcon} class="big-icon"></sonos-icon-button>
          <sonos-icon-button ?hidden=${!showFastForwardAndRewindButtons} @click=${this.fastForward} .path=${mdiFastForward}></sonos-icon-button>
          <sonos-icon-button ?hidden=${!!hideControlNextTrackButton} @click=${this.next} .path=${mdiSkipNext}></sonos-icon-button>
          <sonos-repeat ?hidden=${!!hideControlRepeatButton} .store=${this.store}></sonos-repeat>
          <sonos-icon-button ?hidden=${!showVolumeUpAndDownButtons || this.touch} @click=${this.volUp} .path=${mdiVolumePlus}></sonos-icon-button>
          <div class="flex-1">
            <sonos-icon-button
              class="browse-button"
              ?hidden=${!showBrowseMediaButton}
              @click=${this.browseMedia}
              .path=${mdiPlayBoxMultiple}
            ></sonos-icon-button>
          </div>
        </div>
        <sonos-volume
          .store=${this.store}
          .player=${volumePlayer}
          .updateMembers=${updateMemberVolumes}
          .isPlayer=${true}
          .touch=${this.touch}
          ?hidden=${!!hideVolume}
        ></sonos-volume>
        <div class="icons">
          <sonos-icon-button ?hidden=${hidePower} @click=${this.togglePower}></sonos-icon-button>
        </div>
      </div>
    `;
  }

  private prev = async () => await this.store.mediaControlService.prev(this.store.activePlayer);
  private play = async () => await this.store.mediaControlService.play(this.store.activePlayer);
  private pauseOrStop = async () => {
    return this.store.config.player?.stopInsteadOfPause
      ? await this.store.mediaControlService.stop(this.store.activePlayer)
      : await this.store.mediaControlService.pause(this.store.activePlayer);
  };
  private next = async () => await this.store.mediaControlService.next(this.store.activePlayer);
  private browseMedia = async () => this.store.mediaBrowseService.showBrowseMedia(this.store.activePlayer, this);
  private togglePower = async () => await this.store.mediaControlService.togglePower(this.store.activePlayer);

  private getVolumePlayer() {
    const volumeEntityId = this.store.config.player?.volumeEntityId;
    if (volumeEntityId) {
      if (this.store.config.allowPlayerVolumeEntityOutsideOfGroup) {
        return findPlayer(this.store.allMediaPlayers, volumeEntityId) ?? this.store.activePlayer;
      }
      return this.store.activePlayer.getMember(volumeEntityId) ?? this.store.activePlayer;
    }
    return this.store.activePlayer;
  }

  private volDown = async () => {
    await this.store.mediaControlService.volumeDown(this.getVolumePlayer(), !this.store.config.player?.volumeEntityId);
  };
  private volUp = async () => {
    await this.store.mediaControlService.volumeUp(this.getVolumePlayer(), !this.store.config.player?.volumeEntityId);
  };
  private rewind = async () => {
    const stepSize = this.store.config.player?.fastForwardAndRewindStepSizeSeconds || 15;
    await this.store.mediaControlService.seek(this.store.activePlayer, this.store.activePlayer.attributes.media_position - stepSize);
  };
  private fastForward = async () => {
    const stepSize = this.store.config.player?.fastForwardAndRewindStepSizeSeconds || 15;
    await this.store.mediaControlService.seek(this.store.activePlayer, this.store.activePlayer.attributes.media_position + stepSize);
  };

  static get styles() {
    return css`
      .main {
        overflow: hidden auto;
      }
      .icons {
        justify-content: center;
        display: flex;
        align-items: center;
      }
      .icons * {
        color: var(--controls-color, inherit);
      }
      [hidden] {
        display: none !important;
      }
      .big-icon {
        --icon-button-size: 5rem;
        --icon-size: 5rem;
      }
      .large-icons sonos-icon-button {
        --icon-size: 3rem;
        --icon-button-size: 4rem;
      }
      .large-icons .big-icon {
        --icon-size: 5rem;
        --icon-button-size: 5rem;
      }
      .touch-icons {
        margin: 0.25rem 0 0.5rem;
        gap: 0.5rem;
      }
      .touch-icons sonos-icon-button,
      .touch-icons sonos-shuffle,
      .touch-icons sonos-repeat {
        --icon-button-size: 3.5rem;
        --icon-size: 2.4rem;
      }
      .touch-icons .big-icon {
        --icon-button-size: 5.5rem;
        --icon-size: 5.5rem;
      }
      .icons.touch-icons sonos-shuffle,
      .icons.touch-icons sonos-repeat {
        color: var(--secondary-text-color);
      }
      .icons.touch-icons sonos-shuffle[active],
      .icons.touch-icons sonos-repeat[active] {
        color: var(--accent-color);
      }
      .flex-1 {
        flex: 1;
      }
      .browse-button {
        float: right;
      }
      .large-icons {
        margin-bottom: 2rem;
      }
    `;
  }
}

customElements.define('sonos-player-controls', PlayerControls);
