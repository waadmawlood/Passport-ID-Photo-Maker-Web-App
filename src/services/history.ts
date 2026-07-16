export interface HistoryState {
  originalImage: string | null;
  processedImage: string | null;
  croppedImage: string | null;
  brightness: number;
  contrast: number;
  rotation: number;
  imageTransform: { left: number; top: number; scaleX: number; scaleY: number; angle: number } | null;
}

export class HistoryManager {
  private stack: HistoryState[] = [];
  private index: number = -1;
  private maxSize: number = 50;
  private isLoading: boolean = false;

  push(state: HistoryState) {
    if (this.isLoading) return;

    // Remove any future states if we're not at the end
    if (this.index < this.stack.length - 1) {
      this.stack = this.stack.slice(0, this.index + 1);
    }

    // Add new state
    this.stack.push({ ...state });

    // Cap the stack size
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    } else {
      this.index++;
    }
  }

  undo(): HistoryState | null {
    if (this.index <= 0) return null;

    this.isLoading = true;
    this.index--;
    const state = { ...this.stack[this.index] };
    this.isLoading = false;

    return state;
  }

  redo(): HistoryState | null {
    if (this.index >= this.stack.length - 1) return null;

    this.isLoading = true;
    this.index++;
    const state = { ...this.stack[this.index] };
    this.isLoading = false;

    return state;
  }

  canUndo(): boolean {
    return this.index > 0;
  }

  canRedo(): boolean {
    return this.index < this.stack.length - 1;
  }

  clear() {
    this.stack = [];
    this.index = -1;
  }
}