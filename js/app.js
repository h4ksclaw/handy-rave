// HANDY RAVE - Main application
(function() {
  'use strict';

  // SkinnedMesh-safe clone: shares geometry + materials, rebuilds skeleton bone
  // refs against the cloned bone hierarchy. Without this, cloned skinned meshes
  // all reference the source skeleton and animate as one.
  function parallelTraverse(a, b, callback) {
    callback(a, b);
    for (var i = 0; i < a.children.length; i++) {
      parallelTraverse(a.children[i], b.children[i], callback);
    }
  }

  function cloneSkinned(source) {
    var sourceLookup = new Map();
    var cloneLookup = new Map();
    var clone = source.clone();
    parallelTraverse(source, clone, function(sourceNode, clonedNode) {
      sourceLookup.set(clonedNode, sourceNode);
      cloneLookup.set(sourceNode, clonedNode);
    });
    clone.traverse(function(node) {
      if (!node.isSkinnedMesh) return;
      var sourceMesh = sourceLookup.get(node);
      node.skeleton = sourceMesh.skeleton.clone();
      node.bindMatrix.copy(sourceMesh.bindMatrix);
      node.skeleton.bones = sourceMesh.skeleton.bones.map(function(bone) {
        return cloneLookup.get(bone);
      });
      node.bind(node.skeleton, node.bindMatrix);
    });
    return clone;
  }

  // --- Audio ---
  var TRACKS = [
    'audio/m83-midnight-city.mp3',
    'audio/darude-sandstorm.mp3',
    'audio/prodigy-oxygen.mp3',
    'audio/benny-benassi-satisfaction.mp3',
    'audio/eric-prydz-call-on-me.mp3',
    'audio/faithless-insomnia.mp3'
  ];
  var RADIO_URL = 'https://radio.h4ks.com/radio';
  var currentTrackIdx = 0;
  var radioMode = false;
  var audioEl = document.getElementById('audio');
  var trackInfo = document.getElementById('track-info');
  var volumeSlider = document.getElementById('volume');
  var btnPrev = document.getElementById('btn-prev');
  var btnNext = document.getElementById('btn-next');
  var radioCheck = document.getElementById('radio-check');
  var started = false;

  function loadTrack(idx) {
    currentTrackIdx = ((idx % TRACKS.length) + TRACKS.length) % TRACKS.length;
    audioEl.src = TRACKS[currentTrackIdx];
    audioEl.load();
    trackInfo.textContent = 'track ' + (currentTrackIdx + 1) + ' / ' + TRACKS.length;
  }

  function nextTrack() {
    if (radioMode) return;
    loadTrack(currentTrackIdx + 1);
    audioEl.play().catch(function() {});
  }

  function prevTrack() {
    if (radioMode) return;
    loadTrack(currentTrackIdx - 1);
    audioEl.play().catch(function() {});
  }

  // Radio mode swaps the track files for the live stream and disables the
  // transport controls (next/prev are meaningless for a single live feed).
  function setRadioMode(on) {
    radioMode = on;
    btnPrev.disabled = on;
    btnNext.disabled = on;
    if (on) {
      audioEl.src = RADIO_URL;
      audioEl.load();
      trackInfo.textContent = 'live radio';
    } else {
      loadTrack(currentTrackIdx);
    }
    if (started) audioEl.play().catch(function() {});
  }

  btnNext.addEventListener('click', nextTrack);
  btnPrev.addEventListener('click', prevTrack);
  radioCheck.addEventListener('change', function() {
    setRadioMode(radioCheck.checked);
  });

  volumeSlider.addEventListener('input', function() {
    audioEl.volume = volumeSlider.value / 100;
  });
  audioEl.volume = 0.7;

  audioEl.addEventListener('ended', nextTrack);

  // --- Three.js Setup ---
  var W = window.innerWidth;
  var H = window.innerHeight;

  var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050508);
  scene.fog = new THREE.Fog(0x050508, 8, 30);

  var camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
  camera.position.set(0, 3, 10);
  camera.lookAt(0, 1, 0);

  // Reflective floor
  var floorMat = new THREE.MeshStandardMaterial({ color: 0x0a0a15, roughness: 0.3, metalness: 0.8 });
  var floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // --- Lighting rig: fixed cost, independent of dancer count ---
  // Forward rendering evaluates every light per fragment, so the light count is
  // kept small and constant rather than scaling with dancers.
  scene.add(new THREE.AmbientLight(0x202030, 0.6));
  var fillDir = new THREE.DirectionalLight(0xffffff, 0.35);
  fillDir.position.set(3, 10, 4);
  scene.add(fillDir);

  var spotColors = [0xff0044, 0x00ff88, 0x4400ff, 0xff8800];
  var raveSpots = [];
  for (var s = 0; s < spotColors.length; s++) {
    var sp = new THREE.SpotLight(spotColors[s], 3, 30, Math.PI / 6, 0.5, 1);
    sp.position.set(Math.cos(s * Math.PI / 2) * 8, 10, Math.sin(s * Math.PI / 2) * 8);
    sp.target.position.set(0, 0, 0);
    scene.add(sp);
    scene.add(sp.target);
    raveSpots.push(sp);
  }

  var strobeLight = new THREE.PointLight(0xffffff, 0, 25);
  strobeLight.position.set(0, 10, 0);
  scene.add(strobeLight);

  // Lasers (unlit, cheap)
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

  // --- GLB / Dancer system ---
  var dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('js/');
  dracoLoader.setDecoderConfig({ type: 'js' });

  var ANIMS = ['Dancing', 'Hip_Hop_Dancing', 'Macarena_Dance', 'Northern_Soul_Spin_Combo', 'Swing_Dancing', 'Ymca_Dance'];

  var dancers = [];
  var targetCount = 6;
  var template = null;      // { scene, animations } parsed once
  var pendingCount = null;

  // Parse the GLB exactly once. Every dancer is a skeleton-aware clone of this
  // template, sharing its geometry buffers — no re-decode, no per-dancer upload.
  new THREE.GLTFLoader()
    .setDRACOLoader(dracoLoader)
    .load('model.glb', function(gltf) {
      template = { scene: gltf.scene, animations: gltf.animations };
      var el = document.getElementById('overlay-status');
      if (el) el.textContent = 'click anywhere to enter';
      if (pendingCount !== null) {
        setDancerCount(pendingCount);
        pendingCount = null;
      } else {
        setDancerCount(targetCount);
      }
    }, undefined, function(err) {
      console.error('GLB load failed:', err);
      var el = document.getElementById('overlay-status');
      if (el) el.textContent = 'failed to load dancers :(';
    });

  // Arc layout that expands radius and angle spread with count
  function getDancerPos(index, total) {
    if (total <= 1) return { x: 0, z: -4 };
    var spreadDeg = Math.min(140, 60 + total * 8);
    var spreadRad = spreadDeg * Math.PI / 180;
    var radius = 4 + total * 0.4;
    var t = index / (total - 1);
    var angle = -spreadRad / 2 + t * spreadRad;
    return { x: Math.sin(angle) * radius, z: -Math.cos(angle) * radius };
  }

  function spawnDancer(index, total) {
    var m = cloneSkinned(template.scene);
    var pos = getDancerPos(index, total);
    m.scale.set(1.3, 1.3, 1.3);
    m.position.set(pos.x, 0, pos.z);
    m.lookAt(0, 0, 0);
    // Original textures kept as-is; the sweeping spotlight rig provides the color.
    scene.add(m);

    var mixer = new THREE.AnimationMixer(m);
    var animName = ANIMS[Math.floor(Math.random() * ANIMS.length)];
    var clip = template.animations.find(function(a) { return a.name === animName; });
    if (clip) {
      var act = mixer.clipAction(clip);
      act.play();
      act.time = Math.random() * clip.duration;
    }

    dancers.push({ model: m, mixer: mixer, index: index });
  }

  function removeDancer(d) {
    // Geometry and materials are shared with the template across all clones, so
    // nothing is disposed here — just detach and stop animating.
    scene.remove(d.model);
    d.mixer.stopAllAction();
  }

  function setDancerCount(count) {
    if (!template) {
      pendingCount = count;
      return;
    }
    targetCount = count;
    while (dancers.length > count) {
      removeDancer(dancers.pop());
    }
    while (dancers.length < count) {
      spawnDancer(dancers.length, count);
    }
    repositionDancers();
    // Layout radius and camera distance both grow with count, so push fog far out
    // to keep the back of the crowd from dissolving into the background.
    scene.fog.far = Math.max(30, 16 + count * 0.9);
  }

  function repositionDancers() {
    var total = dancers.length;
    for (var i = 0; i < total; i++) {
      var pos = getDancerPos(i, total);
      dancers[i].model.position.set(pos.x, 0, pos.z);
      dancers[i].model.lookAt(0, 0, 0);
    }
  }

  // Slider
  var slider = document.getElementById('slider');
  var countDisplay = document.getElementById('handy-count');
  slider.addEventListener('input', function() {
    var newCount = parseInt(slider.value);
    countDisplay.textContent = newCount;
    setDancerCount(newCount);
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

    for (var i = 0; i < dancers.length; i++) {
      dancers[i].mixer.update(delta);
    }

    // Slow cinematic camera orbit
    var a = frameT * 0.12;
    var dist = 8 + dancers.length * 0.4;
    camera.position.x = Math.sin(a) * dist;
    camera.position.z = Math.cos(a) * dist;
    camera.position.y = 2.5 + Math.sin(frameT * 0.2) * 0.8;
    camera.lookAt(0, 0.8, 0);

    // Sweep spotlights
    for (var s = 0; s < raveSpots.length; s++) {
      var sa = frameT * (0.4 + s * 0.08) + s * Math.PI / 2;
      raveSpots[s].target.position.set(Math.sin(sa) * 3, 0, Math.cos(sa) * 3);
      raveSpots[s].intensity = 2.5 + Math.sin(frameT * 1.5 + s) * 1.5;
    }

    // Rotate lasers
    laserGroup.rotation.y = frameT * 0.25;
    for (var ls = 0; ls < laserGroup.children.length; ls++) {
      laserGroup.children[ls].rotation.x = Math.sin(frameT * 1.2 + ls * 0.7) * 0.35;
      laserGroup.children[ls].material.opacity = 0.2 + Math.sin(frameT * 4 + ls) * 0.2;
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
    if (radioMode) {
      audioEl.src = RADIO_URL;
      audioEl.load();
    } else {
      loadTrack(0);
    }
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

  animate();

})();
