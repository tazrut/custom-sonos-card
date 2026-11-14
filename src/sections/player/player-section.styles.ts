import { css } from 'lit';

export const playerSectionStyles = css`
  .container {
    position: relative;
    display: grid;
    grid-template-columns: 100%;
    grid-template-rows: min-content auto min-content;
    grid-template-areas:
      'header'
      'artwork'
      'controls';
    min-height: 100%;
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
  }

  .container.blurred-background {
    background: none;
    isolation: isolate;
    overflow: hidden;
  }

  .container.blurred-background::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: var(--blur-background-image);
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    filter: blur(var(--blur-amount));
    transform: scale(1.1);
    z-index: -1;
  }

  .header {
    grid-area: header;
    margin: 0.75rem 1.25rem;
    padding: 0.5rem;
    position: relative;
  }

  .controls {
    grid-area: controls;
    overflow-y: auto;
    margin: 0.25rem;
    padding: 0.5rem;
    position: relative;
  }

  .artwork {
    grid-area: artwork;
    align-self: center;
    flex-grow: 1;
    flex-shrink: 0;
    width: 100%;
    height: 100%;
    min-height: 5rem;
    background-position: center;
    background-repeat: no-repeat;
    background-size: contain;
    position: relative;
  }

  .container.touch {
    /* the artwork is a square sized from the width, shrunk when the card is too short; spare height is spread evenly */
    container-type: size;
    align-content: space-evenly;
    grid-template-rows: auto auto auto auto;
    grid-template-areas:
      'speaker'
      'artwork'
      'header'
      'controls';
    height: 100%;
    box-sizing: border-box;
  }
  .touch .speaker {
    grid-area: speaker;
    text-align: center;
    padding: 0.6rem 1rem 0.4rem;
    font-size: calc(var(--sonos-font-size, 1rem) * 0.9);
    font-weight: 500;
    color: var(--secondary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .touch .artwork {
    justify-self: center;
    align-self: center;
    width: max(8rem, min(100% - 1.5rem, 100cqh - 22rem));
    height: auto;
    aspect-ratio: 1;
    min-height: 0 !important;
  }
  .touch .header {
    margin: 0.6rem 0.75rem 0;
    padding: 0.25rem 0.5rem;
  }
  .touch .controls {
    margin: 0 0.25rem 0.25rem;
    padding: 0.25rem 0.5rem 0.5rem;
    overflow: visible;
  }

  [hidden] {
    display: none !important;
  }

  *[background] {
    background-color: var(--background-overlay-color, rgba(var(--rgb-card-background-color), var(--background-opacity, 0.9)));
    border-radius: 10px;
  }
`;
