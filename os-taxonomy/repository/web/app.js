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
  const byId = new Map(topics.map(topic => [topic.id, topic]));
  const prefersReducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const subjectOrder = Object.keys(subjects);
  const cssColor = subject => getComputedStyle(document.documentElement).getPropertyValue({
    "语文": "--chinese", "数学": "--math", "英语": "--english", "科学": "--science"
  }[subject]).trim();

  const state = {
    grade: "all",
    subject: "all",
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
    time: 0
  };

  const backgroundStars = Array.from({ length: 200 }, (_, i) => ({
    x: Math.random() * 1000,
    y: Math.random() * 600,
    size: Math.random() * 2.5 + 0.5,
    twinkleSpeed: Math.random() * 0.02 + 0.005,
    twinklePhase: Math.random() * Math.PI * 2,
    brightness: Math.random() * 0.5 + 0.3
  }));

  const nebulas = [
    { x: 200, y: 150, radius: 350, r: 80, g: 60, b: 140, speedX: 0.08, speedY: 0.05, opacity: 0.35 },
    { x: 700, y: 400, radius: 400, r: 70, g: 70, b: 130, speedX: -0.06, speedY: 0.03, opacity: 0.30 },
    { x: 450, y: 300, radius: 320, r: 75, g: 65, b: 135, speedX: 0.04, speedY: -0.04, opacity: 0.28 },
    { x: 100, y: 450, radius: 280, r: 65, g: 75, b: 125, speedX: 0.03, speedY: 0.06, opacity: 0.25 },
    { x: 800, y: 180, radius: 280, r: 78, g: 62, b: 138, speedX: -0.05, speedY: -0.03, opacity: 0.27 },
    { x: 550, y: 500, radius: 250, r: 62, g: 72, b: 122, speedX: 0.07, speedY: 0.02, opacity: 0.22 }
  ];

  const nodes = topics.map((topic, index) => {
    const s = subjectOrder.indexOf(topic.subject);
    const subjectAngle = s / subjectOrder.length * Math.PI * 2;
    const gradeAngle = (topic.grade - 1) * 0.73;
    const within = topics.filter(t => t.subject === topic.subject && t.grade === topic.grade).findIndex(t => t.id === topic.id);
    const radius = 115 + topic.grade * 29 + within * 13;
    const angle = subjectAngle + gradeAngle + within * 0.46;
    return {
      ...topic,
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: (3.5 - topic.grade) * 78 + Math.sin(index * 1.9) * 18,
      baseRadius: 4.4 + topic.grade * 0.3
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
    return (state.grade === "all" || String(topic.grade) === state.grade) &&
      (state.subject === "all" || topic.subject === state.subject);
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
      radius: Math.max(2.4, node.baseRadius * scale),
      alpha: Math.max(.3, Math.min(1, .72 - p.z / 1250))
    };
  }

  function getRelated(id) {
    const incoming = dependencies.filter(d => d.topicId === id).map(d => d.prerequisiteId);
    const outgoing = dependencies.filter(d => d.prerequisiteId === id).map(d => d.topicId);
    return { incoming, outgoing, all: new Set([id, ...incoming, ...outgoing]) };
  }

  function drawNebula(width, height) {
    nebulas.forEach(nebula => {
      nebula.x += nebula.speedX;
      nebula.y += nebula.speedY;
      
      if (nebula.x < -nebula.radius) nebula.x = width + nebula.radius;
      if (nebula.x > width + nebula.radius) nebula.x = -nebula.radius;
      if (nebula.y < -nebula.radius) nebula.y = height + nebula.radius;
      if (nebula.y > height + nebula.radius) nebula.y = -nebula.radius;
      
      const pulse = Math.sin(state.time * 0.001 + nebula.x * 0.001) * 0.3 + 0.7;
      const alpha = nebula.opacity * pulse;
      
      const gradient = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.radius);
      gradient.addColorStop(0, `rgba(${nebula.r}, ${nebula.g}, ${nebula.b}, ${alpha})`);
      gradient.addColorStop(0.4, `rgba(${nebula.r}, ${nebula.g}, ${nebula.b}, ${alpha * 0.6})`);
      gradient.addColorStop(0.7, `rgba(${nebula.r}, ${nebula.g}, ${nebula.b}, ${alpha * 0.25})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.beginPath();
      ctx.arc(nebula.x, nebula.y, nebula.radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    });
  }

  function drawBackgroundStars(width, height) {
    drawNebula(width, height);
    
    backgroundStars.forEach(star => {
      const twinkle = Math.sin(state.time * star.twinkleSpeed + star.twinklePhase);
      const alpha = star.brightness + twinkle * 0.2;
      const x = star.x % width;
      const y = star.y % height;
      
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(0.8, alpha))})`;
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
  }

  function drawStarShape(ctx, x, y, radius, spikes, color, alpha) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    const outerRadius = radius;
    const innerRadius = radius * 0.45;
    
    ctx.beginPath();
    ctx.moveTo(x, y - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      let px = x + Math.cos(rot) * outerRadius;
      let py = y + Math.sin(rot) * outerRadius;
      ctx.lineTo(px, py);
      rot += step;
      
      px = x + Math.cos(rot) * innerRadius;
      py = y + Math.sin(rot) * innerRadius;
      ctx.lineTo(px, py);
      rot += step;
    }
    
    ctx.lineTo(x, y - outerRadius);
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill();
  }

  function draw() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    
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
      const isRelated = related && related.all.has(a.id) && related.all.has(b.id);
      const dim = related && !isRelated;
      const edgeColor = cssColor(byId.get(edge.topicId).subject);
      
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      const mx = (a.sx + b.sx) / 2 + (a.depth - b.depth) * .025;
      const my = (a.sy + b.sy) / 2 - 4;
      ctx.quadraticCurveTo(mx, my, b.sx, b.sy);
      
      if (isRelated) {
        ctx.strokeStyle = `color-mix(in oklch, ${edgeColor} 70%, white)`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        
        const glowGradient = ctx.createLinearGradient(a.sx, a.sy, b.sx, b.sy);
        glowGradient.addColorStop(0, `color-mix(in oklch, ${edgeColor} 40%, transparent)`);
        glowGradient.addColorStop(0.5, `color-mix(in oklch, ${edgeColor} 25%, transparent)`);
        glowGradient.addColorStop(1, `color-mix(in oklch, ${edgeColor} 40%, transparent)`);
        ctx.strokeStyle = glowGradient;
        ctx.lineWidth = 6;
        ctx.stroke();
      } else {
        ctx.strokeStyle = dim ? `rgba(80, 90, 110, 0.08)` : `rgba(100, 115, 140, 0.18)`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    });
    ctx.restore();

    state.projected.sort((a, b) => b.depth - a.depth).forEach(node => {
      const isSelected = node.id === state.selected;
      const isHovered = node.id === state.hovered;
      const isRelated = related?.all.has(node.id);
      const dimmed = related && !isRelated;
      const color = cssColor(node.subject);
      ctx.save();
      ctx.globalAlpha = dimmed ? .11 : node.alpha;
      
      const pulsePhase = state.time * 0.003 + node.id.charCodeAt(0) * 0.05;
      const pulseScale = 1 + Math.sin(pulsePhase) * 0.15;
      
      const glowIntensity = isSelected ? 1.6 : isHovered ? 1.3 : 1;
      const glowRadius = node.radius * 3.2 * glowIntensity * pulseScale;
      
      const gradient = ctx.createRadialGradient(node.sx, node.sy, node.radius * 0.6, node.sx, node.sy, glowRadius);
      gradient.addColorStop(0, `color-mix(in oklch, ${color} 85%, white)`);
      gradient.addColorStop(0.45, `color-mix(in oklch, ${color} 60%, white)`);
      gradient.addColorStop(0.7, `color-mix(in oklch, ${color} 30%, transparent)`);
      gradient.addColorStop(1, "transparent");
      
      ctx.beginPath();
      ctx.arc(node.sx, node.sy, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      const starRadius = node.radius * (isSelected ? 1.3 : isHovered ? 1.15 : 1);
      const starSpikes = isSelected ? 6 : 5;
      
      ctx.shadowColor = color;
      ctx.shadowBlur = starRadius * 2;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      drawStarShape(ctx, node.sx, node.sy, starRadius, starSpikes, `color-mix(in oklch, ${color} 90%, white)`, node.alpha);
      
      ctx.shadowBlur = 0;
      
      const centerGradient = ctx.createRadialGradient(node.sx - starRadius * 0.25, node.sy - starRadius * 0.25, 0, node.sx, node.sy, starRadius * 0.5);
      centerGradient.addColorStop(0, "white");
      centerGradient.addColorStop(0.4, `color-mix(in oklch, ${color} 95%, white)`);
      centerGradient.addColorStop(1, color);
      
      ctx.beginPath();
      ctx.arc(node.sx, node.sy, starRadius * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = centerGradient;
      ctx.fill();
      
      if (isSelected) {
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, starRadius * 1.4, 0, Math.PI * 2);
        ctx.stroke();
      }
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

  function renderRelations(container, ids) {
    container.innerHTML = "";
    if (!ids.length) {
      container.innerHTML = '<span class="none">当前示例数据中暂无关联</span>';
      return;
    }
    ids.forEach(id => {
      const topic = byId.get(id);
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = topic.name;
      button.addEventListener("click", () => selectTopic(id));
      container.append(button);
    });
  }

  function renderDetail(topic) {
    const color = cssColor(topic.subject);
    document.querySelector("#emptyDetail").hidden = true;
    document.querySelector("#nodeDetail").hidden = false;
    document.querySelector("#nodeDetail").style.setProperty("--topic-color", color);
    document.querySelector("#detailSubject").textContent = topic.subject;
    document.querySelector("#detailGrade").textContent = `${topic.grade}年级`;
    document.querySelector("#detailName").textContent = topic.name;
    document.querySelector("#detailDomain").textContent = topic.domain;
    document.querySelector("#detailDescription").textContent = topic.description;
    const evidence = document.querySelector("#detailEvidence");
    evidence.innerHTML = topic.evidence.map(item => `<li>${item}</li>`).join("");
    const related = getRelated(topic.id);
    renderRelations(document.querySelector("#prerequisites"), related.incoming);
    renderRelations(document.querySelector("#unlocks"), related.outgoing);
    detailPanel.scrollTop = 0;
  }

  function clearSelection() {
    state.selected = null;
    detailPanel.classList.remove("is-open");
    document.querySelector("#emptyDetail").hidden = false;
    document.querySelector("#nodeDetail").hidden = true;
    draw();
  }

  function syncFilters() {
    document.querySelectorAll("#gradeFilters .chip").forEach(button => button.classList.toggle("is-active", button.dataset.grade === state.grade));
    subjectFilter.value = state.subject;
    document.querySelectorAll(".legend button").forEach(button => button.classList.toggle("is-muted", state.subject !== "all" && button.dataset.subject !== state.subject));
    document.querySelector("#stageEyebrow").textContent = `${state.grade === "all" ? "一至六年级" : `${state.grade}年级`} · ${state.subject === "all" ? "中国小学课程" : state.subject}`;
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
    if (button) selectTopic(button.dataset.id);
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

  new ResizeObserver(resize).observe(stage);
  syncFilters();
  
  function animate() {
    state.time += 16;
    draw();
    requestAnimationFrame(animate);
  }
  if (!prefersReducedMotion) {
    animate();
  }
})();
