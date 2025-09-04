/* Main app logic for the comics viewer */
const $ = (sel) => document.querySelector(sel);

const state = {
  comics: [],
  idx: 0,
  preloaded: new Map(),
  version: '1.0.0'
};

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
}

function getUrlForIndex(i) {
  const url = new URL(window.location.href);
  url.searchParams.set('c', state.comics[i].slug || i.toString());
  return url.toString();
}

function indexFromUrl() {
  const url = new URL(window.location.href);
  const slug = url.searchParams.get('c');
  if (!slug) return 0;
  const idx = state.comics.findIndex(c => (c.slug||'') === slug);
  if (idx >= 0) return idx;
  // fallback: if numeric (legacy links)
  const num = Number(slug);
  if (!Number.isNaN(num) && num >= 0 && num < state.comics.length) return num;
  return 0;
}

/** Minimal Markdown -> HTML supporting **bold**, _italic_, [link](url) and line breaks */
function mdToHtml(md) {
  if (!md) return '';
  let html = md
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, '<br>');
  return html;
}

function updateShareButtons(i) {
  const comic = state.comics[i];
  const pageUrl = getUrlForIndex(i);
  const text = (comic.title ? comic.title + ' — ' : '') + (comic.shareText || 'Check out this comic!');

  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(pageUrl)}`;
  const bskyText = `${text} ${pageUrl}`;
  const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(bskyText)}`;
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
  const redditUrl = `https://www.reddit.com/submit?url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(text)}`;

  $('#shareX').href = xUrl;
  $('#shareBsky').href = bskyUrl;
  $('#shareFb').href = fbUrl;
  $('#shareReddit').href = redditUrl;

  // Use native share on mobile if available
  if (navigator.share) {
    $('#copyLinkBtn').textContent = 'Share...';
    $('#copyLinkBtn').onclick = () => navigator.share({ title: comic.title || 'My Comic', text, url: pageUrl }).catch(()=>{});
  } else {
    $('#copyLinkBtn').textContent = 'Copy Link';
    $('#copyLinkBtn').onclick = async () => {
      try {
        await navigator.clipboard.writeText(pageUrl);
        $('#copyLinkBtn').textContent = 'Copied!';
        setTimeout(() => $('#copyLinkBtn').textContent = 'Copy Link', 1500);
      } catch {
        window.prompt('Copy this link:', pageUrl);
      }
    };
  }
}

function preload(idx) {
  if (idx < 0 || idx >= state.comics.length) return;
  const src = state.comics[idx].image;
  if (!src || state.preloaded.has(src)) return;
  const img = new Image();
  img.decoding = 'async';
  img.loading = 'eager';
  img.src = src;
  state.preloaded.set(src, img);
}

function render(i) {
  const comic = state.comics[i];
  if (!comic) return;
  state.idx = i;

  // Update URL (no page reload)
  window.history.replaceState({}, '', getUrlForIndex(i));

  const img = $('#comicImg');
  img.alt = comic.alt || comic.title || 'Comic';
  // Fast swap: if already preloaded, use the existing image's decoded bitmap
  const pre = state.preloaded.get(comic.image);
  if (pre && pre.complete) {
    img.src = pre.src;
  } else {
    img.src = comic.image;
  }

  $('#caption').innerHTML = mdToHtml(comic.caption_md || '');
  $('#counter').textContent = `${i+1} / ${state.comics.length}`;
  document.title = (comic.title ? `${comic.title} — ` : '') + 'My Comics';

  updateShareButtons(i);

  // Preload neighbors for instant prev/next
  preload(i+1);
  preload(i-1);
}

function next() {
  if (state.idx < state.comics.length - 1) render(state.idx + 1);
}
function prev() {
  if (state.idx > 0) render(state.idx - 1);
}

function onKey(e){
  if (e.key === 'ArrowRight') next();
  else if (e.key === 'ArrowLeft') prev();
}

async function init() {
  $('#year').textContent = new Date().getFullYear();

  const res = await fetch('comics.json', { cache: 'no-cache' });
  const comics = await res.json();
  // normalize
  state.comics = comics.map((c, idx) => ({
    title: c.title || `Comic ${idx+1}`,
    image: c.image,
    alt: c.alt || '',
    caption_md: c.caption_md || '',
    date: c.date || '',
    slug: c.slug || slugify((c.title || `comic-${idx+1}`) + '-' + idx),
    shareText: c.shareText || ''
  }));

  // Preload the first image immediately for a snappy first paint
  preload(0);

  // Start at slug (or 0) and render
  render(indexFromUrl());

  // Wire up controls
  $('#nextBtn').addEventListener('click', next);
  $('#prevBtn').addEventListener('click', prev);
  window.addEventListener('keydown', onKey);

  // Basic swipe support
  let touchStartX = null;
  window.addEventListener('touchstart', (e)=> { touchStartX = e.changedTouches[0].screenX; }, {passive:true});
  window.addEventListener('touchend', (e)=> {
    const dx = e.changedTouches[0].screenX - (touchStartX ?? e.changedTouches[0].screenX);
    if (dx < -40) next();
    else if (dx > 40) prev();
    touchStartX = null;
  }, {passive:true});
}

init().catch(err => {
  console.error(err);
  $('#caption').innerHTML = "<em>Failed to load comics.json.</em>";
});
