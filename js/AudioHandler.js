export class AudioHandler {
    constructor() {
        this.bgm = null;
        this.tracks = {
            1: 'bgm/talking.mp3',
            2: 'bgm/disapeareance.mp3'
        };
    }

    playMusic(level) {
        // Stop current music if playing
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }

        const track = this.tracks[level];
        if (track) {
            this.bgm = new Audio(track);
            this.bgm.loop = true;
            this.bgm.volume = 0.4;
            
            // Attempt to play
            this.bgm.play().catch(e => {
                console.warn(`Failed to play music for level ${level}:`, e);
            });
        } else {
            console.log(`No music track defined for level ${level}`);
        }
    }

    stopMusic() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
    }

    fadeOut(duration = 500) {
        if (!this.bgm) return;

        const startVolume = this.bgm.volume;
        const startTime = Date.now();

        const fade = () => {
            // Check if bgm still exists (might have been stopped/replaced)
            if (!this.bgm) return;

            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Linear fade
            this.bgm.volume = Math.max(0, startVolume * (1 - progress));

            if (progress < 1) {
                requestAnimationFrame(fade);
            } else {
                this.stopMusic();
                // Reset volume for next play isn't strictly necessary as playMusic creates new Audio,
                // but good practice if we were reusing the object.
            }
        };

        fade();
    }
}