const video = document.getElementById('tour-video');
const mobileFilm = window.matchMedia('(max-width: 768px)');
const track = document.getElementById('journey');
const chapters = [...document.querySelectorAll('.chapter')];
const progressBar = document.getElementById('film-progress-bar');
const timeDisplay = document.getElementById('current-time');
const totalTimeDisplay = document.getElementById('total-time');
const header = document.getElementById('site-header');
const menuToggle = document.getElementById('menu-toggle');
const mobileNav = document.getElementById('mobile-nav');
const tourStage = document.getElementById('tour-stage');
const endPanel = document.getElementById('film-end-panel');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const filmAssets = {
  mobile: '/media/tour-mobile-0927.mp4',
  desktop: '/media/tour-desktop-0927.mp4',
};
let filmDuration = 15.1;
let frameRequested = false;
let lastChapter = -1;
let targetTime = 0;
let stageVisible = false;
let seekInFlight = false;
let assetGeneration = 0;
let assetController;
let assetUrl;
let loadedAsset;

function formatTime(seconds) {
  return `00:${String(Math.min(59, Math.floor(seconds))).padStart(2, '0')}`;
}

// Native scroll is the sole timeline; the video never plays on its own.
function progressFromScroll() {
  const distance = Math.max(1, track.offsetHeight - window.innerHeight);
  const travel = -track.getBoundingClientRect().top;
  return Math.max(0, Math.min(1, travel / distance));
}

function setChapter(progress) {
  const next = progress < 0.12 ? 0 : progress < 0.36 ? 1 : progress < 0.67 ? 2 : 3;
  if (next === lastChapter) return;
  lastChapter = next;
  chapters.forEach((chapter, index) => {
    const active = index === next;
    chapter.classList.toggle('active', active);
    chapter.setAttribute('aria-hidden', String(!active));
  });
}

function seekToTarget() {
  if (reducedMotion.matches || !stageVisible || document.hidden || video.readyState < 2 || seekInFlight) return;
  const time = Math.min(targetTime, Math.max(0, filmDuration - 0.05));
  if (Math.abs(video.currentTime - time) < 0.06) {
    video.classList.add('ready');
    return;
  }
  seekInFlight = true;
  try {
    video.currentTime = time;
  } catch (error) {
    seekInFlight = false;
    console.error('Film frame could not be reached', error);
  }
}

video.addEventListener('seeked', () => {
  seekInFlight = false;
  video.classList.add('ready');
  seekToTarget();
});
video.addEventListener('loadedmetadata', () => {
  video.pause();
  if (Number.isFinite(video.duration)) filmDuration = video.duration;
  totalTimeDisplay.textContent = formatTime(filmDuration);
  updateFromScroll();
});
video.addEventListener('loadeddata', seekToTarget);
video.addEventListener('play', () => video.pause());

async function loadVideoAsset() {
  if (reducedMotion.matches || !stageVisible || document.hidden) return;
  const asset = mobileFilm.matches ? filmAssets.mobile : filmAssets.desktop;
  if (asset === loadedAsset) return;
  const generation = ++assetGeneration;
  assetController?.abort();
  assetController = new AbortController();
  video.pause();
  video.classList.remove('ready');
  seekInFlight = false;
  if (assetUrl) {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(assetUrl);
    assetUrl = undefined;
  }
  loadedAsset = asset;
  try {
    // The static host does not serve byte ranges. A small local Blob allows
    // reliable seeking without downloading and decoding hundreds of images.
    const response = await fetch(`${asset}?v=0927-1`, { signal: assetController.signal });
    if (!response.ok) throw new Error(`Film could not load (${response.status})`);
    const blob = await response.blob();
    if (generation !== assetGeneration) return;
    assetUrl = URL.createObjectURL(blob);
    video.src = assetUrl;
    video.load();
  } catch (error) {
    if (error.name !== 'AbortError') {
      loadedAsset = undefined;
      console.error(error);
    }
  }
}

function disposeVideoAsset() {
  assetGeneration++;
  assetController?.abort();
  video.pause();
  video.removeAttribute('src');
  video.load();
  if (assetUrl) URL.revokeObjectURL(assetUrl);
  assetUrl = undefined;
  loadedAsset = undefined;
  seekInFlight = false;
  video.classList.remove('ready');
}

function updateFromScroll() {
  frameRequested = false;
  const progress = progressFromScroll();
  targetTime = progress * filmDuration;
  seekToTarget();
  progressBar.style.transform = `scaleX(${progress})`;
  timeDisplay.textContent = formatTime(targetTime);
  setChapter(reducedMotion.matches ? 0 : progress);
  const showEndPanel = !reducedMotion.matches && progress >= 0.92;
  endPanel.classList.toggle('active', showEndPanel);
  endPanel.setAttribute('aria-hidden', String(!showEndPanel));
  tourStage.classList.toggle('show-end-panel', showEndPanel);
  const finalChapter = chapters[3];
  if (showEndPanel) finalChapter.setAttribute('aria-hidden', 'true');
  const contactVisual = document.querySelector('.contact-visual').getBoundingClientRect();
  const headerOverContactImage = contactVisual.top < header.offsetHeight && contactVisual.bottom > 0;
  const darkHeader = (progress > 0.12 && window.scrollY < document.getElementById('signature').offsetTop) || headerOverContactImage;
  header.classList.toggle('on-light', darkHeader);
}

