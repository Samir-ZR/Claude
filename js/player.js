// First-person player controller with pointer lock.

import * as THREE from 'three';

const SPEED_WALK = 6;
const SPEED_RUN = 10;
const JUMP_VEL = 7;
const GRAVITY = 22;
const EYE_HEIGHT = 1.7;
const MAP_RADIUS = 60;

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.position = new THREE.Vector3(0, EYE_HEIGHT, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;

    this.keys = new Set();
    this.locked = false;
    this.knockback = new THREE.Vector3();
    this.knockbackTime = 0;

    this._bindInput();
    this._syncCamera();
  }

  setPosition(x, y, z, ry = 0) {
    this.position.set(x, y + EYE_HEIGHT, z);
    this.yaw = ry;
    this.pitch = 0;
    this.velocity.set(0, 0, 0);
    this._syncCamera();
  }

  applyKnockback(x, z) {
    this.knockback.set(x, 0, z);
    this.knockbackTime = 0.4;
  }

  _bindInput() {
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyL' && this.onLockToggle) this.onLockToggle();
      if (e.code === 'KeyF' && this.onKick) this.onKick();
    });
    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0025;
      this.pitch -= e.movementY * 0.0025;
      this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    this.dom.addEventListener('click', () => {
      if (!this.locked) this.dom.requestPointerLock();
    });
  }

  _syncCamera() {
    this.camera.position.copy(this.position);
    const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(e);
  }

  isMoving() {
    const k = this.keys;
    return k.has('KeyW') || k.has('ArrowUp') || k.has('KeyZ') ||
           k.has('KeyS') || k.has('ArrowDown') ||
           k.has('KeyA') || k.has('ArrowLeft') || k.has('KeyQ') ||
           k.has('KeyD') || k.has('ArrowRight');
  }

  update(dt) {
    const k = this.keys;
    const forward = (k.has('KeyW') || k.has('ArrowUp') || k.has('KeyZ') ? 1 : 0) -
                    (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) -
                   (k.has('KeyA') || k.has('ArrowLeft') || k.has('KeyQ') ? 1 : 0);
    const running = k.has('ShiftLeft') || k.has('ShiftRight');
    const speed = running ? SPEED_RUN : SPEED_WALK;

    // Movement basis from yaw
    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    let dx = 0, dz = 0;
    if (forward || strafe) {
      const len = Math.hypot(forward, strafe) || 1;
      const fx = -sin * (forward / len);
      const fz = -cos * (forward / len);
      const sx = cos * (strafe / len);
      const sz = -sin * (strafe / len);
      dx = (fx + sx) * speed;
      dz = (fz + sz) * speed;
    }

    // Knockback override
    if (this.knockbackTime > 0) {
      this.knockbackTime -= dt;
      dx = this.knockback.x;
      dz = this.knockback.z;
    }

    this.velocity.x = dx;
    this.velocity.z = dz;

    // Gravity / jump
    if (k.has('Space') && this.onGround) {
      this.velocity.y = JUMP_VEL;
      this.onGround = false;
    }
    this.velocity.y -= GRAVITY * dt;

    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;
    this.position.y += this.velocity.y * dt;

    if (this.position.y <= EYE_HEIGHT) {
      this.position.y = EYE_HEIGHT;
      this.velocity.y = 0;
      this.onGround = true;
    }

    // Map bounds
    const r = Math.hypot(this.position.x, this.position.z);
    if (r > MAP_RADIUS) {
      this.position.x *= MAP_RADIUS / r;
      this.position.z *= MAP_RADIUS / r;
    }

    this._syncCamera();
  }

  // Network-friendly state
  netState() {
    return {
      x: this.position.x,
      y: Math.max(0, this.position.y - EYE_HEIGHT),
      z: this.position.z,
      ry: this.yaw,
      anim: this.isMoving() ? (this.keys.has('ShiftLeft') ? 'run' : 'walk') : 'idle'
    };
  }
}
