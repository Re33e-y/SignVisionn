/**
 * Semantic abstraction layer mapping low-level gestures to high-level UI intents.
 */
export enum Intent {
  IDLE = 'IDLE',
  DISCOVER = 'DISCOVER',
  LAUNCH = 'LAUNCH',
  CONNECT = 'CONNECT',
  DISMISS = 'DISMISS',
  UNKNOWN = 'UNKNOWN'
}

export class IntentMapper {
  private gestureMap: Record<string, Intent> = {
    'Open_Palm': Intent.DISCOVER,
    'Victory': Intent.LAUNCH,
    'Pointing_Up': Intent.CONNECT,
    'Thumb_Up': Intent.LAUNCH,
    'Thumb_Down': Intent.DISMISS,
    'Closed_Fist': Intent.DISMISS,
    'ILoveYou': Intent.CONNECT,
    'None': Intent.IDLE
  };

  map(gesture: string | null): Intent {
    if (!gesture || gesture === 'None') return Intent.IDLE;
    return this.gestureMap[gesture] || Intent.UNKNOWN;
  }
}
