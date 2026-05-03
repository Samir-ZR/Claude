// 3D world: terrain, plots, conveyors, stands, brainrot meshes.
// Uses server-provided world coordinates for stands so positions match exactly.

import * as THREE from 'three';

export class World {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.Fog(0x87ceeb, 80, 180);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.far = 200;
    this.scene.add(sun);

    // Ground
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(70, 48),
      new THREE.MeshLambertMaterial({ color: 0x7cb342 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Decorative ring + low fence
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(64, 70, 64),
      new THREE.MeshBasicMaterial({ color: 0x5d8a30, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.scene.add(ring);
    const fence = new THREE.Mesh(
      new THREE.TorusGeometry(60, 0.4, 8, 64),
      new THREE.MeshLambertMaterial({ color: 0x4a3826 })
    );
    fence.rotation.x = Math.PI / 2;
    fence.position.y = 0.4;
    this.scene.add(fence);

    // Decorative center plaza
    const plaza = new THREE.Mesh(
      new THREE.CylinderGeometry(6, 6, 0.3, 24),
      new THREE.MeshLambertMaterial({ color: 0xcbd5e1 })
    );
    plaza.position.y = 0.15;
    this.scene.add(plaza);

    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(
        new THREE.SphereGeometry(3 + Math.random() * 2, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })
      );
      const a = Math.random() * Math.PI * 2;
      c.position.set(Math.cos(a) * 50, 25 + Math.random() * 8, Math.sin(a) * 50);
      this.scene.add(c);
    }

    this.plotMeshes = [];
    this.playerMeshes = new Map();
    this.catalog = [];
    this.rarities = {};
  }

  setCatalog(catalog, rarities) {
    this.catalog = catalog;
    this.rarities = rarities;
  }

  // Compute conveyor geometry from cx,cz,angle (matches server's stand layout axes)
  // Outward axis: (cos(a), sin(a)). Tangential: (-sin(a), cos(a)).
  // Conveyor sits at outward*-6 (near map center) and runs tangentially ±9.
  conveyorGeometry(plot) {
    const a = plot.angle;
    const outX = Math.cos(a), outZ = Math.sin(a);
    const tanX = -Math.sin(a), tanZ = Math.cos(a);
    const cx = plot.cx + outX * -6;
    const cz = plot.cz + outZ * -6;
    return {
      cx, cz,
      tanX, tanZ,
      length: 18,
      // start = tangential -9, end = +9
      startX: cx + tanX * -9, startZ: cz + tanZ * -9,
      endX: cx + tanX * 9, endZ: cz + tanZ * 9
    };
  }

  buildPlots(plots) {
    const plotColors = [0x60a5fa, 0xf472b6, 0xfacc15, 0x4ade80];

    for (const plot of plots) {
      const baseColor = plotColors[plot.index % plotColors.length];
      const a = plot.angle;

      // Floor (rotated to align with plot axes)
      const floor = new THREE.Mesh(
        new THREE.BoxGeometry(14, 0.4, 16),
        new THREE.MeshLambertMaterial({ color: baseColor })
      );
      floor.position.set(plot.cx, 0.2, plot.cz);
      floor.rotation.y = -a + Math.PI / 2;
      floor.receiveShadow = true;
      this.scene.add(floor);

      // Conveyor
      const cv = this.conveyorGeometry(plot);
      const belt = new THREE.Mesh(
        new THREE.BoxGeometry(cv.length, 0.5, 1.6),
        new THREE.MeshLambertMaterial({ color: 0x1f2937 })
      );
      belt.position.set(cv.cx, 0.5, cv.cz);
      belt.rotation.y = -a + Math.PI / 2;
      this.scene.add(belt);
      // Stripes
      for (let i = 0; i < 6; i++) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(0.4, 0.05, 1.4),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        const p = -7.5 + i * 3;
        stripe.position.set(cv.cx + cv.tanX * p, 0.78, cv.cz + cv.tanZ * p);
        stripe.rotation.y = -a + Math.PI / 2;
        this.scene.add(stripe);
      }

      // Stand pads
      const standMeshes = [];
      for (let s = 0; s < plot.stands.length; s++) {
        const sd = plot.stands[s];
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.9, 1.0, 0.3, 16),
          new THREE.MeshLambertMaterial({ color: 0x334155 })
        );
        pad.position.set(sd.x, 0.55, sd.z);
        pad.castShadow = true;
        pad.receiveShadow = true;
        this.scene.add(pad);
        standMeshes.push({ pad, brainrotMesh: null, brainrotIdx: null, x: sd.x, z: sd.z });
      }

