import { Platform, Vibration } from "react-native";

/**
 * Haptic and tactile feedback service for ET Chess mobile.
 * Provides distinct tactile sensations for chess moves, captures, checks,
 * low-clock warnings, and victory/defeat outcomes.
 */
class HapticsService {
  private enabled = true;

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Subtle tick on clean piece drop / quiet move
   */
  public move(): void {
    if (!this.enabled) return;
    try {
      if (Platform.OS === "android") {
        Vibration.vibrate(15);
      } else if (Platform.OS === "ios") {
        Vibration.vibrate([0, 15]);
      }
    } catch {
      // Graceful fallback in simulator or test environment
    }
  }

  /**
   * Crisp, slightly stronger tap on capture
   */
  public capture(): void {
    if (!this.enabled) return;
    try {
      if (Platform.OS === "android") {
        Vibration.vibrate(35);
      } else if (Platform.OS === "ios") {
        Vibration.vibrate([0, 30]);
      }
    } catch {
      // Graceful fallback
    }
  }

  /**
   * Double warning pulse on check
   */
  public check(): void {
    if (!this.enabled) return;
    try {
      Vibration.vibrate([0, 40, 60, 40]);
    } catch {
      // Graceful fallback
    }
  }

  /**
   * Sharp alert pulse for low clock (< 15s)
   */
  public lowTimeWarning(): void {
    if (!this.enabled) return;
    try {
      Vibration.vibrate([0, 50, 40, 50]);
    } catch {
      // Graceful fallback
    }
  }

  /**
   * Game termination feedback
   */
  public gameOver(won: boolean): void {
    if (!this.enabled) return;
    try {
      if (won) {
        // Triumphant pattern
        Vibration.vibrate([0, 60, 40, 60, 40, 120]);
      } else {
        // Single heavy buzz
        Vibration.vibrate(180);
      }
    } catch {
      // Graceful fallback
    }
  }
}

export const haptics = new HapticsService();
