const SUPABASE_URL = "https://uiobotxnxfljeoqgfwyy.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Owowsc5HUlFGaxytfGGFkw_aCzgsWZh";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SECTION_ORDER = [
  ["people", "The People", "g"],
  ["dyn", "The Dynamics", "b"],
  ["growth", "The Growth Plan", "s"],
  ["jyotish", "Jyotish — The Sky", "s"],
  ["research", "Research & Sources", "n"],
];

const JYOTISH_PLACEHOLDER = "In preparation — the birth chart is computed (Mesha lagna, Moon in Pushya). The full reading will appear here.";
const EMPTY_LIBRARY = "The library is not set up yet. Run the setup SQL in Supabase first.";
const LOAD_ERROR = "Could not load the document.";

const $ = (s) => document.querySelector(s);
const motionOK = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let DOCS = [];
let currentHtml = null;
let currentSlug = null;
let loadToken = 0;
let closeToken = 0;
let io = null;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function watchReveals(root) {
  const nodes = [...root.querySelectorAll(".reveal")];
  if (!motionOK() || !("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("is-in"));
    return;
  }
  if (!io) {
    io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.18, rootMargin: "0px 0px -6% 0px" });
  }
  nodes.forEach((node) => io.observe(node));
}

function renderEmpty() {
  const root = $("#sections");
  root.replaceChildren();
  const wrap = el("div", "empty reveal");
  wrap.append(el("h2", null, "Nothing here yet."), el("p", null, EMPTY_LIBRARY));
  root.append(wrap);
  watchReveals(root);
}

function renderSections(docs) {
  const root = $("#sections");
  root.replaceChildren();
  SECTION_ORDER.forEach(([key, label, cls]) => {
    const items = docs.filter((d) => d.section === key);
    if (!items.length && key !== "jyotish") return;

    const section = el("section", `section section--${cls}`);
    const head = el("div", "section-head reveal");
    head.append(el("h2", null, label));
    section.append(head);

    const grid = el("div", "grid");
    if (!items.length) {
      const placeholder = el("div", "card is-placeholder reveal");
      placeholder.append(el("p", "card-descr", JYOTISH_PLACEHOLDER));
      grid.append(placeholder);
    }
    items.forEach((d, i) => {
      const btn = el("button", "card reveal");
      btn.type = "button";
      btn.dataset.slug = d.slug;
      btn.style.setProperty("--d", `${(i % 4) * 70}ms`);
      const tagCls = ["g", "b", "s", "n"].includes(d.tag_class) ? d.tag_class : "n";
      if (d.tag) btn.append(el("span", `tag tag--${tagCls}`, d.tag));
      btn.append(el("span", "card-title", d.title || ""));
      if (d.descr) btn.append(el("span", "card-descr", d.descr));
      grid.append(btn);
    });
    section.append(grid);
    root.append(section);
  });
  watchReveals(root);
}

function showGate() {
  const gate = $("#gate");
  gate.classList.remove("hidden");
  gate.querySelectorAll(".rise").forEach((node) => {
    node.style.animation = "none";
    void node.offsetWidth;
    node.style.animation = "";
  });
}

async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) showLibrary(session);
  else showGate();
  sb.auth.onAuthStateChange((_e, s) => { if (!s) location.reload(); });
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#login-err");
  const btn = $("#login-btn");
  const label = btn.querySelector(".enter-label");
  err.textContent = "";
  err.classList.remove("is-on");
  btn.disabled = true;
  label.textContent = "Signing in";
  const email = $("#email").value.trim();
  const pass = $("#pass").value;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) {
    label.textContent = "Sign in";
    btn.disabled = false;
    err.textContent = "Sign-in failed. Check email and password.";
    void err.offsetWidth;
    err.classList.add("is-on");
    const form = $("#login-form");
    form.classList.remove("is-shake");
    void form.offsetWidth;
    if (motionOK()) form.classList.add("is-shake");
    $("#pass").focus();
    return;
  }
  $("#gate").classList.add("hidden");
  showLibrary(data.session);
});

$("#signout").addEventListener("click", async () => { await sb.auth.signOut(); });

$("#sections").addEventListener("click", (e) => {
  const btn = e.target.closest(".card[data-slug]");
  if (!btn) return;
  openDoc(btn.dataset.slug);
});

async function showLibrary(session) {
  $("#who").textContent = session.user.email;
  $("#gate").classList.add("hidden");
  $("#lib").classList.remove("hidden");
  const intro = $("#lib .lib-intro");
  intro.classList.remove("is-shown");
  void intro.offsetWidth;
  intro.classList.add("is-shown");
  const status = $("#lib-status");
  status.hidden = false;
  const { data, error } = await sb.from("inner_docs").select("slug,title,section,tag,tag_class,descr").order("position");
  status.hidden = true;
  if (error || !data || !data.length) {
    DOCS = [];
    renderEmpty();
    return;
  }
  DOCS = data;
  renderSections(DOCS);
}

let springGen = 0;

