// HANDY RAVE - Main application
(function() {
  'use strict';

  // --- Audio ---
  var TRACKS = [
    'audio/rave-main.mp3',
    'audio/rave-1.mp3',
    'audio/rave-2.mp3',
    'audio/rave-3.mp3'
  ];
  var currentTrackIdx = 0;
  var audioEl = document.getElementById('audio');
  var trackInfo = document.getElementById('track-info');
  var volumeSlider = document.getElementById('volume');
  var started = false;

  function loadTrack(idx) {
    currentTrackIdx = idx % TRACKS.length;
    audioEl.src = TRACKS[currentTrackIdx];
    audioEl.load();
    trackInfo.textContent = 'track ' + (currentTrackIdx + 1) + ' / ' + TRACKS.length;
  }

  function nextTrack() {
    loadTrack(currentTrackIdx + 1);
    audioEl.play();
  }

  volumeSlider.addEventListener('input', function() {
    audioEl.volume = volumeSlider.value / 100;
  });
  audioEl.volume = 0.7;

  audioEl.addEventListener('ended', nextTrack);

  // --- Three.js Setup ---
  var W = window.innerWidth;
  var H = window.innerHeight;

  var renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050508);
  scene.fog = new THREE.Fog(0x050508, 8, 25);

  // Dim ambient
  scene.add(new THREE.AmbientLight(0x101020, 0.3));
  var mainDir = new THREE.DirectionalLight(0xffffff, 0.3);
  mainDir.position.set(3, 10, 4);
  scene.add(mainDir);

  var camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
  camera.position.set(0, 3, 10);
  camera.lookAt(0, 1, 0);

  // Reflective floor
  var floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a15, roughness: 0.3, metalness: 0.8 });
  var floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // Spotlight rig
  var spotColors = [0xff0044, 0x00ff88, 0x4400ff, 0xff8800, 0xff00ff, 0x00ffff, 0xff0066, 0x66ff00];
  var raveSpots = [];
  for (var s = 0; s < 8; s++) {
    var sp = new THREE.SpotLight(spotColors[s], 2, 25, Math.PI / 7, 0.5, 1);
    sp.position.set(Math.cos(s * Math.PI / 4) * 7, 9, Math.sin(s * Math.PI / 4) * 7);
    sp.target.position.set(0, 0, 0);
    scene.add(sp);
    scene.add(sp.target);
    raveSpots.push(sp);
  }

  // Lasers
  var laserGroup = new THREE.Group();
  for (var l = 0; l < 12; l++) {
    var laserGeo = new THREE.CylinderGeometry(0.015, 0.015, 20, 4);
    var laserMat = new THREE.MeshBasicMaterial({
      color: l % 3 === 0 ? 0xff0044 : l % 3 === 1 ? 0x00ffaa : 0x4488ff,
      transparent: true, opacity: 0.4
    });
    var laser = new THREE.Mesh(laserGeo, laserMat);
    laser.position.set(0, 10, 0);
    laser.rotation.z = (l / 12) * Math.PI * 2;
    laserGroup.add(laser);
  }
  scene.add(laserGroup);

  // Strobe
  var strobeLight = new THREE.PointLight(0xffffff, 0, 20);
  strobeLight.position.set(0, 10, 0);
  scene.add(strobeLight);

  // --- GLB Loading (load ONCE, clone for dancers) ---
  var dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('js/');
  dracoLoader.setDecoderConfig({ type: 'js' });
  var loader = new THREE.GLTFLoader();
  loader.setDRACOLoader(dracoLoader);

  var ANIMS = ['Dancing', 'Hip_Hop_Dancing', 'Macarena_Dance', 'Northern_Soul_Spin_Combo', 'Swing_Dancing', 'Ymca_Dance'];
  var DANCER_COLORS = [
    0xff4444, 0x44ff44, 0x4488ff, 0xffff44, 0xff44ff, 0x44ffff,
    0xff8844, 0x88ff44, 0x4488ff, 0xff4488, 0x8844ff, 0x44ff88,
    0xff6644, 0x44ff66, 0x6644ff, 0xff4466, 0x66ff44, 0x4466ff,
    0xffaa44, 0x44ffaa
  ];

  var dancers = [];      // { model, mixer, light, angle }
  var targetCount = 6;
  var cachedGltf = null;   // loaded once
  var pendingDancers = [];  // queued until GLB loaded

  // Load GLB once, then spawn dancers
  loader.load('model.glb', function(gltf) {
    cachedGltf = gltf;
    // spawn any queued
    for (var i = 0; i < pendingDancers.length; i++) {
      spawnDancer(pendingDancers[i].index, pendingDancers[i].total);
    }
    pendingDancers = [];
    var el = document.getElementById('overlay-status');
    if (el) el.textContent = 'click anywhere to enter';
  }, undefined, function(err) {
    console.error('GLB load failed:', err);
  });

  setDancerCount(targetCount);

  function spawnDancer(index, total) {
    var angleSpread = Math.PI * 0.8;
    var startAngle = Math.PI * 0.1;
    var angle = startAngle + angleSpread * (index / Math.max(total - 1, 1));
    var radius = 4 + total * 0.15;
    var px = Math.sin(angle) * radius;
    var pz = -Math.cos(angle) * radius;

    // Clone scene from cached GLB (works in browser WebGL)
    var m = cachedGltf.scene.clone(true);
    // Deep-clone skinned mesh skeletons so each dancer animates independently
    m.traverse(function(child) {
      if (child.isSkinnedMesh) {
        child.skeleton = child.skeleton.clone();
        child.bind(child.skeleton, child.bindMatrix);
      }
    });
    m.scale.set(1.3, 1.3, 1.3);
    m.position.set(px, 0, pz);
    m.lookAt(0, 0, 0);
    scene.add(m);

    var mixer = new THREE.AnimationMixer(m);
    var animName = ANIMS[Math.floor(Math.random() * ANIMS.length)];
    var clip = cachedGltf.animations.find(function(a) { return a.name === animName; });
    if (clip) {
      var act = mixer.clipAction(clip);
      act.play();
      act.time = Math.random() * clip.duration;
    }

    var pl = new THREE.PointLight(DANCER_COLORS[index % DANCER_COLORS.length], 2, 8);
    pl.position.set(px, 3, pz);
    scene.add(pl);

    dancers.push({ model: m, mixer: mixer, light: pl, angle: angle });
  }

  function addDancer(index, total) {
    if (cachedGltf) {
      spawnDancer(index, total);
    } else {
      pendingDancers.push({ index: index, total: total });
    }
  }

  function removeDancer(d) {
    scene.remove(d.model);
    scene.remove(d.light);
    d.model.traverse(function(c) {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        if (Array.isArray(c.material)) c.material.forEach(function(m) { m.dispose(); });
        else c.material.dispose();
      }
    });
  }

  function setDancerCount(count) {
    while (dancers.length > count) {
      removeDancer(dancers.pop());
    }
    while (dancers.length < count) {
      addDancer(dancers.length, count);
    }
  }

  // Slider
  var slider = document.getElementById('slider');
  var countDisplay = document.getElementById('handy-count');
  slider.addEventListener('input', function() {
    targetCount = parseInt(slider.value);
    countDisplay.textContent = targetCount;
    setDancerCount(targetCount);
  });

  // --- Animation Loop ---
  var frameT = 0;
  var lastTime = performance.now();

  function animate() {
    requestAnimationFrame(animate);
    var now = performance.now();
    var delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;
    frameT += delta;

    // Update mixers
    for (var i = 0; i < dancers.length; i++) {
      dancers[i].mixer.update(delta);
    }

    // Slow cinematic camera orbit
    var a = frameT * 0.12;
    var dist = 8 + dancers.length * 0.3;
    camera.position.x = Math.sin(a) * dist;
    camera.position.z = Math.cos(a) * dist;
    camera.position.y = 2.5 + Math.sin(frameT * 0.2) * 0.8;
    camera.lookAt(0, 0.8, 0);

    // Sweep spotlights (always pointing down)
    for (var s = 0; s < raveSpots.length; s++) {
      var sa = frameT * (0.4 + s * 0.08) + s * Math.PI / 4;
      raveSpots[s].target.position.set(Math.sin(sa) * 3, 0, Math.cos(sa) * 3);
      raveSpots[s].intensity = 2 + Math.sin(frameT * 1.5 + s) * 1.5;
    }

    // Rotate lasers
    laserGroup.rotation.y = frameT * 0.25;
    for (var l = 0; l < laserGroup.children.length; l++) {
      laserGroup.children[l].rotation.x = Math.sin(frameT * 1.2 + l * 0.7) * 0.35;
      laserGroup.children[l].material.opacity = 0.2 + Math.sin(frameT * 4 + l) * 0.2;
    }

    // Strobe
    strobeLight.intensity = Math.sin(frameT * 8) > 0.9 ? 8 : 0;

    renderer.render(scene, camera);
  }

  // --- Start overlay ---
  var overlay = document.getElementById('start-overlay');
  overlay.addEventListener('click', function() {
    if (started) return;
    started = true;
    overlay.classList.add('hidden');
    loadTrack(0);
    audioEl.play().catch(function() {});
  });

  // --- Resize ---
  window.addEventListener('resize', function() {
    W = window.innerWidth;
    H = window.innerHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
  });

  // Start render loop (after all vars/functions are defined)
  animate();

})();
