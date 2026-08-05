import Phaser from 'phaser';
import type { InputFrame, Vec2 } from '../../game/core/types';
import { clampVector } from '../../game/core/math';

/** Converts pointer and keyboard state into the engine-agnostic simulation input. */
export class GameInputAdapter {
  private physicalPointerDown = false;
  private simulatedPointerDown = false;
  private pointerPosition: Vec2 = { x: 0, y: 0 };
  private readonly pointerEvents: Array<{ type: 'down' | 'move' | 'up'; position: Vec2 }> = [];
  private keyboardSteer: Vec2 = { x: 42, y: 0 };
  private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private readonly wasd: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private readonly deployKey: Phaser.Input.Keyboard.Key;
  private readonly pauseKey: Phaser.Input.Keyboard.Key;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input plugin is unavailable');
    this.cursors = keyboard.createCursorKeys();
    this.wasd = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.deployKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.pauseKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
    scene.game.canvas.addEventListener('contextmenu', this.preventContextMenu);
  }

  poll(delta: number): InputFrame {
    let pointerPressed = false;
    let pointerReleased = false;
    // Drain the entire queue every poll. A 120Hz touchscreen emits pointer
    // events twice as fast as the 60Hz fixed step polls them, so consuming one
    // per poll let the backlog — and the visible lag between finger and rope —
    // grow for the whole gesture until the 64-entry cap started discarding the
    // beginning of the stroke.
    for (let event = this.pointerEvents.shift(); event; event = this.pointerEvents.shift()) {
      this.pointerPosition = event.position;
      if (event.type === 'down') {
        this.simulatedPointerDown = true;
        pointerPressed = true;
      } else if (event.type === 'up') {
        this.simulatedPointerDown = false;
        pointerReleased = true;
      }
    }
    const keyboardPressed = Phaser.Input.Keyboard.JustDown(this.deployKey);
    const keyboardReleased = Phaser.Input.Keyboard.JustUp(this.deployKey);
    const keyboardHeld = this.deployKey.isDown;

    if (keyboardPressed) this.keyboardSteer = { x: 42, y: 0 };
    if (keyboardHeld) {
      const x = Number(this.cursors.right.isDown || this.wasd.right.isDown)
        - Number(this.cursors.left.isDown || this.wasd.left.isDown);
      const y = Number(this.cursors.down.isDown || this.wasd.down.isDown)
        - Number(this.cursors.up.isDown || this.wasd.up.isDown);
      if (x !== 0 || y !== 0) {
        const diagonal = x !== 0 && y !== 0 ? Math.SQRT1_2 : 1;
        this.keyboardSteer.x += x * 270 * diagonal * delta;
        this.keyboardSteer.y += y * 270 * diagonal * delta;
        this.keyboardSteer = clampVector(this.keyboardSteer, 340);
      }
    }

    const frame: InputFrame = {
      deployPressed: pointerPressed || keyboardPressed,
      deployHeld: this.simulatedPointerDown || keyboardHeld,
      deployReleased: pointerReleased || keyboardReleased,
      // Report where the pointer actually is. The simulation clamps it to the
      // rope length, so the needle sits under the finger instead of mirroring
      // it from the anchor. Included on the release frame too, so the snap uses
      // the final position rather than the previous one.
      pointer: this.simulatedPointerDown || pointerReleased ? { ...this.pointerPosition } : null,
      steer: { ...this.keyboardSteer },
      pausePressed: Phaser.Input.Keyboard.JustDown(this.pauseKey)
    };
    return frame;
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.handlePointerUp, this);
    this.scene.game.canvas.removeEventListener('contextmenu', this.preventContextMenu);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!pointer.primaryDown) return;
    this.physicalPointerDown = true;
    this.pointerPosition = { x: pointer.x, y: pointer.y };
    this.pointerEvents.length = 0;
    this.pointerEvents.push({ type: 'down', position: { x: pointer.x, y: pointer.y } });
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.physicalPointerDown) return;
    const position = { x: pointer.x, y: pointer.y };
    const last = this.pointerEvents.at(-1)?.position ?? this.pointerPosition;
    if (Math.hypot(position.x - last.x, position.y - last.y) < 4) return;
    if (this.pointerEvents.length >= 64) {
      const removable = this.pointerEvents.findIndex((event) => event.type === 'move');
      if (removable >= 0) this.pointerEvents.splice(removable, 1);
    }
    this.pointerEvents.push({ type: 'move', position });
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this.physicalPointerDown) return;
    this.physicalPointerDown = false;
    this.pointerEvents.push({ type: 'up', position: { x: pointer.x, y: pointer.y } });
  }

  private readonly preventContextMenu = (event: Event): void => event.preventDefault();
}
