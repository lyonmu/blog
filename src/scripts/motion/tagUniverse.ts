import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let cleanup = () => {};
function initUniverse() {
  cleanup();
  const root = document.querySelector<HTMLElement>("[data-universe]");
  if (!root) return;
  const host = root.querySelector<HTMLElement>("[data-canvas-host]")!;
  const labels = root.querySelector<HTMLElement>("[data-planet-labels]")!;
  const status = root.querySelector<HTMLElement>("[data-scene-status]")!;
  const fullscreen =
    root.querySelector<HTMLButtonElement>("[data-fullscreen]")!;
  const pause = root.querySelector<HTMLButtonElement>("[data-universe-pause]")!;
  const reset = root.querySelector<HTMLButtonElement>("[data-universe-reset]")!;
  const nodes = [
    ...document.querySelectorAll<HTMLAnchorElement>("[data-tag-node]"),
  ];
  if (!nodes.length) {
    status.textContent = "暂无标签，新的星系正在形成。";
    return;
  }
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch {
    status.textContent = "当前设备无法开启 3D，请使用下方标签列表探索。";
    return;
  }
  const controller = new AbortController();
  const { signal } = controller;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    42,
    host.clientWidth / Math.max(1, host.clientHeight),
    0.1,
    200
  );
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 15;
  controls.maxDistance = 140;
  controls.maxPolarAngle = Math.PI * 0.83;
  const galaxy = new THREE.Group();
  const ambient = new THREE.AmbientLight(0x8cadde, 1.8);
  scene.add(galaxy, ambient);
  const sun = new THREE.DirectionalLight(0xd5faff, 4);
  sun.position.set(-10, 15, 16);
  scene.add(sun);
  const rim = new THREE.PointLight(0x6688ff, 70);
  rim.position.set(5, -3, -5);
  scene.add(rim);
  const sphere = new THREE.SphereGeometry(1, 28, 20);
  const palette = [0x66bfc8, 0x7e9be0, 0xd3b48b, 0x82b3a6, 0xb294d6];
  const planets: {
    group: THREE.Group;
    mesh: THREE.Mesh;
    link: HTMLAnchorElement;
    orbit: THREE.Group;
    radius: number;
  }[] = [];
  nodes.forEach((node, index) => {
    const count = Number(node.dataset.count);
    const group = new THREE.Group();
    // Distribute topics across concentric orbits, including larger collections.
    const ring = Math.floor(Math.sqrt(index + 1));
    const start = ring * ring - 1;
    const slots = Math.min(2 * ring + 1, nodes.length - start);
    const angle = ((index - start) / slots) * Math.PI * 2 + ring * 0.7;
    const distance = ring * 2.65;
    group.position.set(
      Math.cos(angle) * distance,
      Math.sin(index * 2.4) * 1.3,
      Math.sin(angle) * distance * 0.85
    );
    const radius = 0.3 + Math.min(Math.sqrt(count) * 0.1, 0.35);
    const material = new THREE.MeshStandardMaterial({
      color: palette[index % palette.length],
      roughness: 0.72,
      metalness: 0.22,
    });
    const mesh = new THREE.Mesh(sphere, material);
    mesh.scale.setScalar(radius);
    group.add(mesh);
    const orbit = new THREE.Group();
    group.add(orbit);
    for (let moon = 0; moon < count; moon++) {
      const satellite = new THREE.Mesh(sphere, material);
      const phase = (moon / count) * Math.PI * 2;
      const r = radius + 0.25 + Math.floor(moon / 12) * 0.13;
      satellite.scale.setScalar(0.055);
      satellite.position.set(
        Math.cos(phase) * r,
        Math.sin(phase) * r * 0.28,
        Math.sin(phase) * r
      );
      orbit.add(satellite);
    }
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(radius + 0.22, radius + 0.235, 64),
      new THREE.MeshBasicMaterial({
        color: palette[index % palette.length],
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      })
    );
    ringMesh.rotation.x = Math.PI / 2.3;
    group.add(ringMesh);
    galaxy.add(group);
    const link = document.createElement("a");
    link.href = node.href;
    link.textContent = node.dataset.name!;
    link.setAttribute(
      "aria-label",
      node.getAttribute("aria-label") ?? `${node.dataset.name}，${count} 篇文章`
    );
    labels.append(link);
    const select = () => {
      root.querySelector("[data-tag-name]")!.textContent = node.dataset.name!;
      root.querySelector("[data-tag-count]")!.textContent =
        `${count} 篇文章 · ${count} 颗卫星`;
    };
    link.addEventListener("pointerenter", select, { signal });
    link.addEventListener("focus", select, { signal });
    planets.push({ group, mesh, link, orbit, radius });
  });
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerStart = { x: 0, y: 0 };
  const hitPlanet = (event: PointerEvent) => {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      (-(event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(
      planets.map(planet => planet.mesh)
    )[0];
    return hit ? planets.find(planet => planet.mesh === hit.object) : undefined;
  };
  renderer.domElement.addEventListener(
    "pointerdown",
    event => {
      pointerStart = { x: event.clientX, y: event.clientY };
    },
    { signal }
  );
  renderer.domElement.addEventListener(
    "pointerup",
    event => {
      if (
        Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y
        ) > 6
      )
        return;
      hitPlanet(event)?.link.click();
    },
    { signal }
  );
  renderer.domElement.addEventListener(
    "pointermove",
    event => {
      const planet = hitPlanet(event);
      renderer.domElement.style.cursor = planet ? "pointer" : "grab";
      if (planet) {
        root.querySelector("[data-tag-name]")!.textContent =
          planet.link.textContent;
        root.querySelector("[data-tag-count]")!.textContent =
          `${planet.orbit.children.length} 篇文章 · ${planet.orbit.children.length} 颗卫星`;
      }
    },
    { signal }
  );
  const starPositions = new Float32Array(1200 * 3);
  let seed = 7301;
  for (let i = 0; i < starPositions.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    starPositions[i] = (seed / 4294967296 - 0.5) * 100;
  }
  for (let ring = 1; ring <= 4; ring++) {
    const path = new THREE.EllipseCurve(0, 0, ring * 2.65, ring * 2.65 * 0.85);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      path.getPoints(160).map(point => new THREE.Vector3(point.x, 0, point.y))
    );
    galaxy.add(
      new THREE.LineLoop(
        geometry,
        new THREE.LineBasicMaterial({
          color: 0x5c96be,
          transparent: true,
          opacity: 0.1,
        })
      )
    );
  }
  const starsGeometry = new THREE.BufferGeometry();
  starsGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3)
  );
  scene.add(
    new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({
        color: 0x9ec3eb,
        size: 0.045,
        transparent: true,
        opacity: 0.65,
      })
    )
  );
  let visible = true;
  let paused = reduced.matches;
  let frame = 0;
  let previous = 0;
  let expanded = false;
  let lost = false;
  const position = new THREE.Vector3();
  const draw = () => {
    scene.updateMatrixWorld(true);
    renderer.render(scene, camera);
    planets.forEach(({ group, link, radius }) => {
      group.getWorldPosition(position);
      position.y -= radius + 0.18;
      position.project(camera);
      const rawX = (position.x * 0.5 + 0.5) * host.clientWidth;
      const margin = link.offsetWidth / 2 + 5;
      const x = Math.max(margin, Math.min(host.clientWidth - margin, rawX));
      const y = (-position.y * 0.5 + 0.5) * host.clientHeight;
      link.style.transform = `translate(-50%, 0) translate(${x}px, ${y}px)`;
      link.style.visibility =
        Math.abs(position.x) > 0.96 ||
        Math.abs(position.y) > 0.92 ||
        position.z > 1
          ? "hidden"
          : "visible";
      link.style.zIndex = String(Math.round((1 - position.z) * 10000));
    });
  };
  const applyTheme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    ambient.intensity = dark ? 1.8 : 1.25;
    sun.intensity = dark ? 4 : 2.8;
    scene.traverse(object => {
      if (object instanceof THREE.Points) {
        const material = object.material as THREE.PointsMaterial;
        material.color.setHex(dark ? 0x9ec3eb : 0x396784);
        material.opacity = dark ? 0.65 : 0.5;
      } else if (object instanceof THREE.Line) {
        const material = object.material as THREE.LineBasicMaterial;
        material.color.setHex(dark ? 0x5c96be : 0x4b7895);
        material.opacity = dark ? 0.1 : 0.2;
      }
    });
    // Theme changes must repaint even while orbiting is paused.
    if (!lost) draw();
  };
  const themeObserver = new MutationObserver(applyTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  const tick = (time: number) => {
    const delta = Math.min((time - previous) / 1000, 0.05);
    previous = time;
    if (
      !paused &&
      !reduced.matches &&
      !labels.matches(":hover, :focus-within")
    ) {
      galaxy.rotation.y += delta * 0.025;
      planets.forEach(({ orbit }) => {
        orbit.rotation.y += delta * 0.22;
      });
    }
    draw();
    frame = requestAnimationFrame(tick);
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    if (visible && !document.hidden && !lost) {
      draw();
      if (!paused && !reduced.matches) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }
  };
  const resize = () => {
    const aspect = host.clientWidth / Math.max(1, host.clientHeight);
    camera.position.multiplyScalar(
      Math.min(1, camera.aspect) / Math.min(1, aspect)
    );
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth, host.clientHeight);
    if (!lost) draw();
  };
  const home = () => {
    const distance = Math.max(
      26,
      (host.clientWidth < host.clientHeight ? 29 : 26) /
        Math.min(1, host.clientWidth / host.clientHeight)
    );
    camera.position.set(0, distance * 0.95, distance * 0.7);
    controls.target.set(0, 0, 0);
    galaxy.rotation.y = 0;
    controls.update();
    resize();
  };
  home();
  applyTheme();
  controls.addEventListener("change", draw);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  const visibility = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    schedule();
  });
  visibility.observe(host);
  const updatePause = () => {
    pause.textContent = reduced.matches
      ? "动态效果已关闭"
      : paused
        ? "开始公转"
        : "暂停公转";
    pause.disabled = reduced.matches;
    schedule();
  };
  pause.addEventListener(
    "click",
    () => {
      paused = !paused;
      updatePause();
    },
    { signal }
  );
  reduced.addEventListener("change", updatePause, { signal });
  document.addEventListener("visibilitychange", schedule, { signal });
  reset.addEventListener("click", home, { signal });
  const syncFullscreen = () => {
    const active = document.fullscreenElement === root || expanded;
    fullscreen.setAttribute("aria-pressed", String(active));
    root.querySelector("[data-fullscreen-label]")!.textContent = active
      ? "退出全屏"
      : "全屏查看";
    resize();
  };
  const setExpanded = (value: boolean) => {
    expanded = value;
    root.classList.toggle("expanded", value);
    document.documentElement.classList.toggle("tag-universe-expanded", value);
    syncFullscreen();
  };
  fullscreen.addEventListener(
    "click",
    async () => {
      if (expanded) setExpanded(false);
      else if (document.fullscreenElement === root)
        await document.exitFullscreen();
      else {
        try {
          await root.requestFullscreen();
        } catch {
          setExpanded(true);
        }
      }
    },
    { signal }
  );
  document.addEventListener("fullscreenchange", syncFullscreen, { signal });
  document.addEventListener(
    "keydown",
    event => {
      if (event.key === "Escape" && expanded) {
        setExpanded(false);
        fullscreen.focus();
      }
    },
    { signal }
  );
  renderer.domElement.addEventListener(
    "webglcontextlost",
    event => {
      event.preventDefault();
      lost = true;
      schedule();
      labels.hidden = true;
      status.hidden = false;
      status.textContent = "3D 场景已暂停，请使用下方标签列表，或刷新重试。";
      document.querySelector<HTMLDetailsElement>("[data-tag-directory]")!.open =
        true;
    },
    { signal }
  );
  status.hidden = true;
  fullscreen.hidden = pause.hidden = reset.hidden = false;
  document.querySelector<HTMLDetailsElement>("[data-tag-directory]")!.open =
    false;
  updatePause();
  cleanup = () => {
    controller.abort();
    observer.disconnect();
    themeObserver.disconnect();
    visibility.disconnect();
    cancelAnimationFrame(frame);
    controls.dispose();
    setExpanded(false);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse(object => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Points ||
        object instanceof THREE.Line
      ) {
        geometries.add(object.geometry);
        const values = Array.isArray(object.material)
          ? object.material
          : [object.material];
        values.forEach(material => materials.add(material));
      }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    renderer.dispose();
    renderer.domElement.remove();
    labels.replaceChildren();
  };
}
document.addEventListener("astro:page-load", initUniverse);
document.addEventListener("astro:before-swap", () => cleanup());
