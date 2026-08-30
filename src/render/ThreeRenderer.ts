import * as THREE from "three";
import type { FrameSnapshot, IRenderer } from "./types";

const ROAD_WIDTH = 10.8;
const ROAD_TILE_LENGTH = 12;
const ROAD_TILE_COUNT = 18;
const WORLD_FRONT = 18;
const WORLD_BACK = WORLD_FRONT - ROAD_TILE_LENGTH * ROAD_TILE_COUNT;
const GATE_FAR_Z = -46;
const GATE_NEAR_Z = 0.2;
const PLAYER_Z = 0.2;

const PALETTE = {
  day: new THREE.Color("#83d9d1"),
  grass: 0x79bd67,
  grassDark: 0x55a263,
  road: 0xd8b78c,
  roadSide: 0xf0d9aa,
  cream: 0xfff5d7,
  brown: 0x6f4d31,
  coral: 0xef9368,
  mint: 0x65d1bc,
  yellow: 0xffd45b,
};

export class ThreeRenderer implements IRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 260);
  private readonly world = new THREE.Group();
  private readonly roadTiles: THREE.Group[] = [];
  private readonly trees: THREE.Group[] = [];
  private readonly clouds: THREE.Group[] = [];
  private readonly mountains = new THREE.Group();
  private readonly gateRoot = new THREE.Group();
  private readonly player = new THREE.Group();
  private readonly glassMaterials: THREE.MeshStandardMaterial[] = [];
  private readonly labelTextures: THREE.Texture[] = [];
  private readonly sunMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.yellow, fog: false });
  private readonly cloudMaterial = new THREE.MeshStandardMaterial({
    color: 0xfffdf0,
    roughness: 0.95,
    transparent: true,
    opacity: 0.86,
  });
  private readonly markerGeometry = new THREE.BoxGeometry(0.09, 0.035, 1.35);
  private readonly markerMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.9 });
  private readonly hemi = new THREE.HemisphereLight(0xdafcff, 0x56724e, 2.2);
  private readonly sunLight = new THREE.DirectionalLight(0xfff0bd, 2.8);
  private readonly sun = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48), this.sunMaterial);
  private elapsed = 0;
  private lastFrameAt = performance.now();
  private worldDistance = 0;
  private currentLanes = 0;
  private gateKey = "";
  private resolvingSince: number | null = null;
  private lastLives = 3;
  private shake = 0;
  private cssWidth = 1;
  private cssHeight = 1;

  mount(canvas: HTMLCanvasElement): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene.background = PALETTE.day.clone();
    this.scene.fog = new THREE.Fog(PALETTE.day.clone(), 45, 175);
    this.scene.add(this.world, this.gateRoot, this.player, this.hemi, this.sunLight, this.sun);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 26;
    this.sunLight.shadow.camera.bottom = -8;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 100;
    this.sunLight.target.position.set(0, 0, -25);
    this.scene.add(this.sunLight.target);

    this.buildGround();
    this.buildRoad();
    this.buildTrees();
    this.buildMountains();
    this.buildClouds();
    this.buildPlayer();
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    if (!this.renderer) return;
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    this.renderer.setPixelRatio(Math.min(dpr, 1.7));
    this.renderer.setSize(cssWidth, cssHeight, false);
    this.camera.aspect = cssWidth / Math.max(1, cssHeight);
    this.camera.fov = this.camera.aspect < 0.72 ? 57 : 48;
    this.camera.updateProjectionMatrix();
  }

  render(snapshot: FrameSnapshot): void {
    if (!this.renderer) return;
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;
    this.elapsed += dt;

    const active = snapshot.phase === "playing" || snapshot.phase === "resolving";
    if (active) this.worldDistance += dt * 13.5;
    if (snapshot.hud.lives < this.lastLives) this.shake = 0.2;
    this.lastLives = snapshot.hud.lives;
    this.shake *= Math.pow(0.06, dt);

    if (snapshot.lanes !== this.currentLanes) this.updateLaneMarkers(snapshot.lanes);
    this.updateWorld(snapshot, dt);
    this.updateGate(snapshot);
    this.updatePlayer(snapshot);
    this.updateDayCycle(snapshot);
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.labelTextures.forEach((texture) => texture.dispose());
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.renderer?.dispose();
    this.renderer = null;
  }

  private buildGround(): void {
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(90, 1.2, 240),
      new THREE.MeshStandardMaterial({ color: PALETTE.grass, roughness: 1 }),
    );
    ground.position.set(0, -0.75, -96);
    ground.receiveShadow = true;
    this.world.add(ground);

    const vergeMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.grassDark, roughness: 1 });
    for (const side of [-1, 1]) {
      const verge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.25, 240), vergeMaterial);
      verge.position.set(side * (ROAD_WIDTH / 2 + 0.55), -0.08, -96);
      verge.receiveShadow = true;
      this.world.add(verge);
    }
  }

  private buildRoad(): void {
    const roadLength = 240;
    const roadCenterZ = -96;
    const roadGeometry = new THREE.BoxGeometry(ROAD_WIDTH, 0.42, roadLength);
    const roadMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.road, roughness: 0.92 });
    const edgeGeometry = new THREE.BoxGeometry(0.32, 0.16, roadLength);
    const edgeMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.roadSide, roughness: 0.88 });

    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.position.set(0, -0.18, roadCenterZ);
    road.receiveShadow = true;
    this.world.add(road);
    for (const side of [-1, 1]) {
      const edge = new THREE.Mesh(edgeGeometry, edgeMaterial);
      edge.position.set(side * (ROAD_WIDTH / 2 + 0.15), 0.01, roadCenterZ);
      edge.receiveShadow = true;
      this.world.add(edge);
    }

    for (let i = 0; i < ROAD_TILE_COUNT; i++) {
      const tile = new THREE.Group();
      tile.userData.index = i;
      const markers = new THREE.Group();
      markers.name = "lane-markers";
      tile.add(markers);
      this.roadTiles.push(tile);
      this.world.add(tile);
    }
  }

  private updateLaneMarkers(lanes: number): void {
    this.currentLanes = lanes;
    for (const tile of this.roadTiles) {
      const markers = tile.getObjectByName("lane-markers");
      if (!(markers instanceof THREE.Group)) continue;
      markers.clear();
      for (let lane = 1; lane < lanes; lane++) {
        const x = -ROAD_WIDTH / 2 + (ROAD_WIDTH * lane) / lanes;
        for (const z of [-4.5, -1.5, 1.5, 4.5]) {
          const dash = new THREE.Mesh(this.markerGeometry, this.markerMaterial);
          dash.position.set(x, 0.06, z);
          dash.receiveShadow = true;
          markers.add(dash);
        }
      }
    }
  }

  private buildTrees(): void {
    for (let i = 0; i < 30; i++) {
      const tree = new THREE.Group();
      tree.userData.index = i;
      tree.userData.baseZ = -8 - i * 7.2;
      tree.userData.side = hash01(i * 17.3) < 0.5 ? -1 : 1;
      tree.userData.offset = 1.7 + hash01(i * 9.7) * 5.2;
      const scale = 0.72 + hash01(i * 31.1) * 0.62;
      tree.scale.setScalar(scale);

      const trunk = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 1.7, 0.52),
        new THREE.MeshStandardMaterial({ color: 0x8b6442, roughness: 1 }),
      );
      trunk.position.y = 0.85;
      trunk.castShadow = true;
      tree.add(trunk);

      const crownMaterial = new THREE.MeshStandardMaterial({
        color: i % 3 === 0 ? 0x50a76a : 0x61b777,
        roughness: 0.94,
      });
      for (const [x, y, z, size] of [
        [0, 2.25, 0, 1.55],
        [-0.72, 1.85, 0.08, 1.15],
        [0.72, 1.82, -0.04, 1.18],
        [0, 2.85, -0.06, 1.08],
      ] as const) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), crownMaterial);
        block.position.set(x, y, z);
        block.castShadow = true;
        tree.add(block);
      }
      this.trees.push(tree);
      this.world.add(tree);
    }
  }

  private buildMountains(): void {
    const geometry = new THREE.ConeGeometry(11, 18, 4);
    const colors = [0x78a977, 0x8fbd80, 0x6e9b73];
    for (let i = 0; i < 9; i++) {
      const mountain = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 1, flatShading: true }),
      );
      mountain.position.set(-54 + i * 13.5, 7.4 + (i % 2) * 2, -116 - (i % 3) * 8);
      mountain.rotation.y = Math.PI * (0.25 + (i % 2) * 0.5);
      mountain.receiveShadow = true;
      this.mountains.add(mountain);
    }
    this.scene.add(this.mountains);
  }

  private buildClouds(): void {
    for (let i = 0; i < 7; i++) {
      const cloud = new THREE.Group();
      cloud.userData.baseX = -42 + i * 14;
      cloud.userData.speed = 0.22 + (i % 3) * 0.08;
      cloud.position.set(cloud.userData.baseX, 15 + (i % 3) * 3.2, -58 - (i % 2) * 24);
      const size = 1.05 + (i % 3) * 0.18;
      for (const [x, y, z, sx, sy, sz] of [
        [-1.05, 0, 0, 1.35, 0.78, 0.9],
        [0, 0.18, 0.08, 1.65, 1.08, 1.05],
        [1.18, -0.04, 0.02, 1.25, 0.72, 0.88],
        [-0.42, 0.72, -0.04, 0.88, 0.72, 0.82],
        [0.58, 0.65, 0.04, 1.05, 0.8, 0.9],
      ] as const) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(size * sx, size * sy, size * sz), this.cloudMaterial);
        block.position.set(x * size, y * size, z * size);
        cloud.add(block);
      }
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  private buildPlayer(): void {
    const cream = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.88 });
    const coral = new THREE.MeshStandardMaterial({ color: PALETTE.coral, roughness: 0.86 });
    const brown = new THREE.MeshStandardMaterial({ color: PALETTE.brown, roughness: 0.9 });
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 24),
      new THREE.MeshBasicMaterial({ color: 0x4e563b, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.y = 0.45;
    shadow.position.y = 0.035;
    this.player.add(shadow);

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.35, 0.72), coral);
    body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.02, 0.82), cream);
    head.position.y = 2.05;
    this.player.add(body, head);
    for (const x of [-0.3, 0.3]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.9, 0.3), cream);
      ear.position.set(x, 2.92, 0);
      this.player.add(ear);
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.07), brown);
      eye.position.set(x * 0.75, 2.12, 0.45);
      this.player.add(eye);
    }
    const smile = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.07), brown);
    smile.position.set(0, 1.83, 0.45);
    this.player.add(smile);
    this.player.traverse((object) => {
      if (object instanceof THREE.Mesh && object !== shadow) object.castShadow = true;
    });
    this.player.scale.setScalar(0.68);
    this.player.position.set(0, 0, PLAYER_Z);
  }

  private updateWorld(snapshot: FrameSnapshot, dt: number): void {
    for (let i = 0; i < this.roadTiles.length; i++) {
      this.roadTiles[i].position.z = wrap(-i * ROAD_TILE_LENGTH + this.worldDistance, WORLD_BACK, WORLD_FRONT);
    }
    for (const tree of this.trees) {
      const z = wrap(tree.userData.baseZ + this.worldDistance, WORLD_BACK, WORLD_FRONT);
      const side = tree.userData.side as number;
      const offset = tree.userData.offset as number;
      tree.position.set(side * (ROAD_WIDTH / 2 + offset), 0, z);
      tree.visible = z < 15;
    }
    this.mountains.position.x = Math.sin(this.elapsed * 0.025) * 3.5;
    for (const cloud of this.clouds) {
      const x = wrap(cloud.userData.baseX + this.elapsed * cloud.userData.speed, -48, 48);
      cloud.position.x = x;
    }
    if (snapshot.phase === "menu") {
      this.world.rotation.y += (0 - this.world.rotation.y) * Math.min(1, dt * 3);
    }
  }

  private updateGate(snapshot: FrameSnapshot): void {
    if (!snapshot.door || snapshot.phase === "menu" || snapshot.phase === "gameover") {
      this.gateRoot.visible = false;
      this.resolvingSince = null;
      return;
    }
    this.gateRoot.visible = true;
    const key = `${snapshot.lanes}|${snapshot.door.labels.join("|")}|${snapshot.door.hidden.join("")}`;
    if (key !== this.gateKey) this.rebuildGate(snapshot);

    let z = THREE.MathUtils.lerp(GATE_FAR_Z, GATE_NEAR_Z, snapshot.door.approach);
    if (snapshot.resolve) {
      if (this.resolvingSince === null) this.resolvingSince = this.elapsed;
      const exit = Math.min(1, (this.elapsed - this.resolvingSince) / 0.15);
      z = THREE.MathUtils.lerp(GATE_NEAR_Z, 14.5, exit * exit);
    } else {
      this.resolvingSince = null;
    }
    this.gateRoot.position.set(0, 0, z);

    for (let i = 0; i < this.glassMaterials.length; i++) {
      const material = this.glassMaterials[i];
      material.color.setHex(PALETTE.mint);
      material.emissive.setHex(0x000000);
      material.emissiveIntensity = 0;
      material.opacity = 0.38;
      if (snapshot.resolve?.correct && i === snapshot.resolve.answer) {
        const pulse = 0.55 + Math.sin(this.elapsed * 42) * 0.25;
        material.color.setHex(PALETTE.yellow);
        material.emissive.setHex(PALETTE.yellow);
        material.emissiveIntensity = pulse * 1.8;
        material.opacity = 0.5;
      } else if (snapshot.resolve && !snapshot.resolve.correct && i === snapshot.resolve.chosen) {
        material.color.setHex(0xff8b7a);
        material.opacity = 0.42;
      }
    }
  }

  private rebuildGate(snapshot: FrameSnapshot): void {
    this.gateKey = `${snapshot.lanes}|${snapshot.door!.labels.join("|")}|${snapshot.door!.hidden.join("")}`;
    this.gateRoot.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.gateRoot.clear();
    this.glassMaterials.length = 0;
    this.labelTextures.splice(0).forEach((texture) => texture.dispose());

    const lanes = snapshot.lanes;
    const cellWidth = ROAD_WIDTH / lanes;
    const pillarMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.coral, roughness: 0.76 });
    const capMaterial = new THREE.MeshStandardMaterial({ color: PALETTE.cream, roughness: 0.84 });
    const pillarGeometry = new THREE.BoxGeometry(0.34, 3.8, 0.54);
    const capGeometry = new THREE.BoxGeometry(0.58, 0.36, 0.72);

    for (let i = 0; i <= lanes; i++) {
      const x = -ROAD_WIDTH / 2 + i * cellWidth;
      const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
      pillar.position.set(x, 1.9, 0);
      pillar.castShadow = true;
      const cap = new THREE.Mesh(capGeometry, capMaterial);
      cap.position.set(x, 3.94, 0);
      cap.castShadow = true;
      this.gateRoot.add(pillar, cap);
    }

    for (let lane = 0; lane < lanes; lane++) {
      const centerX = -ROAD_WIDTH / 2 + cellWidth * (lane + 0.5);
      const glassMaterial = new THREE.MeshStandardMaterial({
        color: PALETTE.mint,
        roughness: 0.28,
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(cellWidth - 0.48, 3.1, 0.08), glassMaterial);
      glass.position.set(centerX, 1.82, 0);
      this.gateRoot.add(glass);
      this.glassMaterials.push(glassMaterial);

      const label = snapshot.door!.hidden[lane] ? "?" : snapshot.door!.labels[lane] ?? "";
      const texture = makeTextTexture(label, label.length > 5 ? 210 : 280, true);
      texture.anisotropy = this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
      this.labelTextures.push(texture);
      const text = new THREE.Mesh(
        new THREE.PlaneGeometry(cellWidth * 0.92, 1.45),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
      );
      text.position.set(centerX, 2.15, 0.34);
      this.gateRoot.add(text);
    }
  }

  private updatePlayer(snapshot: FrameSnapshot): void {
    const active = snapshot.phase === "playing" || snapshot.phase === "resolving";
    this.player.visible = active;
    if (!active) return;
    const cellWidth = ROAD_WIDTH / snapshot.lanes;
    const minX = -ROAD_WIDTH / 2 + cellWidth / 2;
    const maxX = ROAD_WIDTH / 2 - cellWidth / 2;
    this.player.position.x = THREE.MathUtils.lerp(minX, maxX, snapshot.playerDisplayX);
    this.player.position.y = Math.abs(Math.sin(this.elapsed * 9.5)) * 0.08;
    this.player.rotation.z = Math.sin(this.elapsed * 9.5) * 0.018;
  }

  private updateDayCycle(snapshot: FrameSnapshot): void {
    const journey = THREE.MathUtils.clamp(snapshot.hud.doorsPassed / 220, 0, 1);
    const noonBlend = THREE.MathUtils.smoothstep(snapshot.hud.doorsPassed, 0, 80);
    const duskBlend = THREE.MathUtils.smoothstep(snapshot.hud.doorsPassed, 155, 220);
    const morning = new THREE.Color("#b8ded3");
    const dusk = new THREE.Color("#e6a27b");
    const sky = morning.lerp(PALETTE.day, noonBlend).lerp(dusk, duskBlend * 0.72);
    this.scene.background = sky;
    if (this.scene.fog instanceof THREE.Fog) this.scene.fog.color.copy(sky);
    this.hemi.intensity = THREE.MathUtils.lerp(2.05, 1.65, duskBlend);
    this.sunLight.intensity = THREE.MathUtils.lerp(2.45, 1.9, duskBlend);
    this.sunLight.color.set(duskBlend > 0.35 ? 0xffb982 : 0xfff0bd);
    const angle = THREE.MathUtils.lerp(Math.PI * 0.2, Math.PI * 0.8, journey);
    const sunX = Math.cos(angle) * 34;
    const sunY = 7 + Math.sin(angle) * 23;
    this.sun.position.set(sunX, sunY, -150);
    this.sun.visible = true;
    this.sunLight.position.set(sunX * 0.45, Math.max(5, sunY), -18);
    this.cloudMaterial.opacity = THREE.MathUtils.lerp(0.88, 0.72, duskBlend);
  }

  private updateCamera(): void {
    const portrait = this.cssWidth / Math.max(1, this.cssHeight) < 0.72;
    const baseY = portrait ? 6.8 : 6.2;
    const baseZ = portrait ? 12.2 : 11.2;
    const jitterX = this.shake > 0.002 ? Math.sin(this.elapsed * 72) * this.shake : 0;
    const jitterY = this.shake > 0.002 ? Math.cos(this.elapsed * 63) * this.shake * 0.5 : 0;
    this.camera.position.set(jitterX, baseY + jitterY, baseZ);
    this.camera.lookAt(0, 1.35, -20);
  }
}

function makeTextTexture(text: string, fontSize: number, outline: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable for text texture");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const family = 'Nunito, "Noto Sans SC", "PingFang SC", sans-serif';
  let fittedSize = fontSize;
  ctx.font = `900 ${fittedSize}px ${family}`;
  while (fittedSize > 58 && ctx.measureText(text).width > canvas.width * 0.88) {
    fittedSize -= 4;
    ctx.font = `900 ${fittedSize}px ${family}`;
  }
  if (outline) {
    ctx.strokeStyle = "rgba(255, 249, 223, 0.9)";
    ctx.lineWidth = 18;
    ctx.lineJoin = "round";
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  }
  ctx.fillStyle = "#6f4d31";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function wrap(value: number, min: number, max: number): number {
  const range = max - min;
  return ((((value - min) % range) + range) % range) + min;
}

function hash01(value: number): number {
  return Math.abs(Math.sin(value) * 43758.5453) % 1;
}
