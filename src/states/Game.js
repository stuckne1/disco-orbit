/* globals __DEV__ */
import Planet from '../sprites/Planet';
import Phaser from 'phaser';
import Threshold from '../sprites/Threshold';
import { createSatelliteGroup } from '../managers/SattelitesManager';
import song from '../songs/planets';

const ALLOWED_MISSES = 3;
const SATELLITE_BOUNDING_BOX_Y_OFFSET = -7;
const DEBUG_MODE = false;

const setupSatelliteGroup = (state) => {
    state.satelliteGroup = createSatelliteGroup(state, state.beats, state.thresholdDistance, state.satelliteSpeed);
    state.satelliteGroup.position.y = 13;

    state.game.add.existing(state.satelliteGroup);
    state.game.physics.arcade.enable(state.satelliteGroup);

    // add physics to group
    state.satelliteGroup.enableBody = true;
    state.satelliteGroup.enableBodyDebug = true;
    state.satelliteGroup.physicsBodyType = Phaser.Physics.Arcade;

    // modify bounding box on satellite
    state.satelliteGroup.forEach((s) => {
        s.body.setSize(s.body.width, s.body.height, 0, SATELLITE_BOUNDING_BOX_Y_OFFSET);
    });
};

const setupOrbitalGroup = (state) => {
    state.orbitGroup = new Phaser.Group(state);
    state.game.add.existing(state.orbitGroup);
};

const calculateTwinkle = (bpm) => {
    return (bpm / 60);
};

const setupThresholdEnds = (state) => {
    const end01 = state.add.sprite(16, state.thresholdDistance, 'threshold_end');
    end01.anchor.setTo(0.5);
    end01.animations.add('pulse');
    end01.animations.play('pulse', calculateTwinkle(song.bpm), true);

    const end02 = state.add.sprite(state.world.width - 16, state.thresholdDistance, 'threshold_end');
    end02.anchor.setTo(0.5);
    end02.animations.add('pulse');
    end02.animations.play('pulse', calculateTwinkle(song.bpm), true);
};

const setupThreshold = (state) => {
    const threshold = new Threshold({
        game: state.game,
        x: 0,
        y: state.thresholdDistance
    });
    state.threshold = threshold;
    state.game.add.existing(threshold);
    setupThresholdEnds(state);
};

const setupStaticGraphics = (state) => {
    // Background
    const stars = state.add.tileSprite(0, 0, state.game.world.width, state.game.world.height, 'starry_night');
    stars.animations.add('twinkle');
    stars.animations.play('twinkle', calculateTwinkle(song.bpm), true);

    state.planet = new Planet({
        game: state.game,
        x: state.world.centerX,
        y: 50
    });
    setupThreshold(state);
    state.game.add.existing(state.planet);
    state.game.add.existing(state.threshold);
};

const playMusic = (state) => {
    state.music = state.add.audio(song.id);
    state.musicStartTime = state.game.time.totalElapsedSeconds();
    state.music.play();
};

const explodePlanet = (state) => {
    const planetCenter = {
        x: state.planet.position.x + state.planet.width / 2,
        y: state.planet.position.y + state.planet.height / 2
    };

    state.planet.destroy();
    state.orbitGroup.destroy();
    state.explosion = state.game.add.sprite(0, 0, 'explosion1');

    const explosionPos = {
        x: planetCenter.x - state.explosion.width / 2 - 20,
        y: planetCenter.y - state.explosion.height / 2 - 20
    };

    state.explosion.position.x = explosionPos.x;
    state.explosion.position.y = explosionPos.y;
    state.explosion.animations.add('explode');
    state.explosion.animations.play('explode', 10, false);

    state.explosionSound = state.add.audio('explosion1');
    state.explosionSound.play();
};

const gameOverDetection = (state) => {
    if (state.missCount >= ALLOWED_MISSES && !state.explosion) {
        console.log("game over");
        state.music.stop();
        explodePlanet(state);
    }

    if (state.explosion && state.explosion.animations.currentAnim && state.explosion.animations.currentAnim.isFinished) {
        state.explosion = null;
        state.state.start('Game');
    }
};

