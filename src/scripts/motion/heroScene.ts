export {};
// This module is referenced only by the homepage. Three stays behind a lazy import.
let cleanup = () => {};
function initHeroScene() {
  cleanup();
  const host = document.querySelector<HTMLElement>("[data-hero-scene]");
  if (!host) return;
  const controller = new AbortController();
  const { signal } = controller;
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  let dispose = () => {};
  let started = false;
  let visible = false;
  let updateVisibility = () => {};
  const observer = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? false;
    updateVisibility();
    if (visible && !started && !preference.matches) {
      started = true;
      void start();
    }
  });
  cleanup = () => {
    controller.abort();
    observer.disconnect();
    dispose();
    host.classList.remove("scene-ready");
  };
  preference.addEventListener("change", initHeroScene, { signal });
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection;
  if (
    preference.matches ||
    connection?.saveData ||
    navigator.hardwareConcurrency <= 2
  )
    return;
  observer.observe(host);

  async function start() {
    try {
      const THREE = await import("three");
      if (signal.aborted || !host) return;
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2", {
        alpha: true,
        antialias: true,
        powerPreference: "low-power",
      });
      if (!context) return;
      const renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
        antialias: true,
      });
      const geometries: InstanceType<typeof THREE.BufferGeometry>[] = [];
      const materials: InstanceType<typeof THREE.Material>[] = [];
      let frame = 0;
      const observers: { resize?: ResizeObserver; theme?: MutationObserver } =
        {};
      dispose = () => {
        cancelAnimationFrame(frame);
        observers.resize?.disconnect();
        observers.theme?.disconnect();
        geometries.forEach(geometry => geometry.dispose());
        materials.forEach(material => material.dispose());
        renderer.dispose();
        renderer.forceContextLoss();
        canvas.remove();
      };
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      host.querySelector(".scene-canvas")?.append(canvas);
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
      camera.position.set(0, 0, 7.5);
      const group = new THREE.Group();
      scene.add(group);
      camera.position.set(0, 0.15, 7.8);
      const ambient = new THREE.HemisphereLight(0xeaf8ff, 0x34505d, 2.4);
      const key = new THREE.DirectionalLight(0xffffff, 4);
      key.position.set(-3, 5, 4);
      const rim = new THREE.DirectionalLight(0x8cdbe6, 3);
      rim.position.set(4, 1, -2);
      const fill = new THREE.DirectionalLight(0xc8d4ff, 1.5);
      fill.position.set(-2, -3, 2);
      scene.add(ambient, key, rim, fill);
      const blueMaterial = new THREE.MeshPhysicalMaterial({
        roughness: 0.28,
        metalness: 0.35,
        clearcoat: 0.6,
      });
      const pearlMaterial = new THREE.MeshPhysicalMaterial({
        roughness: 0.3,
        metalness: 0.15,
        clearcoat: 0.5,
      });
      const silverMaterial = new THREE.MeshPhysicalMaterial({
        roughness: 0.35,
        metalness: 0.4,
        clearcoat: 0.3,
      });
      const coreMaterial = new THREE.MeshStandardMaterial({
        roughness: 0.28,
        metalness: 0.45,
        flatShading: true,
      });
      const lineMaterial = new THREE.LineBasicMaterial({
        transparent: true,
        opacity: 0.22,
      });
      materials.push(
        blueMaterial,
        pearlMaterial,
        silverMaterial,
        coreMaterial,
        lineMaterial
      );
      const coreGeometry = new THREE.IcosahedronGeometry(0.49, 1);
      const core = new THREE.Mesh(coreGeometry, coreMaterial);
      geometries.push(coreGeometry);
      group.add(core);
      const bands = [
        {
          radius: 1.03,
          tube: 0.12,
          length: Math.PI * 1.65,
          rotation: [0.8, -0.4, -0.5],
          material: blueMaterial,
        },
        {
          radius: 1.36,
          tube: 0.105,
          length: Math.PI * 1.55,
          rotation: [-0.65, 0.7, 0.9],
          material: pearlMaterial,
        },
        {
          radius: 1.7,
          tube: 0.065,
          length: Math.PI * 1.5,
          rotation: [1.1, 0.4, -0.65],
          material: silverMaterial,
        },
      ].map(({ radius, tube, length, rotation, material }) => {
        const geometry = new THREE.TorusGeometry(radius, tube, 20, 128, length);
        geometries.push(geometry);
        const band = new THREE.Mesh(geometry, material);
        band.rotation.set(rotation[0], rotation[1], rotation[2]);
        group.add(band);
        // Rounded end caps make each open arc a complete sculptural form.
        const capGeometry = new THREE.SphereGeometry(tube, 20, 12);
        geometries.push(capGeometry);
        [0, length].forEach(angle => {
          const cap = new THREE.Mesh(capGeometry, material);
          cap.position.set(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius,
            0
          );
          band.add(cap);
        });
        return band;
      });
      const path = new THREE.EllipseCurve(0, 0, 1.92, 1.92);
      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(
        path.getPoints(180)
      );
      geometries.push(orbitGeometry);
      const orbit = new THREE.LineLoop(orbitGeometry, lineMaterial);
      orbit.rotation.set(0.85, -0.45, 0.1);
      group.add(orbit);
      const beadGeometry = new THREE.SphereGeometry(0.075, 20, 16);
      geometries.push(beadGeometry);
      const bead = new THREE.Mesh(beadGeometry, blueMaterial);
      orbit.add(bead);
      const recolor = () => {
        const dark = document.documentElement.dataset.theme === "dark";
        blueMaterial.color.set(dark ? 0x60aab9 : 0x28788c);
        pearlMaterial.color.set(dark ? 0xb7ced7 : 0xe0e8e8);
        silverMaterial.color.set(dark ? 0x778b9c : 0xa2b7c0);
        coreMaterial.color.set(dark ? 0x8cbed0 : 0x578fa3);
        lineMaterial.color.set(dark ? 0x79b8c8 : 0x236b80);
        ambient.intensity = dark ? 1.8 : 2.4;
        key.intensity = dark ? 3.5 : 4;
        renderer.render(scene, camera);
      };
      recolor();
      observers.theme = new MutationObserver(recolor);
      observers.theme.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      });
      observers.resize = new ResizeObserver(() => {
        const { width, height } = host.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      });
      observers.resize.observe(host);
      let targetX = 0,
        targetY = 0;
      if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
        host.addEventListener(
          "pointermove",
          event => {
            const rect = host.getBoundingClientRect();
            targetX = ((event.clientY - rect.top) / rect.height - 0.5) * 0.14;
            targetY = ((event.clientX - rect.left) / rect.width - 0.5) * 0.21;
          },
          { signal }
        );
        host.addEventListener(
          "pointerleave",
          () => {
            targetX = 0;
            targetY = 0;
          },
          { signal }
        );
      }
      let elapsed = 0,
        previous = 0;
      const draw = (time: number) => {
        frame = 0;
        if (signal.aborted || !visible || document.hidden) return;
        elapsed += Math.min(time - previous, 50) / 1000;
        previous = time;
        group.rotation.x += (targetX - group.rotation.x) * 0.035;
        group.rotation.y +=
          (targetY + Math.sin(elapsed * 0.18) * 0.07 - group.rotation.y) *
          0.035;
        group.position.y = Math.sin(elapsed * 0.4) * 0.035;
        core.rotation.y = elapsed * 0.12;
        core.rotation.z = Math.sin(elapsed * 0.2) * 0.1;
        bands[0].rotation.z = -0.5 + elapsed * 0.045;
        bands[1].rotation.z = 0.9 - elapsed * 0.03;
        bead.position.set(
          Math.cos(elapsed * 0.18) * 1.92,
          Math.sin(elapsed * 0.18) * 1.92,
          0
        );
        renderer.render(scene, camera);
        host.classList.add("scene-ready");
        frame = requestAnimationFrame(draw);
      };
      updateVisibility = () => {
        cancelAnimationFrame(frame);
        frame = 0;
        if (visible && !document.hidden && !signal.aborted) {
          previous = performance.now();
          frame = requestAnimationFrame(draw);
        }
      };
      document.addEventListener("visibilitychange", updateVisibility, {
        signal,
      });
      canvas.addEventListener("webglcontextlost", () => cleanup(), { signal });
      updateVisibility();
    } catch {
      // Decorative enhancement: keep the static sculpture on failure.
      cleanup();
    }
  }
}
document.addEventListener("astro:page-load", initHeroScene);
document.addEventListener("astro:before-swap", () => cleanup());
