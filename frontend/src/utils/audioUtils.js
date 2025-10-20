// Audio utility for barcode scanning feedback
class AudioFeedback {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    
    // Initialize Web Audio API
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      this.enabled = false;
    }
  }

  // Create a simple beep sound programmatically
  createBeep(frequency, duration, type = 'sine') {
    if (!this.audioContext || !this.enabled) return Promise.resolve();

    return new Promise((resolve) => {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.type = type;

      // Volume envelope - Volumen aumentado para mayor intensidad
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.7, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);

      oscillator.onended = resolve;
    });
  }

  // Success sound: Higher pitch, pleasant tone
  async playSuccess() {
    if (!this.enabled) return;
    
    try {
      // Resume audio context if needed (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Play a pleasant success tone (two beeps: high-low)
      await this.createBeep(800, 0.15); // High note
      setTimeout(() => {
        this.createBeep(600, 0.2); // Lower note
      }, 100);
      
    } catch (error) {
      console.warn('Error playing success sound:', error);
    }
  }

  // Error sound: Lower pitch, warning tone
  async playError() {
    if (!this.enabled) return;
    
    try {
      // Resume audio context if needed
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Play a warning tone (three quick beeps)
      await this.createBeep(400, 0.1); // Low warning tone
      setTimeout(() => {
        this.createBeep(400, 0.1);
      }, 150);
      setTimeout(() => {
        this.createBeep(400, 0.15);
      }, 300);
      
    } catch (error) {
      console.warn('Error playing error sound:', error);
    }
  }

  // Already scanned sound: DANGER/ALERT tone - muy fuerte para alertar
  async playAlreadyScanned() {
    if (!this.enabled) return;
    
    try {
      // Resume audio context if needed
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // ⚠️ SONIDO DE ALERTA CRÍTICA - Secuencia de sonidos de PELIGRO ⚠️
      // Tres tonos bajos y agresivos muy rápidos - como alarma de error
      await this.createBeep(300, 0.15, 'sawtooth'); // Tono bajo y áspero
      setTimeout(() => {
        this.createBeep(320, 0.15, 'sawtooth'); // Segundo tono áspero
      }, 100);
      setTimeout(() => {
        this.createBeep(280, 0.25, 'sawtooth'); // Tercer tono más largo y grave
      }, 200);
      setTimeout(() => {
        // Cuarto beep final más agudo para captar atención
        this.createBeep(400, 0.2, 'square');
      }, 400);
      
    } catch (error) {
      console.warn('Error playing already scanned sound:', error);
    }
  }

  // Progress sound: For multi-unit counting
  async playProgress() {
    if (!this.enabled) return;
    
    try {
      // Resume audio context if needed
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Play a short progress beep
      await this.createBeep(700, 0.08);
      
    } catch (error) {
      console.warn('Error playing progress sound:', error);
    }
  }

  // Complete sound: For finished multi-unit scanning
  async playComplete() {
    if (!this.enabled) return;
    
    try {
      // Resume audio context if needed
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Play a completion tone (ascending notes)
      await this.createBeep(600, 0.1);
      setTimeout(() => {
        this.createBeep(750, 0.1);
      }, 120);
      setTimeout(() => {
        this.createBeep(900, 0.15);
      }, 240);
      
    } catch (error) {
      console.warn('Error playing complete sound:', error);
    }
  }

  // Toggle sound system on/off
  toggleEnabled() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // Get current status
  isEnabled() {
    return this.enabled && this.audioContext !== null;
  }
}

// Create singleton instance
const audioFeedback = new AudioFeedback();

export default audioFeedback;