const displayMissText = (state) => {
    state.missText.alpha = 1;
    state.game.add.tween(state.missText).to({alpha: 0}, 500, Phaser.Easing.Linear.None, true);
}

const triggerTap = (state) => {
    state.threshold.animations.play('pressed');
    setTimeout(() => state.threshold.animations.play('inactive'), 100);
    if (state.game.physics.arcade.collide(state.threshold, state.satelliteGroup, state.collisionHandler, state.processHandler, state)) {
        return;
    };
    state.missCount++;
    console.log("misscount: " + state.missCount);
    displayMissText(state);
    state.planet.updateHealth(ALLOWED_MISSES - state.missCount);
};

const flyByMissDetection = (state) => {
    state.satelliteGroup.forEach((s) => {
        if (s.body.y < state.threshold.position.y - state.threshold.height && s.missed == false) {
            s.missed = true;
            state.missCount++;
            displayMissText(state);
            console.log("exceeded threshold");
        }
    });
}

export default class extends Phaser.State {
    init () {
        this.beats = song.ticks;
        this.thresholdDistance = 100;
        this.satelliteSpeed = 200;
        this.hitCount = 0;
        this.missCount = 0;
        this.allowSpaceDown = true;
        this.allowPointerDown = true;
    }

    preload () {
    }

    create () {
        setupStaticGraphics(this);
        setupSatelliteGroup(this);
        setupOrbitalGroup(this);
        playMusic(this);

        this.lastFrameTime = this.game.time.totalElapsedSeconds();

        // set-up the physics bodies
        this.game.physics.startSystem(Phaser.Physics.ARCADE);
        this.game.physics.arcade.enable(this.threshold);

        // register the enter key
        this.spaceKey = this.game.input.keyboard.addKey(Phaser.Keyboard.SPACEBAR);

        // stop this key from propagating up to the browser
        this.game.input.keyboard.addKeyCapture([Phaser.Keyboard.SPACEBAR]);

        // setup callbacks
        this.game.input.keyboard.addCallbacks(this, this.keyDown, this.keyReleased, null);

        this.missText = this.add.text(this.world.centerX, this.world.centerY + 30, 'Miss!', {
            font: '28px Arial',
            fill: '#dddddd',
            align: 'center'
        });
        this.missText.anchor.setTo(0.5, 0.5);

        this.missText.alpha = 0;
    }

    render () {
        if (DEBUG_MODE) {
            this.game.debug.body(this.threshold);
            this.game.debug.body(this.planet);
            this.satelliteGroup.forEach((a) => {
                this.game.debug.body(a)
            });
        }
    }

    keyDown (key) {
        if (key.code == 'Space' && this.allowSpaceDown) {
            this.allowKeyDown = false;
            triggerTap(this);
        }
    }

    keyReleased (key) {
        if (key.code == 'Space') {
            this.allowKeyDown = true;
        }
    }

    update () {
        // Update satellite group
        const delta = this.game.time.totalElapsedSeconds() - this.lastFrameTime;
        this.satelliteGroup.position.y -= this.satelliteSpeed * delta;
        this.lastFrameTime = this.game.time.totalElapsedSeconds();

        if (this.game.input.activePointer.isDown && this.allowPointerDown) {
            triggerTap(this);
            this.allowPointerDown = false;
        }

        if (this.game.input.activePointer.isUp) {
            this.allowPointerDown = true;
        }

        flyByMissDetection(this);
        gameOverDetection(this);
    }

    processHandler (threshold, satellite) {
        return true;
    }

    collisionHandler (threshold, satellite) {
        this.hitCount++;

        // Update orbit
        const orbitGroup = this.orbitGroup;
        const planet = this.planet;
        const satGroup = this.satelliteGroup;
        const toRemove = [];
        toRemove.push(satellite);

        toRemove.forEach((satellite) => {
            satGroup.remove(satellite);
            satellite.enterOrbit(planet);
            orbitGroup.add(satellite);
        });

        console.log('thresholdhits: ' + this.hitCount);
    }

    getTick () {
        return this.game.time.totalElapsedSeconds() - this.musicStartTime;
    }
}