function springReader(open) {
  const el = $("#reader");
  const gen = ++springGen;
  const target = open ? 0 : 72;
  const targetOpacity = open ? 1 : 0;
  if (!motionOK()) {
    el.style.transform = `translateY(${target}px)`;
    el.style.opacity = String(targetOpacity);
    return Promise.resolve();
  }
  const matrix = new DOMMatrix(getComputedStyle(el).transform);
  let y = matrix.m42;
  let v = 0;
  let opacity = parseFloat(getComputedStyle(el).opacity);
  if (Number.isNaN(opacity)) opacity = 0;
  const response = 0.42;
  const dampingRatio = open ? 0.86 : 1;
  const omega = (2 * Math.PI) / (response * 1.15);
  const stiffness = omega * omega;
  const damp = 2 * dampingRatio * omega;
  let last = performance.now();
  const started = last;
  return new Promise((resolve) => {
    const step = (now) => {
      if (gen !== springGen) { resolve(); return; }
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      v += (-damp * v - stiffness * (y - target)) * dt;
      y += v * dt;
      opacity += (targetOpacity - opacity) * (1 - Math.exp(-dt / 0.16));
      el.style.transform = `translateY(${y}px)`;
      el.style.opacity = String(opacity);
      const settled = (Math.abs(y - target) < 0.5 && Math.abs(v) < 12 && Math.abs(opacity - targetOpacity) < 0.02) || now - started > 1200;
      if (settled) {
        el.style.transform = `translateY(${target}px)`;
        el.style.opacity = String(targetOpacity);
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function syncNav() {
  const i = DOCS.findIndex((d) => d.slug === currentSlug);
  $("#prev").disabled = i <= 0;
  $("#next").disabled = i === -1 || i >= DOCS.length - 1;
}

function step(dir) {
  const i = DOCS.findIndex((d) => d.slug === currentSlug);
  const next = DOCS[i + dir];
  if (!next) return;
  openDoc(next.slug);
}

async function openDoc(slug) {
  const meta = DOCS.find((d) => d.slug === slug);
  const token = ++loadToken;
  closeToken++;
  currentSlug = slug;
  currentHtml = null;
  const title = meta ? meta.title : slug;
  $("#otitle").textContent = title;
  $("#oframe").title = title || "Document";
  $("#newtab").disabled = true;
  syncNav();

  const status = $("#reader-status");
  status.hidden = true;
  status.textContent = "";
  $("#reader-live").textContent = "Loading document";

  const reader = $("#reader");
  const frame = $("#oframe");
  reader.classList.remove("is-ready", "is-loading");
  void reader.offsetWidth;
  reader.classList.add("is-loading");
  reader.setAttribute("aria-busy", "true");
  const wasOpen = reader.classList.contains("is-open");
  reader.classList.add("is-open");
  reader.style.pointerEvents = "";
  reader.setAttribute("aria-hidden", "false");
  reader.inert = false;
  $("#lib").inert = true;
  document.body.style.overflow = "hidden";
  springReader(true);
  if (!wasOpen) requestAnimationFrame(() => $("#back").focus());

  const { data, error } = await sb.from("inner_docs").select("html").eq("slug", slug).single();
  if (token !== loadToken) return;
  if (error || !data) {
    frame.srcdoc = "";
    reader.classList.remove("is-loading");
    reader.setAttribute("aria-busy", "false");
    status.textContent = LOAD_ERROR;
    status.hidden = false;
    $("#reader-live").textContent = LOAD_ERROR;
    return;
  }
  currentHtml = data.html;
  frame.srcdoc = currentHtml;
  $("#newtab").disabled = false;
  requestAnimationFrame(() => {
    if (token !== loadToken) return;
    reader.classList.remove("is-loading");
    reader.classList.add("is-ready");
    reader.setAttribute("aria-busy", "false");
    $("#reader-live").textContent = title;
  });
}

function closeReader() {
  const reader = $("#reader");
  if (!reader.classList.contains("is-open")) return;
  const token = ++closeToken;
  loadToken++;
  reader.classList.remove("is-loading", "is-ready");
  reader.style.pointerEvents = "none";
  reader.setAttribute("aria-hidden", "true");
  reader.setAttribute("aria-busy", "false");
  reader.inert = true;
  $("#lib").inert = false;
  document.body.style.overflow = "";
  const card = currentSlug ? document.querySelector(`.card[data-slug="${CSS.escape(currentSlug)}"]`) : null;
  if (card) card.focus();

  const finish = () => {
    if (token !== closeToken) return;
    reader.classList.remove("is-open");
    reader.style.pointerEvents = "";
    $("#oframe").srcdoc = "";
    currentHtml = null;
    $("#newtab").disabled = true;
    $("#reader-status").hidden = true;
    $("#reader-live").textContent = "";
  };
  springReader(false).then(finish);
}

function onReaderKey(e) {
  if (!$("#reader").classList.contains("is-open")) return;
  if (e.key === "Escape") {
    e.preventDefault();
    closeReader();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    step(-1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    step(1);
  }
}

$("#back").addEventListener("click", closeReader);
$("#prev").addEventListener("click", () => step(-1));
$("#next").addEventListener("click", () => step(1));
$("#newtab").addEventListener("click", () => {
  if (!currentHtml) return;
  const blob = new Blob([currentHtml], { type: "text/html" });
  window.open(URL.createObjectURL(blob), "_blank");
});
document.addEventListener("keydown", onReaderKey);
$("#oframe").addEventListener("load", () => {
  const frame = $("#oframe");
  if (!frame.srcdoc) return;
  try {
    frame.contentDocument.addEventListener("keydown", onReaderKey);
  } catch (_) {}
});

boot();