      // Sign on outside corner
      const outX = Math.cos(a), outZ = Math.sin(a);
      const sx = plot.cx + outX * 7;
      const sz = plot.cz + outZ * 7;
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 3, 0.2),
        new THREE.MeshLambertMaterial({ color: 0x6b3f16 })
      );
      post.position.set(sx, 1.5, sz);
      this.scene.add(post);

      // Lock indicator dome
      const lockDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.7 })
      );
      lockDome.position.set(sx, 3.2, sz);
      this.scene.add(lockDome);

      // Owner name sprite (above sign)
      const ownerSprite = makeTextSprite('Vide', baseColor);
      ownerSprite.position.set(sx, 4.0, sz);
      ownerSprite.scale.set(4, 1.6, 1);
      this.scene.add(ownerSprite);

      this.plotMeshes.push({
        plotInfo: plot,
        baseColor,
        cv,
        stands: standMeshes,
        conveyorItems: new Map(),
        lockDome,
        ownerSprite,
        ownerName: null,
        ownerColorHex: baseColor
      });
    }
  }

  makeBrainrotMesh(brainrotIdx, scale = 1) {
    const data = this.catalog[brainrotIdx];
    if (!data) return new THREE.Group();

    const group = new THREE.Group();
    const rarityColor = this.rarities[data.rarity]?.color || 0xffffff;

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.45, 0.7, 12),
      new THREE.MeshLambertMaterial({ color: rarityColor })
    );
    body.position.y = 0.35;
    body.castShadow = true;
    group.add(body);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 16, 12),
      new THREE.MeshLambertMaterial({ color: data.color })
    );
    head.position.y = 1.0;
    head.castShadow = true;
    group.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (const dx of [-0.15, 0.15]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
      eye.position.set(dx, 1.05, 0.38);
      group.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), pupilMat);
      pupil.position.set(dx, 1.05, 0.46);
      group.add(pupil);
    }

    if (data.rarity !== 'common') {
      const ant = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.4, 6),
        new THREE.MeshLambertMaterial({ color: rarityColor })
      );
      ant.position.y = 1.6;
      group.add(ant);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: rarityColor })
      );
      tip.position.y = 1.85;
      group.add(tip);
    }

    const label = makeTextSprite(`${data.name}\n$${data.income}/s`, rarityColor);
    label.position.y = 2.3;
    label.scale.set(2.6, 1.3, 1);
    group.add(label);

    group.scale.setScalar(scale);
    return group;
  }

  updateConveyor(plotMesh, conveyorItems) {
    const seen = new Set();
    const cv = plotMesh.cv;
    for (const item of conveyorItems) {
      seen.add(item.id);
      let mesh = plotMesh.conveyorItems.get(item.id);
      if (!mesh) {
        mesh = this.makeBrainrotMesh(item.brainrot, 0.7);
        this.scene.add(mesh);
        plotMesh.conveyorItems.set(item.id, mesh);
      }
      // Position: progress 0..1 from start to end
      const t = item.progress;
      const x = cv.startX + (cv.endX - cv.startX) * t;
      const z = cv.startZ + (cv.endZ - cv.startZ) * t;
      mesh.position.set(x, 0.85, z);
      mesh.rotation.y = performance.now() * 0.002;
      // Cache world position for interaction
      mesh.userData.itemId = item.id;
      mesh.userData.brainrot = item.brainrot;
    }
    for (const [id, mesh] of plotMesh.conveyorItems) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        plotMesh.conveyorItems.delete(id);
      }
    }
  }

  updateStands(plotMesh, stands) {
    for (let i = 0; i < stands.length; i++) {
      const st = plotMesh.stands[i];
      const data = stands[i];
      if (data.brainrot == null && st.brainrotMesh) {
        this.scene.remove(st.brainrotMesh);
        st.brainrotMesh = null;
        st.brainrotIdx = null;
      } else if (data.brainrot != null && st.brainrotIdx !== data.brainrot) {
        if (st.brainrotMesh) this.scene.remove(st.brainrotMesh);
        const m = this.makeBrainrotMesh(data.brainrot, 1);
        m.position.set(st.x, 0.7, st.z);
        this.scene.add(m);
        st.brainrotMesh = m;
        st.brainrotIdx = data.brainrot;
      }
      if (st.brainrotMesh) {
        st.brainrotMesh.rotation.y = performance.now() * 0.0008 + i;
      }
    }
  }

  updateLock(plotMesh, locked) {
    plotMesh.lockDome.material.color.setHex(locked ? 0xef4444 : 0x22c55e);
  }

  setOwner(plotMesh, name) {
    if (plotMesh.ownerName === name) return;
    plotMesh.ownerName = name;
    const pos = plotMesh.ownerSprite.position.clone();
    this.scene.remove(plotMesh.ownerSprite);
    plotMesh.ownerSprite = makeTextSprite(name || 'Libre', plotMesh.baseColor);
    plotMesh.ownerSprite.position.copy(pos);
    plotMesh.ownerSprite.scale.set(4, 1.6, 1);
    this.scene.add(plotMesh.ownerSprite);
  }

  upsertPlayer(p) {
    let entry = this.playerMeshes.get(p.id);
    if (!entry) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.4, 0.9, 4, 8),
        new THREE.MeshLambertMaterial({ color: 0x60a5fa })
      );
      body.position.y = 0.85;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 12),
        new THREE.MeshLambertMaterial({ color: 0xfde68a })
      );
      head.position.y = 1.7;
      head.castShadow = true;
      group.add(head);
      const label = makeTextSprite(p.name || '?', 0xffffff);
      label.position.y = 2.4;
      label.scale.set(2.4, 1.0, 1);
      group.add(label);
      this.scene.add(group);
      entry = { group, label, name: p.name };
      this.playerMeshes.set(p.id, entry);
    }
    if (entry.name !== p.name) {
      entry.group.remove(entry.label);
      entry.label = makeTextSprite(p.name || '?', 0xffffff);
      entry.label.position.y = 2.4;
      entry.label.scale.set(2.4, 1.0, 1);
      entry.group.add(entry.label);
      entry.name = p.name;
    }
    const lerp = 0.3;
    entry.group.position.x += (p.x - entry.group.position.x) * lerp;
    entry.group.position.y += (p.y - entry.group.position.y) * lerp;
    entry.group.position.z += (p.z - entry.group.position.z) * lerp;
    let dr = p.ry - entry.group.rotation.y;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    entry.group.rotation.y += dr * lerp;
  }

  removePlayer(id) {
    const entry = this.playerMeshes.get(id);
    if (entry) {
      this.scene.remove(entry.group);
      this.playerMeshes.delete(id);
    }
  }
}

function makeTextSprite(text, colorHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  roundRect(ctx, 4, 4, 248, 120, 14);
  ctx.fill();
  ctx.strokeStyle = `#${colorHex.toString(16).padStart(6, '0')}`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = String(text).split('\n');
  ctx.font = `700 ${lines.length === 1 ? 36 : 28}px system-ui, sans-serif`;
  const lh = lines.length === 1 ? 0 : 30;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], 128, 64 + (i - (lines.length - 1) / 2) * lh);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  return new THREE.Sprite(mat);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
