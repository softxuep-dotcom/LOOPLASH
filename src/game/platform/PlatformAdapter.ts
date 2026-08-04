export interface PlatformAdapter {
  loadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  measure(category: string, what: string, action: string): void;
}

export class LocalPlatformAdapter implements PlatformAdapter {
  private playing = false;

  loadingFinished(): void {
    console.info('[platform] loading finished');
  }

  gameplayStart(): void {
    if (this.playing) return;
    this.playing = true;
    console.info('[platform] gameplay start');
  }

  gameplayStop(): void {
    if (!this.playing) return;
    this.playing = false;
    console.info('[platform] gameplay stop');
  }

  measure(category: string, what: string, action: string): void {
    console.info('[measure]', category, what, action);
  }
}
