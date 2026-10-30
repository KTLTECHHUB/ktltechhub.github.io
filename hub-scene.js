/**
 * KTL Tech Hub – premium hub-node hero (original).
 * Local three.js only. Glass/metal core, gold rim, soft glow bloom (additive),
 * cinematic lights, pointer tilt + slow ambient motion.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('hub-canvas');
  if (!canvas) return;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hero = canvas.closest('.hero') || document.body;

  function failGracefully() {
    document.documentElement.classList.add('no-webgl');
    document.documentElement.classList.remove('has-webgl');
    canvas.style.display = 'none';
  }

  if (reduceMotion) { failGracefully(); return; }

  var script = document.createElement('script');
  script.src = 'three.min.js';
  script.onerror = failGracefully;
  script.onload = function () {
    try { init(window.THREE); } catch (err) {
      console.warn('Hub scene failed:', err);
      failGracefully();
    }
  };
  document.head.appendChild(script);

  function makeGlowTexture() {
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var g = c.getContext('2d');
    var grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,200,120,1)');
    grd.addColorStop(0.25, 'rgba(255,107,0,0.65)');
    grd.addColorStop(0.55, 'rgba(255,80,0,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return c;
  }

  function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }

  function init(THREE) {
    if (!THREE || !window.WebGLRenderingContext) { failGracefully(); return; }

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch (e) { failGracefully(); return; }

    document.documentElement.classList.add('has-webgl');
    document.documentElement.classList.remove('no-webgl');

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x061428, 0.045);

    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.15, 6.5);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.28;

    // Simple cubemap for metal/glass reflections (no CDN / no RoomEnvironment)
    function makeEnv() {
      var faces = [
        ['#1a3058','#ff6b00'], ['#0a1830','#ff8a33'],
        ['#2a4068','#ffb347'], ['#061428','#123056'],
        ['#183050','#ff6b00'], ['#0B1E3A','#6ea8ff']
      ];
      var imgs = faces.map(function (pair) {
        var c = document.createElement('canvas');
        c.width = c.height = 64;
        var g = c.getContext('2d');
        var grd = g.createLinearGradient(0, 0, 64, 64);
        grd.addColorStop(0, pair[0]);
        grd.addColorStop(1, pair[1]);
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
        return c;
      });
      var ct = new THREE.CubeTexture(imgs);
      ct.needsUpdate = true;
      ct.colorSpace = THREE.SRGBColorSpace;
      return ct;
    }
    var envMap = makeEnv();
    scene.environment = envMap;

    // Cinematic lighting — navy ambient, orange key, cool fill, gold rim
    scene.add(new THREE.AmbientLight(0x1a2a44, 0.42));
    var key = new THREE.DirectionalLight(0xffc090, 1.55);
    key.position.set(5, 6.5, 4);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0x6ea8ff, 0.48);
    fill.position.set(-5, -0.5, 2.5);
    scene.add(fill);
    var rimOrange = new THREE.PointLight(0xff6b00, 2.4, 16);
    rimOrange.position.set(-2.2, 1.4, 2.8);
    scene.add(rimOrange);
    var rimGold = new THREE.SpotLight(0xffb347, 1.8, 22, 0.55, 0.5);
    rimGold.position.set(3.5, 4.5, 5);
    scene.add(rimGold);
    var bounce = new THREE.PointLight(0x88aaff, 0.4, 14);
    bounce.position.set(1.5, -2, 1);
    scene.add(bounce);

    var hub = new THREE.Group();
    hub.position.set(2.9, 0.08, -0.3);
    hub.scale.setScalar(0.82);
    scene.add(hub);

    // —— Glass / metallic core with orange emissive ——
    var core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.52, 3),
      new THREE.MeshPhysicalMaterial({
        color: 0xff8a28,
        metalness: 0.72,
        roughness: 0.12,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        transmission: 0.18,
        thickness: 0.6,
        ior: 1.45,
        emissive: 0xff4500,
        emissiveIntensity: 0.85,
        envMapIntensity: 1.2
      })
    );
    hub.add(core);

    // Inner crystal facet
    var inner = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.32, 1),
      new THREE.MeshPhysicalMaterial({
        color: 0xfff0e0,
        metalness: 0.2,
        roughness: 0.05,
        transmission: 0.55,
        thickness: 0.4,
        clearcoat: 1,
        emissive: 0xff6b00,
        emissiveIntensity: 0.85
      })
    );
    hub.add(inner);

    // Soft bloom glow (additive sprites — no postprocessing dependency)
    var glowTex = new THREE.CanvasTexture(makeGlowTexture());
    glowTex.colorSpace = THREE.SRGBColorSpace;
    function addGlow(size, opacity, y) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xff6b00,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      }));
      s.scale.set(size, size, 1);
      if (y) s.position.y = y;
      hub.add(s);
      return s;
    }
    var glowA = addGlow(4.2, 0.7, 0);
    var glowB = addGlow(2.1, 0.9, 0);
    var glowC = addGlow(6.5, 0.35, 0);

    // Glass cage wire
    var wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.68, 1),
      new THREE.MeshPhysicalMaterial({
        color: 0xffc080,
        metalness: 0.9,
        roughness: 0.2,
        transparent: true,
        opacity: 0.35,
        wireframe: true,
        emissive: 0xff6b00,
        emissiveIntensity: 0.2
      })
    );
    hub.add(wire);

    // Brushed-metal / glass spokes + metallic nodes
    var nodeCount = 7;
    var nodes = [];
    var spokes = [];
    var spokeMat = new THREE.MeshPhysicalMaterial({
      color: 0xc8d4e8,
      metalness: 0.92,
      roughness: 0.28,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
      emissive: 0xff6b00,
      emissiveIntensity: 0.12
    });
    var nodeMat = new THREE.MeshPhysicalMaterial({
      color: 0xff9a3a,
      metalness: 0.75,
      roughness: 0.18,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      emissive: 0xff6b00,
      emissiveIntensity: 0.7
    });
    var glassSpoke = new THREE.MeshPhysicalMaterial({
      color: 0xe8f0ff,
      metalness: 0.15,
      roughness: 0.08,
      transmission: 0.45,
      thickness: 0.3,
      clearcoat: 1,
      transparent: true,
      opacity: 0.85,
      emissive: 0xff6b00,
      emissiveIntensity: 0.08
    });

    for (var i = 0; i < nodeCount; i++) {
      var angle = (i / nodeCount) * Math.PI * 2;
      var radius = 1.62 + (i % 2) * 0.2;
      var y = Math.sin(angle * 2) * 0.38;
      var node = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), nodeMat.clone());
      node.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      hub.add(node);
      // tiny node glow
      var ng = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xff8a30, transparent: true, opacity: 0.45,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      ng.scale.set(0.55, 0.55, 1);
      node.add(ng);

      var mid = new THREE.Vector3().copy(node.position).multiplyScalar(0.5);
      var len = node.position.length();
      var spoke = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.032, len, 12),
        i % 2 === 0 ? spokeMat : glassSpoke
      );
      spoke.position.copy(mid);
      spoke.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        node.position.clone().normalize()
      );
      hub.add(spoke);
      nodes.push({ mesh: node, baseAngle: angle, radius: radius, yPhase: i, spoke: spoke, baseLen: len });
      spokes.push(spoke);
    }

    // Gold / orange orbital rings
    var ringGold = new THREE.MeshPhysicalMaterial({
      color: 0xd4a017,
      metalness: 0.95,
      roughness: 0.22,
      clearcoat: 0.8,
      emissive: 0x5a3000,
      emissiveIntensity: 0.15
    });
    var ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.88, 0.018, 16, 128), ringGold);
    ring1.rotation.x = Math.PI / 2.35;
    hub.add(ring1);

    var ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.22, 0.012, 12, 128),
      new THREE.MeshPhysicalMaterial({
        color: 0x7eb0ff,
        metalness: 0.7,
        roughness: 0.3,
        transparent: true,
        opacity: 0.55,
        emissive: 0x204080,
        emissiveIntensity: 0.2
      })
    );
    ring2.rotation.x = Math.PI / 1.72;
    ring2.rotation.y = 0.42;
    hub.add(ring2);

    var ring3 = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.01, 10, 96),
      new THREE.MeshBasicMaterial({
        color: 0xff6b00,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    ring3.rotation.x = Math.PI / 2.1;
    ring3.rotation.z = 0.3;
    hub.add(ring3);

    // Soft particle field (DOF feel via size + fog)
    var pCount = 140;
    var pGeo = new THREE.BufferGeometry();
    var positions = new Float32Array(pCount * 3);
    var pPhases = new Float32Array(pCount);
    for (var p = 0; p < pCount; p++) {
      positions[p * 3] = (Math.random() - 0.32) * 11;
      positions[p * 3 + 1] = (Math.random() - 0.5) * 6.5;
      positions[p * 3 + 2] = (Math.random() - 0.5) * 7 - 1;
      pPhases[p] = Math.random() * Math.PI * 2;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    var particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0xffa060,
        size: 0.04,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
      })
    );
    scene.add(particles);

    // Pointer parallax
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', function (e) {
      var rect = hero.getBoundingClientRect();
      pointer.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    }, { passive: true });

    var scrollY = 0;
    window.addEventListener('scroll', function () {
      scrollY = window.scrollY || 0;
    }, { passive: true });

    var wMobile = false;
    function resize() {
      var w = hero.clientWidth;
      var h = hero.clientHeight;
      if (w < 1 || h < 1) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      wMobile = w < 720;
      if (wMobile) {
        hub.position.set(0, -0.15, -0.55);
        hub.scale.setScalar(0.72);
        camera.position.z = 8.2;
      } else {
        hub.position.set(2.9, 0.08, -0.3);
        hub.scale.setScalar(0.82);
        camera.position.z = 6.5;
      }
    }
    window.addEventListener('resize', resize);
    resize();

    // Intro ease
    var intro = 0;
    var start = performance.now();
    var raf = 0;
    var running = true;

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var t = (now - start) / 1000;
      if (intro < 1) intro = Math.min(1, t / 1.4);
      var ie = easeOutCubic(intro);

      // Smooth pointer lerp
      pointer.x += (pointer.tx - pointer.x) * 0.055;
      pointer.y += (pointer.ty - pointer.y) * 0.055;

      hub.rotation.y = (t * 0.2 + pointer.x * 0.38) * ie;
      hub.rotation.x = (Math.sin(t * 0.32) * 0.1 + pointer.y * -0.22) * ie;
      var baseY = wMobile ? -0.15 : 0.1;
      hub.position.y = baseY + Math.sin(t * 0.65) * 0.07;

      var scrollFactor = Math.min(scrollY / 520, 1);
      hub.position.z = -0.3 - scrollFactor * 0.75;
      hub.rotation.z = scrollFactor * 0.12;

      core.rotation.y = -t * 0.35;
      core.rotation.x = Math.sin(t * 0.4) * 0.08;
      inner.rotation.y = t * 0.55;
      inner.rotation.z = t * 0.2;
      wire.rotation.y = t * 0.48;
      wire.rotation.x = t * 0.18;
      ring1.rotation.z = t * 0.28;
      ring2.rotation.z = -t * 0.2;
      ring3.rotation.z = t * 0.45;

      // Pulse emissive / glow (bloom feel)
      var pulse = 0.5 + Math.sin(t * 1.4) * 0.5;
      core.material.emissiveIntensity = 0.65 + pulse * 0.4;
      inner.material.emissiveIntensity = 0.7 + pulse * 0.35;
      glowA.material.opacity = 0.55 + pulse * 0.25;
      glowB.material.opacity = 0.7 + pulse * 0.28;
      glowC.material.opacity = 0.28 + pulse * 0.15;
      glowA.scale.setScalar(3.8 + pulse * 0.45);
      glowB.scale.setScalar(1.9 + pulse * 0.28);
      glowC.scale.setScalar(6.2 + pulse * 0.5);

      for (var n = 0; n < nodes.length; n++) {
        var nd = nodes[n];
        var a = nd.baseAngle + t * 0.14;
        var r = nd.radius + Math.sin(t * 1.1 + nd.yPhase) * 0.04;
        var ny = Math.sin(a * 2 + t * 0.45) * 0.36;
        nd.mesh.position.set(Math.cos(a) * r, ny, Math.sin(a) * r);
        nd.mesh.scale.setScalar(1 + Math.sin(t * 2.2 + nd.yPhase) * 0.1);
        var len = nd.mesh.position.length();
        nd.spoke.position.copy(nd.mesh.position).multiplyScalar(0.5);
        nd.spoke.scale.set(1, len / nd.baseLen, 1);
        nd.spoke.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          nd.mesh.position.clone().normalize()
        );
      }

      var pos = particles.geometry.attributes.position.array;
      for (var i = 0; i < pCount; i++) {
        pos[i * 3 + 1] += Math.sin(t * 0.7 + pPhases[i]) * 0.0012;
      }
      particles.geometry.attributes.position.needsUpdate = true;
      particles.rotation.y = t * 0.035;

      camera.position.x = pointer.x * 0.22;
      camera.position.y = 0.18 + pointer.y * -0.12;
      camera.lookAt(hub.position.x * 0.4 * ie, hub.position.y * 0.45, 0);

      // Intro scale
      var sBase = wMobile ? 0.78 : 0.82;
      hub.scale.setScalar(sBase * (0.88 + 0.12 * ie));

      renderer.render(scene, camera);
    }

    var io = new IntersectionObserver(function (entries) {
      var visible = entries[0] && entries[0].isIntersecting;
      if (visible && !running) { running = true; raf = requestAnimationFrame(frame); }
      else if (!visible && running) { running = false; cancelAnimationFrame(raf); }
    }, { threshold: 0.05 });
    io.observe(hero);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (hero.getBoundingClientRect().bottom > 0) {
        running = true; raf = requestAnimationFrame(frame);
      }
    });

    raf = requestAnimationFrame(frame);
  }
})();
