(() => {
  const { topics, dependencies, subjects } = window.CURRICULUM_DATA;
  const canvas = document.querySelector("#graphCanvas");
  const ctx = canvas.getContext("2d");
  const stage = document.querySelector(".graph-stage");
  const detailPanel = document.querySelector("#detailPanel");
  const tooltip = document.querySelector("#tooltip");
  const searchInput = document.querySelector("#searchInput");
  const searchResults = document.querySelector("#searchResults");
  const subjectFilter = document.querySelector("#subjectFilter");
  const playPathBtn = document.querySelector("#playPath");
  const byId = new Map(topics.map(topic => [topic.id, topic]));
  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const subjectOrder = Object.keys(subjects);
  const cssColor = subject => getComputedStyle(document.documentElement).getPropertyValue({
    "语文": "--chinese", "数学": "--math", "英语": "--english", "科学": "--science"
  }[subject]).trim();

  const state = {
    grade: "1-3",
    subject: "数学",
    rotationX: -0.18,
    rotationY: -0.38,
    zoom: 1,
    selected: null,
    hovered: null,
    dragging: false,
    moved: false,
    lastX: 0,
    lastY: 0,
    projected: [],
    visibleIds: new Set(),
    time: 0,
    animationFrame: 0,
    isAnimating: false,
    animatedEdges: new Map(),
    autoRotate: true,
    playingPath: false,
    playIndex: 0,
    playTopics: [],
    searchedId: null,
    entranceStart: performance.now()
  };

  const backgroundStars = Array.from({ length: 110 }, () => ({
    x: Math.random() * 1000,
    y: Math.random() * 600,
    size: Math.random() * 1.4 + 0.25,
    twinkleSpeed: Math.random() * 0.03 + 0.003,
    twinklePhase: Math.random() * Math.PI * 2,
    brightness: Math.random() * 0.6 + 0.2,
    type: Math.random() > 0.85 ? 'bright' : Math.random() > 0.95 ? 'super' : 'normal'
  }));

  const shootingStars = [];
  
  const spaceDust = Array.from({ length: 48 }, () => ({
    x: Math.random() * 1000,
    y: Math.random() * 600,
    size: Math.random() * 1.5 + 0.2,
    speedX: (Math.random() - 0.5) * 0.15,
    speedY: (Math.random() - 0.5) * 0.15,
    opacity: Math.random() * 0.4 + 0.1,
    color: Math.random() > 0.5 ? 'rgba(180, 190, 255,' : 'rgba(200, 180, 255,'
  }));

  const galaxyConfig = {
    centerX: 500, centerY: 300,
    rotation: 0,
    rotationSpeed: 0.00015,
    armCount: 4,
    armTightness: 0.018,
    coreRadius: 60,
    galaxyRadius: 580
  };

  // 生成螺旋臂粒子
  const galaxyParticles = [];
  const armColors = [
    [
      { r: 255, g: 210, b: 180 }, { r: 240, g: 140, b: 130 },
      { r: 200, g: 90, b: 140 }, { r: 140, g: 120, b: 200 }, { r: 80, g: 150, b: 220 }
    ],
    [
      { r: 255, g: 200, b: 170 }, { r: 230, g: 130, b: 120 },
      { r: 190, g: 100, b: 150 }, { r: 130, g: 130, b: 210 }, { r: 90, g: 160, b: 210 }
    ],
    [
      { r: 250, g: 215, b: 185 }, { r: 235, g: 145, b: 135 },
      { r: 210, g: 85, b: 135 }, { r: 150, g: 110, b: 190 }, { r: 70, g: 140, b: 230 }
    ],
    [
      { r: 255, g: 205, b: 175 }, { r: 225, g: 135, b: 125 },
      { r: 195, g: 95, b: 145 }, { r: 135, g: 125, b: 205 }, { r: 85, g: 155, b: 215 }
    ]
  ];

  for (let arm = 0; arm < galaxyConfig.armCount; arm++) {
    const armAngle = (arm / galaxyConfig.armCount) * Math.PI * 2;
    const perArm = 140;
    for (let i = 0; i < perArm; i++) {
      const t = (i / perArm) * 0.95 + Math.random() * 0.05;
      const r = galaxyConfig.coreRadius * 0.6 + t * galaxyConfig.galaxyRadius;
      const spiralAngle = armAngle + r * galaxyConfig.armTightness;
      const spread = (1 - t) * 8 + t * 55 + Math.random() * 20;
      const perpAngle = spiralAngle + Math.PI / 2;
      const scatterX = (Math.random() - 0.5) * spread * 2;
      const scatterY = (Math.random() - 0.5) * spread * 2;
      const x = Math.cos(spiralAngle) * r + Math.cos(perpAngle) * scatterX;
      const y = Math.sin(spiralAngle) * r + Math.sin(perpAngle) * scatterY;
      const colorIdx = Math.min(4, Math.floor(t * 5));
      const colorT = t * 5 - colorIdx;
      const c0 = armColors[arm][colorIdx];
      const c1 = armColors[arm][Math.min(4, colorIdx + 1)];
      const color = {
        r: Math.round(c0.r + (c1.r - c0.r) * colorT),
        g: Math.round(c0.g + (c1.g - c0.g) * colorT),
        b: Math.round(c0.b + (c1.b - c0.b) * colorT)
      };
      galaxyParticles.push({
        x, y, r, baseAngle: spiralAngle,
        size: 1.5 + (1 - t) * 10 + Math.random() * 8,
        opacity: 0.04 + (1 - t) * 0.10 + Math.random() * 0.05,
        color
      });
    }
  }

  // 尘埃带粒子
  const dustLanes = [];
  for (let lane = 0; lane < galaxyConfig.armCount; lane++) {
    const laneAngle = (lane / galaxyConfig.armCount) * Math.PI * 2 + Math.PI / galaxyConfig.armCount;
    for (let i = 0; i < 60; i++) {
      const t = 0.1 + Math.random() * 0.8;
      const r = galaxyConfig.coreRadius * 0.5 + t * galaxyConfig.galaxyRadius * 0.85;
      const spread = 25 + t * 40;
      const angle = laneAngle + r * galaxyConfig.armTightness + (Math.random() - 0.5) * 0.5;
      const x = Math.cos(angle) * r + (Math.random() - 0.5) * spread;
      const y = Math.sin(angle) * r + (Math.random() - 0.5) * spread;
      dustLanes.push({
        x, y, r, baseAngle: angle,
        size: 3 + Math.random() * 12,
        opacity: 0.03 + Math.random() * 0.08
      });
    }
  }

  // 晕轮粒子
  const haloParticles = [];
  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = galaxyConfig.coreRadius * 0.5 + Math.random() * galaxyConfig.galaxyRadius * 1.1;
    const x = Math.cos(angle) * r + (Math.random() - 0.5) * 80;
    const y = Math.sin(angle) * r + (Math.random() - 0.5) * 80;
    haloParticles.push({
      x, y, r, baseAngle: angle,
      size: 2 + Math.random() * 6,
      opacity: 0.01 + Math.random() * 0.04,
      color: Math.random() > 0.5 ? { r: 140, g: 160, b: 220 } : { r: 180, g: 140, b: 200 }
    });
  }

  // 四角不规则星云粒子
  const cornerNebulaParticles = [];
  const corners = [
    { cx: 0, cy: 0, angleRange: [0.3, 1.2], cr: 0, cg: 60, cb: 140 },
    { cx: 1, cy: 0, angleRange: [1.9, 2.8], cr: 80, cg: 40, cb: 120 },
    { cx: 0, cy: 1, angleRange: [4.5, 5.4], cr: 50, cg: 70, cb: 150 },
    { cx: 1, cy: 1, angleRange: [3.8, 4.9], cr: 90, cg: 50, cb: 130 }
  ];
  corners.forEach(corner => {
    for (let i = 0; i < 45; i++) {
      const angle = corner.angleRange[0] + Math.random() * (corner.angleRange[1] - corner.angleRange[0]);
      const dist = 0.15 + Math.random() * 0.55;
      const x = corner.cx + Math.cos(angle) * dist;
      const y = corner.cy + Math.sin(angle) * dist;
      const colorVar = Math.random() * 30 - 15;
      cornerNebulaParticles.push({
        x, y, dist,
        size: 6 + Math.random() * 18,
        opacity: 0.015 + Math.random() * 0.04,
        cr: Math.max(0, Math.min(255, corner.cr + colorVar)),
        cg: Math.max(0, Math.min(255, corner.cg + colorVar)),
        cb: Math.max(0, Math.min(255, corner.cb + colorVar))
      });
    }
  });

  const nodes = topics.map((topic, index) => {
    const s = subjectOrder.indexOf(topic.subject);
    const subjectAngle = s / subjectOrder.length * Math.PI * 2;
    const gradeAngle = (topic.grade - 1) * 0.73;
    const inferredOrder = topics.filter(t => t.subject === topic.subject && t.grade === topic.grade).findIndex(t => t.id === topic.id);
    const within = Number.isFinite(topic.order) ? topic.order - 1 : inferredOrder;
    const radius = 115 + topic.grade * 29 + within * 13;
    const angle = subjectAngle + gradeAngle + within * 0.46;
    return {
      ...topic,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: (3.5 - topic.grade) * 78 + Math.sin(index * 1.9) * 18,
      baseRadius: 5.5 + topic.grade * 0.4
    };
  });

  function resize() {
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function filtered(topic) {
    const gradeMatch = state.grade === "all" || 
      String(topic.grade) === state.grade ||
      (state.grade === "1-3" && topic.grade >= 1 && topic.grade <= 3);
    const subjectMatch = state.subject === "all" || topic.subject === state.subject;
    return gradeMatch && subjectMatch;
  }

  function rotate(node) {
    const cosY = Math.cos(state.rotationY), sinY = Math.sin(state.rotationY);
    const x1 = node.x * cosY - node.z * sinY;
    const z1 = node.x * sinY + node.z * cosY;
    const cosX = Math.cos(state.rotationX), sinX = Math.sin(state.rotationX);
    const y2 = node.y * cosX - z1 * sinX;
    const z2 = node.y * sinX + z1 * cosX;
    return { x: x1, y: y2, z: z2 };
  }

  function project(node, width, height) {
    const p = rotate(node);
    const perspective = 720 / (900 + p.z);
    const scale = state.zoom * perspective;
    return {
      ...node,
      sx: width * .5 + p.x * scale,
      sy: height * .53 + p.y * scale,
      depth: p.z,
      radius: Math.max(3.8, node.baseRadius * scale * 1.2),
      alpha: Math.max(.3, Math.min(1, .72 - p.z / 1250))
    };
  }

  function getRelated(id) {
    const incoming = dependencies.filter(d => d.topicId === id).map(d => d.prerequisiteId);
    const outgoing = dependencies.filter(d => d.prerequisiteId === id).map(d => d.topicId);
    return { incoming, outgoing, all: new Set([id, ...incoming, ...outgoing]) };
  }

  function drawGalaxy(width, height) {
    const cx = width * 0.5;
    const cy = height * 0.5;
    const scale = Math.min(width, height) / 650;
    const coreR = galaxyConfig.coreRadius * scale;
    const galR = galaxyConfig.galaxyRadius * scale;
    
    galaxyConfig.rotation += galaxyConfig.rotationSpeed;
    const rot = galaxyConfig.rotation;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    
    // 1. 外层大椭圆晕轮
    const haloGrad = ctx.createRadialGradient(cx, cy, coreR * 0.5, cx, cy, galR * 1.2);
    haloGrad.addColorStop(0, 'rgba(140, 120, 180, 0.04)');
    haloGrad.addColorStop(0.5, 'rgba(100, 130, 180, 0.02)');
    haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.ellipse(cx, cy, galR * 1.2, galR * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = haloGrad;
    ctx.fill();
    
    // 2. 银盘椭圆基底
    const diskGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, galR);
    diskGrad.addColorStop(0, 'rgba(180, 150, 200, 0.06)');
    diskGrad.addColorStop(0.3, 'rgba(120, 100, 160, 0.03)');
    diskGrad.addColorStop(0.6, 'rgba(80, 100, 140, 0.015)');
    diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.ellipse(cx, cy, galR, galR * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = diskGrad;
    ctx.fill();
    
    // 3. 四角星云粒子
    cornerNebulaParticles.forEach(p => {
      const px = p.x * width;
      const py = p.y * height;
      const pulse = Math.sin(state.time * 0.0005 + p.dist * 3) * 0.25 + 0.75;
      const alpha = p.opacity * pulse;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size);
      grad.addColorStop(0, `rgba(${p.cr}, ${p.cg}, ${p.cb}, ${alpha})`);
      grad.addColorStop(0.6, `rgba(${p.cr}, ${p.cg}, ${p.cb}, ${alpha * 0.3})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
    
    // 4. 尘埃带
    dustLanes.forEach(dust => {
      const rx = dust.x * cosR * scale - dust.y * sinR * scale;
      const ry = (dust.x * sinR + dust.y * cosR) * scale;
      const px = cx + rx;
      const py = cy + ry * 0.35;
      const pulse = Math.sin(state.time * 0.0008 + dust.r * 0.003) * 0.2 + 0.8;
      const alpha = dust.opacity * pulse;
      const s = dust.size * scale;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, s);
      grad.addColorStop(0, `rgba(30, 25, 35, ${alpha})`);
      grad.addColorStop(0.6, `rgba(20, 15, 25, ${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(px, py, s, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
    
    // 5. 晕轮粒子
    haloParticles.forEach(p => {
      const rx = p.x * cosR * scale - p.y * sinR * scale;
      const ry = (p.x * sinR + p.y * cosR) * scale;
      const px = cx + rx;
      const py = cy + ry * 0.35;
      const alpha = p.opacity * (Math.sin(state.time * 0.001 + p.r * 0.002) * 0.3 + 0.7);
      const s = p.size * scale;
      ctx.beginPath();
      ctx.arc(px, py, s, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`;
      ctx.fill();
    });
    
    // 6. 螺旋臂粒子
    galaxyParticles.forEach(p => {
      const rx = p.x * cosR * scale - p.y * sinR * scale;
      const ry = (p.x * sinR + p.y * cosR) * scale;
      const px = cx + rx;
      const py = cy + ry * 0.35;
      const pulse = Math.sin(state.time * 0.0006 + p.r * 0.002) * 0.25 + 0.75;
      const alpha = p.opacity * pulse;
      const s = p.size * scale;
      const grad = ctx.createRadialGradient(px, py, 0, px, py, s);
      grad.addColorStop(0, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha})`);
      grad.addColorStop(0.5, `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${alpha * 0.5})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.beginPath();
      ctx.arc(px, py, s, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });
    
    // 7. 银核亮光
    const coreGlow1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 0.8);
    coreGlow1.addColorStop(0, 'rgba(255, 240, 220, 0.18)');
    coreGlow1.addColorStop(0.3, 'rgba(255, 210, 180, 0.10)');
    coreGlow1.addColorStop(0.6, 'rgba(200, 160, 200, 0.04)');
    coreGlow1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = coreGlow1;
    ctx.fill();
    
    const coreGlow2 = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 0.25);
    coreGlow2.addColorStop(0, 'rgba(255, 255, 245, 0.3)');
    coreGlow2.addColorStop(0.5, 'rgba(255, 230, 200, 0.12)');
    coreGlow2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = coreGlow2;
    ctx.fill();
  }

  function drawBackgroundStars(width, height) {
    spaceDust.forEach(dust => {
      dust.x += dust.speedX;
      dust.y += dust.speedY;
      
      if (dust.x < 0) dust.x = width;
      if (dust.x > width) dust.x = 0;
      if (dust.y < 0) dust.y = height;
      if (dust.y > height) dust.y = 0;
      
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dust.size, 0, Math.PI * 2);
      ctx.fillStyle = dust.color + dust.opacity + ')';
      ctx.fill();
    });
    
    backgroundStars.forEach(star => {
      const twinkle = Math.sin(state.time * star.twinkleSpeed + star.twinklePhase);
      const alpha = star.brightness + twinkle * 0.2;
      const x = star.x % width;
      const y = star.y % height;
      
      if (star.type === 'super') {
        const glowPulse = Math.sin(state.time * 0.008) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(x, y, star.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 240, ${0.15 * glowPulse})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, star.size * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 240, ${0.3 * glowPulse})`;
        ctx.fill();
      } else if (star.type === 'bright') {
        ctx.beginPath();
        ctx.arc(x, y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${0.1})`;
        ctx.fill();
      }
      
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = star.type === 'super' ? `rgba(255, 255, 240, ${Math.max(0.3, Math.min(1, alpha))})` :
                      star.type === 'bright' ? `rgba(200, 220, 255, ${Math.max(0.2, Math.min(0.9, alpha))})` :
                      `rgba(255, 255, 255, ${Math.max(0.1, Math.min(0.8, alpha))})`;
      ctx.fill();
      
      if (star.size > 1.5) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, star.size * 3);
        glow.addColorStop(0, `rgba(200, 220, 255, ${alpha * 0.3})`);
        glow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(x, y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
      }
    });
    
    if (Math.random() < 0.002) {
      shootingStars.push({
        x: Math.random() * width,
        y: Math.random() * height * 0.3,
        length: Math.random() * 80 + 40,
        angle: Math.PI / 4 + (Math.random() - 0.5) * 0.5,
        speed: Math.random() * 8 + 6,
        opacity: 1,
        life: 1
      });
    }
    
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const star = shootingStars[i];
      star.x += Math.cos(star.angle) * star.speed;
      star.y += Math.sin(star.angle) * star.speed;
      star.life -= 0.03;
      star.opacity = star.life;
      
      if (star.life <= 0 || star.x > width || star.y > height) {
        shootingStars.splice(i, 1);
        continue;
      }
      
      const gradient = ctx.createLinearGradient(
        star.x - Math.cos(star.angle) * star.length * star.life,
        star.y - Math.sin(star.angle) * star.length * star.life,
        star.x,
        star.y
      );
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
      gradient.addColorStop(0.7, `rgba(200, 220, 255, ${star.opacity * 0.6})`);
      gradient.addColorStop(1, `rgba(255, 255, 255, ${star.opacity})`);
      
      ctx.beginPath();
      ctx.moveTo(star.x - Math.cos(star.angle) * star.length * star.life, star.y - Math.sin(star.angle) * star.length * star.life);
      ctx.lineTo(star.x, star.y);
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(star.x, star.y, 2 * star.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
      ctx.fill();
    }
  }

  function drawOrbitNode(ctx, x, y, radius, color, options = {}) {
    const { selected = false, hovered = false, related = false, searched = false, pulse = 1, alpha = 1 } = options;
    const showOrbit = selected || hovered || related;
    const orbitAlpha = selected ? 0.82 : hovered ? 0.58 : 0.22;
    const orbitWidth = selected ? 1.15 : 0.75;
    const orbitScale = selected ? 1.55 : hovered ? 1.42 : 1.26;
    const tilt = options.tilt || 0;

    if (showOrbit) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.lineWidth = orbitWidth;
      ctx.strokeStyle = `color-mix(in oklch, ${color} ${Math.round(orbitAlpha * 100)}%, white)`;
      ctx.globalAlpha *= orbitAlpha;

      // Ordinary nodes stay star-like; interaction progressively reveals the orbit.
      ctx.beginPath();
      ctx.ellipse(0, 0, radius * orbitScale, radius * 0.42 * orbitScale, 0, selected ? 0 : -0.65, selected ? Math.PI * 2 : Math.PI * 0.9);
      ctx.stroke();
      if (selected) {
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * 0.48 * orbitScale, radius * 1.08 * orbitScale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha *= 0.82;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.86, 0, Math.PI * 2);
        ctx.strokeStyle = `color-mix(in oklch, ${color} 65%, white)`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }

    const coreRadius = radius * (selected ? 0.72 : hovered ? 0.58 : 0.44);
    const coreGradient = ctx.createRadialGradient(
      x - coreRadius * 0.28, y - coreRadius * 0.32, 0,
      x, y, coreRadius
    );
    coreGradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    coreGradient.addColorStop(0.32, `color-mix(in oklch, ${color} 78%, white)`);
    coreGradient.addColorStop(1, color);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, coreRadius, 0, Math.PI * 2);
    ctx.fillStyle = coreGradient;
    ctx.fill();
  }

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);

    if (!prefersReducedMotion) {
      stage.style.setProperty("--bg-shift-x", `${(Math.sin(state.rotationY) * -10).toFixed(2)}px`);
      stage.style.setProperty("--bg-shift-y", `${(Math.sin(state.rotationX) * -7).toFixed(2)}px`);
    }
    
    drawBackgroundStars(width, height);
    
    state.projected = nodes.filter(filtered).map(n => project(n, width, height));
    state.visibleIds = new Set(state.projected.map(n => n.id));
    const projectedById = new Map(state.projected.map(n => [n.id, n]));
    const related = state.selected ? getRelated(state.selected) : null;

    ctx.save();
    ctx.lineCap = "round";
    dependencies.forEach(edge => {
      const a = projectedById.get(edge.prerequisiteId);
      const b = projectedById.get(edge.topicId);
      if (!a || !b) return;
      const edgeKey = `${edge.prerequisiteId}-${edge.topicId}`;
      const isRelated = related && (related.all.has(a.id) || related.all.has(b.id));
      const dim = related && !isRelated;
      const edgeColor = cssColor(byId.get(edge.topicId).subject);
      
      const mx = (a.sx + b.sx) / 2 + (a.depth - b.depth) * .025;
      const my = (a.sy + b.sy) / 2 - 4;
      
      let progress = -1;
      if (state.isAnimating && isRelated) {
        const anim = state.animatedEdges.get(edgeKey);
        if (anim) {
          const totalTime = state.animationFrame * 16;
          const elapsed = totalTime - anim.delay;
          if (elapsed > 0) {
            progress = Math.min(1, elapsed / anim.duration);
            progress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
          } else {
            progress = 0;
          }
        }
      } else if (state.animatedEdges.has(edgeKey)) {
        progress = 1;
      }
      
      if (progress < 0) return;
    
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      if (progress < 1) {
        const t = progress;
        const px = (1 - t) * (1 - t) * a.sx + 2 * (1 - t) * t * mx + t * t * b.sx;
        const py = (1 - t) * (1 - t) * a.sy + 2 * (1 - t) * t * my + t * t * b.sy;
        ctx.quadraticCurveTo(mx, my, px, py);
        
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        
        const headGlow = ctx.createRadialGradient(px, py, 0, px, py, 15);
        headGlow.addColorStop(0, "rgba(255, 255, 255, 0.8)");
        headGlow.addColorStop(0.5, "rgba(200, 220, 255, 0.3)");
        headGlow.addColorStop(1, "transparent");
        ctx.beginPath();
        ctx.arc(px, py, 15, 0, Math.PI * 2);
        ctx.fillStyle = headGlow;
        ctx.fill();
      } else {
        ctx.quadraticCurveTo(mx, my, b.sx, b.sy);
        
        if (isRelated) {
          ctx.strokeStyle = `color-mix(in oklch, ${edgeColor} 70%, white)`;
          ctx.lineWidth = edge.type === "recommended" ? 1.5 : 2;
          ctx.setLineDash(edge.type === "recommended" ? [6, 4] : []);
          ctx.stroke();
          
          const glowGradient = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
          glowGradient.addColorStop(0, `color-mix(in oklch, ${edgeColor} 40%, transparent)`);
          glowGradient.addColorStop(0.5, `color-mix(in oklch, ${edgeColor} 25%, transparent)`);
          glowGradient.addColorStop(1, `color-mix(in oklch, ${edgeColor} 40%, transparent)`);
          ctx.strokeStyle = glowGradient;
          ctx.lineWidth = 6;
          ctx.stroke();
        } else {
          ctx.strokeStyle = dim ? `rgba(80, 90, 110, 0)` : `rgba(100, 115, 140, 0)`;
          ctx.lineWidth = 0;
          ctx.setLineDash([]);
          ctx.stroke();
        }
      }
    });
    ctx.restore();

    state.projected.sort((a, b) => b.depth - a.depth).forEach((node, nodeIndex) => {
      const isSelected = node.id === state.selected;
      const isHovered = node.id === state.hovered;
      const isRelated = related?.all.has(node.id);
      const dimmed = related && !isRelated;
      const color = cssColor(node.subject);
      
      // 入场动画：每个节点有渐进的延迟
      const entranceElapsed = state.time - state.entranceStart;
      const entranceDelay = nodeIndex * 35;
      const entranceDuration = 800;
      const entranceRaw = (entranceElapsed - entranceDelay) / entranceDuration;
      const entranceProgress = Math.max(0, Math.min(1, entranceRaw < 0.5 ? 2 * entranceRaw * entranceRaw : -1 + (4 - 2 * entranceRaw) * entranceRaw));
      
      ctx.save();
      ctx.globalAlpha = dimmed ? .11 : node.alpha * entranceProgress;
      
      const pulsePhase = state.time * 0.003 + node.id.charCodeAt(0) * 0.05;
      const pulseScale = 1 + Math.sin(pulsePhase) * 0.15;
      
      let nodeProgress = 1;
      if (state.isAnimating && state.selected && node.id !== state.selected) {
        const related = getRelated(state.selected);
        if (related && related.all.has(node.id)) {
          let nodeIndex = -1;
          const edgeKeys = Array.from(state.animatedEdges.keys());
          edgeKeys.forEach((key, index) => {
            if (key.includes(node.id)) {
              nodeIndex = index;
            }
          });
          if (nodeIndex >= 0) {
            const totalTime = state.animationFrame * 16;
            const delay = state.animatedEdges.get(edgeKeys[nodeIndex])?.delay || 0;
            const elapsed = totalTime - delay + 300;
            if (elapsed > 0) {
              nodeProgress = Math.min(1, elapsed / 500);
            } else {
              nodeProgress = 0;
            }
          }
        }
      }
      
      const isSearched = state.searchedId === node.id;
      const searchPulse = isSearched ? 1 + Math.sin(state.time * 0.015) * 0.4 : 1;
      const glowIntensity = isSelected ? 1.05 : isHovered ? 0.72 : isSearched ? 1.38 * searchPulse : isRelated ? 0.52 * nodeProgress : 0.34;
      const glowRadius = node.radius * (isSearched ? 3.25 : 2.15) * glowIntensity * pulseScale;
      
      const gradient = ctx.createRadialGradient(node.sx, node.sy, node.radius * 0.3, node.sx, node.sy, glowRadius);
      gradient.addColorStop(0, `color-mix(in oklch, ${color} ${isSearched ? 86 : 64}%, white)`);
      gradient.addColorStop(0.3, `color-mix(in oklch, ${color} ${isSearched ? 48 : 24}%, transparent)`);
      gradient.addColorStop(0.62, `color-mix(in oklch, ${color} ${isSearched ? 18 : 8}%, transparent)`);
      gradient.addColorStop(1, "transparent");
      
      ctx.beginPath();
      ctx.arc(node.sx, node.sy, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      const nodeAlpha = isRelated ? node.alpha * (0.5 + 0.5 * nodeProgress) : node.alpha;
      const nodeRadius = node.radius * (isSelected ? 1.28 : isHovered ? 1.16 : isRelated ? 1.08 * nodeProgress : 1) * (0.62 + 0.38 * entranceProgress);
      const orbitTilt = ((node.id.charCodeAt(0) * 0.37 + node.id.length) % 10 - 5) * 0.12;
      drawOrbitNode(ctx, node.sx, node.sy, nodeRadius, color, {
        selected: isSelected,
        hovered: isHovered,
        related: isRelated,
        searched: isSearched,
        pulse: searchPulse,
        tilt: orbitTilt,
        alpha: nodeAlpha
      });
      ctx.restore();
    });

    document.querySelector("#visibleCount").textContent = state.projected.length;
    document.querySelector("#edgeCount").textContent = dependencies.filter(d => state.visibleIds.has(d.topicId) && state.visibleIds.has(d.prerequisiteId)).length;
  }

  function nearestNode(x, y) {
    return [...state.projected].reverse().find(node => Math.hypot(node.sx - x, node.sy - y) < Math.max(10, node.radius + 5));
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function selectTopic(id) {
    const topic = byId.get(id);
    if (!topic) return;
    state.selected = id;
    state.animatedEdges.clear();
    
    const related = getRelated(id);
    if (related) {
      const allRelatedEdges = dependencies.filter(edge => 
        related.all.has(edge.prerequisiteId) && related.all.has(edge.topicId)
      );
      
      allRelatedEdges.sort((a, b) => {
        const gradeA = byId.get(a.topicId)?.grade || 0;
        const gradeB = byId.get(b.topicId)?.grade || 0;
        return gradeA - gradeB;
      });
      
      allRelatedEdges.forEach((edge, index) => {
        const edgeKey = `${edge.prerequisiteId}-${edge.topicId}`;
        state.animatedEdges.set(edgeKey, {
          delay: index * 300,
          duration: 800
        });
      });
    }
    
    state.animationFrame = 0;
    state.isAnimating = true;
    
    if (!filtered(topic)) {
      state.grade = "all";
      state.subject = "all";
      syncFilters();
    }
    renderDetail(topic);
    detailPanel.classList.add("is-open");
    searchResults.hidden = true;
    searchInput.blur();
    draw();
  }

  function renderDetail(topic) {
    const color = cssColor(topic.subject);
    document.querySelector("#emptyDetail").hidden = true;
    document.querySelector("#nodeDetail").hidden = false;
    document.querySelector("#nodeDetail").style.setProperty("--topic-color", color);
    document.querySelector("#detailSubject").textContent = topic.subject;
    document.querySelector("#detailGrade").textContent = `${topic.grade}年级`;
    document.querySelector("#detailName").textContent = topic.name;
    document.querySelector("#detailDomain").textContent = topic.source ? `${topic.domain} · 来源：${topic.source}` : topic.domain;

    // 1. 基础标签
    const stageMap = { 1: "第一学段（1-2年级）", 2: "第一学段（1-2年级）", 3: "第二学段（3-4年级）", 4: "第二学段（3-4年级）", 5: "第三学段（5-6年级）", 6: "第三学段（5-6年级）" };
    const basicItems = [
      { label: "学段", value: topic.stage || stageMap[topic.grade] || "—" },
      { label: "章节", value: topic.chapter || topic.domain || "—" },
      { label: "课时", value: topic.lesson || "—" },
      { label: "课标核心要求", value: topic.curriculumStandard || "—", span: 2 }
    ];
    document.querySelector("#basicInfo").innerHTML = basicItems.map(item => `
      <div class="info-item${item.span ? ' span-2' : ''}">
        <span class="info-label">${item.label}</span>
        <span class="info-value">${item.value}</span>
      </div>
    `).join("");

    // 2. 图谱逻辑链路
    const related = getRelated(topic.id);
    const chainHTML = `
      <div class="chain-tier prereq">
        <div class="chain-tier-label">前置知识点（逻辑前提）</div>
        <div class="chain-tier-nodes">${related.incoming.length ? related.incoming.map(id => {
          const t = byId.get(id);
          return `<span class="chain-node clickable" data-id="${id}">${t ? t.name : id}</span>`;
        }).join("") : '<span class="empty-text">无（本级为起点）</span>'}</div>
      </div>
      <div class="chain-arrow">↓</div>
      <div class="chain-tier core">
        <div class="chain-tier-label">本级核心</div>
        <div class="chain-tier-nodes"><span class="chain-node">${topic.name}</span></div>
      </div>
      <div class="chain-arrow">↓</div>
      <div class="chain-tier derived">
        <div class="chain-tier-label">后置衍生知识点（逻辑延伸）</div>
        <div class="chain-tier-nodes">${related.outgoing.length ? related.outgoing.map(id => {
          const t = byId.get(id);
          return `<span class="chain-node clickable" data-id="${id}">${t ? t.name : id}</span>`;
        }).join("") : '<span class="empty-text">无（本级为终点）</span>'}</div>
      </div>
    `;
    const graphChain = document.querySelector("#graphChain");
    graphChain.innerHTML = chainHTML;
    graphChain.querySelectorAll(".chain-node.clickable").forEach(el => {
      el.addEventListener("click", () => selectTopic(el.dataset.id));
    });

    // 3. 核心目标
    document.querySelector("#coreGoals").innerHTML = `
      <div class="goal-card">
        <div class="goal-label knowledge">（1）知识目标</div>
        <div class="goal-text">${topic.knowledgeGoal || topic.description || "暂无"}</div>
      </div>
      <div class="goal-card">
        <div class="goal-label ability">（2）能力目标</div>
        <div class="goal-text">${topic.abilityGoal || "暂无"}</div>
      </div>
      <div class="goal-card">
        <div class="goal-label competency">（3）素养目标</div>
        <div class="goal-text">${topic.competencyGoal || "暂无"}</div>
      </div>
    `;

    // 4. 知识内容
    const formulasHTML = (topic.formulas && topic.formulas.length > 0)
      ? `<ul>${topic.formulas.map(f => `<li>${f}</li>`).join("")}</ul>`
      : '<p class="empty-text">暂无</p>';
    const propertiesHTML = (topic.properties && topic.properties.length > 0)
      ? `<ul>${topic.properties.map(p => `<li>${p}</li>`).join("")}</ul>`
      : '<p class="empty-text">暂无</p>';
    document.querySelector("#knowledgeContent").innerHTML = `
      <div class="knowledge-block">
        <div class="kb-label">（1）定义</div>
        <div class="kb-text">${topic.definition || topic.description || "暂无"}</div>
      </div>
      <div class="knowledge-block">
        <div class="kb-label">（2）性质</div>
        ${propertiesHTML}
      </div>
      <div class="knowledge-block">
        <div class="kb-label">（3）公式</div>
        ${formulasHTML}
      </div>
    `;

    // 5. 知识练习（五步法）
    const fp = topic.fiveStepPractice;
    const stepNames = [
      { title: "审题", key: "examine" },
      { title: "建模", key: "model" },
      { title: "分步", key: "steps" },
      { title: "检验", key: "verify" },
      { title: "反思", key: "reflect" }
    ];
    document.querySelector("#fiveSteps").innerHTML = stepNames.map((step, i) => `
      <div class="step-row">
        <div class="step-num">${i + 1}</div>
        <div class="step-body">
          <div class="step-title">${step.title}</div>
          <div class="step-desc">${fp ? fp[step.key] || "暂无" : "暂无"}</div>
        </div>
      </div>
    `).join("");

    detailPanel.scrollTop = 0;
  }

  function clearSelection() {
    state.selected = null;
    state.searchedId = null;
    state.isAnimating = false;
    state.animationFrame = 0;
    state.animatedEdges.clear();
    detailPanel.classList.remove("is-open");
    document.querySelector("#emptyDetail").hidden = false;
    document.querySelector("#nodeDetail").hidden = true;
    draw();
  }

  function syncFilters() {
    document.querySelectorAll("#gradeFilters .chip").forEach(button => button.classList.toggle("is-active", button.dataset.grade === state.grade));
    subjectFilter.value = state.subject;
    document.querySelectorAll(".legend button").forEach(button => button.classList.toggle("is-muted", state.subject !== "all" && button.dataset.subject !== state.subject));
    const gradeText = state.grade === "all" ? "一至六年级" : state.grade === "1-3" ? "一至三年级" : `${state.grade}年级`;
    document.querySelector("#stageEyebrow").textContent = `${gradeText} · ${state.subject === "all" ? "中国小学课程" : state.subject}`;
    state.entranceStart = performance.now();
    draw();
  }

  canvas.addEventListener("pointerdown", event => {
    canvas.setPointerCapture(event.pointerId);
    state.dragging = true;
    state.moved = false;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
  });
  canvas.addEventListener("pointermove", event => {
    const p = canvasPoint(event);
    if (state.dragging) {
      const dx = event.clientX - state.lastX;
      const dy = event.clientY - state.lastY;
      if (Math.abs(dx) + Math.abs(dy) > 2) state.moved = true;
      state.rotationY += dx * .006;
      state.rotationX = Math.max(-1.25, Math.min(1.25, state.rotationX + dy * .005));
      state.lastX = event.clientX;
      state.lastY = event.clientY;
      tooltip.hidden = true;
      draw();
      return;
    }
    const hit = nearestNode(p.x, p.y);
    state.hovered = hit?.id || null;
    if (hit) {
      tooltip.innerHTML = `<b>${hit.name}</b><span>${hit.grade}年级 · ${hit.subject} · ${hit.domain}</span>`;
      tooltip.style.left = `${p.x}px`;
      tooltip.style.top = `${p.y}px`;
      tooltip.hidden = false;
    } else tooltip.hidden = true;
    draw();
  });
  canvas.addEventListener("pointerup", event => {
    const p = canvasPoint(event);
    state.dragging = false;
    if (!state.moved) {
      const hit = nearestNode(p.x, p.y);
      if (hit) selectTopic(hit.id);
    }
  });
  canvas.addEventListener("pointerleave", () => { state.hovered = null; tooltip.hidden = true; draw(); });
  canvas.addEventListener("wheel", event => {
    event.preventDefault();
    state.zoom = Math.max(.55, Math.min(2.1, state.zoom * Math.exp(-event.deltaY * .001)));
    draw();
  }, { passive: false });

  document.querySelectorAll("#gradeFilters .chip").forEach(button => button.addEventListener("click", () => {
    state.grade = button.dataset.grade;
    if (state.selected && !filtered(byId.get(state.selected))) clearSelection();
    syncFilters();
  }));
  subjectFilter.addEventListener("change", () => {
    state.subject = subjectFilter.value;
    if (state.selected && !filtered(byId.get(state.selected))) clearSelection();
    syncFilters();
  });
  document.querySelectorAll(".legend button").forEach(button => button.addEventListener("click", () => {
    state.subject = state.subject === button.dataset.subject ? "all" : button.dataset.subject;
    syncFilters();
  }));

  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) { searchResults.hidden = true; return; }
    const results = topics.filter(t => [t.name, t.subject, t.domain, t.description].some(v => v.toLowerCase().includes(query))).slice(0, 9);
    searchResults.innerHTML = results.length ? results.map(topic => `<button class="search-result" type="button" data-id="${topic.id}" style="--subject-color:${cssColor(topic.subject)}"><i></i><span>${topic.name}</span><small>${topic.grade}年级 · ${topic.subject}</small></button>`).join("") : '<div style="padding:18px;text-align:center;color:var(--muted);font-size:12px">没有找到相关知识点</div>';
    searchResults.hidden = false;
  });
  searchResults.addEventListener("click", event => {
    const button = event.target.closest("[data-id]");
    if (button) {
      state.searchedId = button.dataset.id;
      selectTopic(button.dataset.id);
    }
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".search-wrap")) searchResults.hidden = true;
  });
  document.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault(); searchInput.focus();
    }
    if (event.key === "Escape") { searchResults.hidden = true; clearSelection(); }
  });

  document.querySelector("#zoomIn").addEventListener("click", () => { state.zoom = Math.min(2.1, state.zoom * 1.16); draw(); });
  document.querySelector("#zoomOut").addEventListener("click", () => { state.zoom = Math.max(.55, state.zoom / 1.16); draw(); });
  document.querySelector("#resetView").addEventListener("click", () => {
    state.rotationX = -.18; state.rotationY = -.38; state.zoom = 1;
    if (!prefersReducedMotion) {
      canvas.animate([{ opacity: .55 }, { opacity: 1 }], { duration: 260, easing: "ease-out" });
    }
    draw();
  });
  document.querySelector("#closeDetail").addEventListener("click", clearSelection);

  // 菜单栏折叠/展开
  detailPanel.addEventListener("click", event => {
    const header = event.target.closest(".menu-header");
    if (!header) return;
    const section = header.dataset.section;
    const content = document.querySelector(`#${section}Section`);
    if (!content) return;
    const expanded = header.classList.toggle("is-expanded");
    content.hidden = !expanded;
  });

  playPathBtn.addEventListener("click", () => {
    if (state.playingPath) {
      state.playingPath = false;
      playPathBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
      return;
    }
    
    state.playTopics = topics
      .filter(t => t.subject === "数学" && t.grade >= 1 && t.grade <= 6)
      .sort((a, b) => a.grade - b.grade || (a.order || 0) - (b.order || 0));
    
    if (state.playTopics.length === 0) {
      state.playTopics = topics
        .filter(t => t.subject === "数学")
        .sort((a, b) => a.grade - b.grade || (a.order || 0) - (b.order || 0));
    }
    
    state.playingPath = true;
    state.playIndex = 0;
    playPathBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
  });

  new ResizeObserver(resize).observe(stage);
  syncFilters();
  
  function animate() {
    state.time += 16;
    if (state.isAnimating) {
      state.animationFrame++;
      const maxDelay = Array.from(state.animatedEdges.values())
        .reduce((max, anim) => Math.max(max, anim.delay + anim.duration), 0);
      if (state.animationFrame * 16 >= maxDelay + 500) {
        state.isAnimating = false;
      }
    }
    if (state.playingPath) {
      const interval = 2500;
      const elapsed = state.time % interval;
      if (elapsed < 100 && state.playIndex < state.playTopics.length) {
        const topic = state.playTopics[state.playIndex];
        if (topic) {
          selectTopic(topic.id);
          state.playIndex++;
        }
      } else if (state.playIndex >= state.playTopics.length) {
        state.playingPath = false;
        playPathBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
      }
    }
    if (state.autoRotate && !state.dragging) {
      state.rotationY += 0.0015;
      state.rotationX = -0.18 + Math.sin(state.time * 0.0005) * 0.1;
    }
    draw();
    requestAnimationFrame(animate);
  }
  animate();
})();
