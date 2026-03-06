export class AudioHandler {
    constructor() {
        this.bgm = null;
        this.tracks = {
            1: 'bgm/talking.mp3',
            2: 'bgm/disapeareance.mp3'
        };
        this.fadeInterval = null;
    }

    playMusic(level) {
        // Stop current music if playing
        this.stopMusic();

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
        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
            this.fadeInterval = null;
        }
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
    }

    fadeOutMusic(duration = 1000) {
        if (!this.bgm || this.bgm.paused) return;

        const startVolume = this.bgm.volume;
        const steps = 50;
        const stepTime = duration / steps;
        const stepSize = startVolume / steps;

        if (this.fadeInterval) {
            clearInterval(this.fadeInterval);
        }

        this.fadeInterval = setInterval(() => {
            if (this.bgm.volume > stepSize) {
                this.bgm.volume -= stepSize;
            } else {
                this.stopMusic();
            }
        }, stepTime);
    }
}