function requestUpdate() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(updateFromScroll);
}

window.addEventListener('scroll', requestUpdate, { passive: true });
window.addEventListener('resize', requestUpdate);
mobileFilm.addEventListener('change', loadVideoAsset);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) disposeVideoAsset();
  else loadVideoAsset();
  requestUpdate();
});
document.addEventListener('visibilitychange', () => {
  tourStage.dataset.animationActive = String(stageVisible && !document.hidden);
  if (!document.hidden) { loadVideoAsset(); seekToTarget(); }
});
new IntersectionObserver(([entry]) => {
  stageVisible = entry.isIntersecting;
  tourStage.dataset.animationActive = String(stageVisible && !document.hidden);
  if (stageVisible) { loadVideoAsset(); seekToTarget(); }
}, { threshold: 0.01 }).observe(tourStage);
window.addEventListener('pagehide', disposeVideoAsset);
window.addEventListener('pageshow', () => { loadVideoAsset(); requestUpdate(); });
requestUpdate();

document.getElementById('explore-button').addEventListener('click', () => {
  const start = track.offsetTop + (track.offsetHeight - window.innerHeight) * 0.13;
  window.scrollTo({ top: start, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
});

menuToggle.addEventListener('click', () => {
  const open = menuToggle.getAttribute('aria-expanded') !== 'true';
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Menyunu bağla' : 'Menyunu aç');
  mobileNav.hidden = !open;
  document.body.classList.toggle('menu-open', open);
});
mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Menyunu aç');
  mobileNav.hidden = true;
  document.body.classList.remove('menu-open');
}));

const signature = document.getElementById('signature');
let signatureFrame = false;
function updateSignature() {
  signatureFrame = false;
  if (reducedMotion.matches) {
    signature.style.setProperty('--signature-progress', 0.5);
    return;
  }
  const rect = signature.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) return;
  const distance = Math.max(1, rect.height - window.innerHeight);
  signature.style.setProperty('--signature-progress', Math.max(0, Math.min(1, -rect.top / distance)).toFixed(3));
}
window.addEventListener('scroll', () => {
  if (signatureFrame) return;
  signatureFrame = true;
  requestAnimationFrame(updateSignature);
}, { passive: true });
window.addEventListener('resize', updateSignature);
updateSignature();

const lightbox = document.getElementById('lightbox');
document.querySelectorAll('.gallery-item').forEach(item => item.addEventListener('click', () => {
  document.getElementById('lightbox-image').src = item.dataset.image;
  document.getElementById('lightbox-image').alt = item.querySelector('img').alt;
  document.getElementById('lightbox-caption').textContent = item.dataset.caption;
  lightbox.showModal();
}));
document.getElementById('lightbox-close').addEventListener('click', () => lightbox.close());
lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });

// Contact details are intentionally omitted until the owner supplies them.
const CONTACT_EMAIL = '';
let preparedEnquiry = '';
const enquiryResult = document.getElementById('enquiry-result');
document.getElementById('enquiry-form').addEventListener('submit', event => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const name = String(data.get('name')).trim();
  const email = String(data.get('email')).trim();
  const message = String(data.get('message')).trim() || 'S.F&S Group barədə ətraflı məlumat almaq istərdim.';
  preparedEnquiry = `S.F&S Group barədə müraciət\n\nAd: ${name}\nE-poçt: ${email}\n\n${message}`;
  enquiryResult.hidden = false;
  if (CONTACT_EMAIL) {
    const subject = encodeURIComponent('S.F&S Group barədə müraciət');
    const body = encodeURIComponent(preparedEnquiry);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    document.getElementById('enquiry-status').textContent = 'E-poçt mətniniz hazırdır. Müraciəti aşağıdan da kopyalaya bilərsiniz.';
  } else {
    document.getElementById('enquiry-status').textContent = 'Müraciətiniz kopyalamaq üçün hazırdır. Nümayəndənin əlaqə məlumatları hələ təsdiqlənir.';
  }
  enquiryResult.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'nearest' });
});
document.getElementById('copy-enquiry').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(preparedEnquiry);
    document.getElementById('copy-enquiry').innerHTML = 'Kopyalandı <svg class="icon" aria-hidden="true"><use href="#icon-check" /></svg>';
  } catch {
    document.getElementById('enquiry-status').textContent = preparedEnquiry;
  }
});
