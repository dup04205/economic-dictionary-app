/* ==========================================================================
   dictionary.js — 데이터셋 읽기, 색인/정렬/검색, 목록 렌더링, 상세 시트
   ========================================================================== */
(function (global) {
  'use strict';

  var PAGE = 60;                    // 한 번에 그리는 항목 수(무한 스크롤)
  var TOPIC_ORDER = ['금융', '경제', '경영', '공공', '과학', '사회'];
  var CHO = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  var all = [];                     // 전체 항목
  var byId = {};                    // id -> item
  var view = [];                    // 현재 필터/정렬 결과
  var shown = 0;                    // 지금까지 그린 개수
  var q = '';                       // 검색어
  var topic = '';                   // '' = 전체
  var initial = '';                 // '' = 전체
  var sort = 'alpha';               // alpha | topic | fav
  var current = null;               // 상세 시트에 열린 항목

  var el = {};

  /* ---------- 유틸 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function groupRank(g) {
    if (g === '0-9') return 0;
    if (ALPHA.indexOf(g) !== -1) return 1 + ALPHA.indexOf(g);
    if (CHO.indexOf(g) !== -1) return 40 + CHO.indexOf(g);
    return 99;
  }
  function cmpTerm(a, b) {
    var d = groupRank(a.initial) - groupRank(b.initial);
    if (d) return d;
    return a.term.localeCompare(b.term, 'ko');
  }
  function highlight(text, needle) {
    var t = esc(text);
    if (!needle) return t;
    var n = esc(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return t.replace(new RegExp(n, 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
  }
  function snippet(item, needle) {
    var d = item.def.replace(/\n+/g, ' ');
    if (needle) {
      var i = d.toLowerCase().indexOf(needle.toLowerCase());
      if (i > 40) d = '… ' + d.slice(i - 30);
    }
    return d.slice(0, 120);
  }

  /* ---------- 데이터 적재 ---------- */
  function load() {
    if (!global.TERMS || !global.TERMS.length) {
      throw new Error('데이터셋(data/terms.js)을 찾지 못했다.');
    }
    all = global.TERMS.slice().sort(cmpTerm);
    all.forEach(function (it) { byId[it.id] = it; });
    return all;
  }

  /* ---------- 필터 + 정렬 ---------- */
  function compute() {
    var needle = q.trim().toLowerCase();
    var favSet = null;
    if (sort === 'fav') {
      favSet = {};
      Store.favIds().forEach(function (id) { favSet[id] = true; });
    }

    view = all.filter(function (it) {
      if (topic && it.topic !== topic) return false;
      if (initial && it.initial !== initial) return false;
      if (favSet && !favSet[it.id]) return false;
      if (!needle) return true;
      return it.term.toLowerCase().indexOf(needle) !== -1 ||
             it.def.toLowerCase().indexOf(needle) !== -1;
    });

    if (sort === 'topic') {
      view.sort(function (a, b) {
        var d = TOPIC_ORDER.indexOf(a.topic) - TOPIC_ORDER.indexOf(b.topic);
        return d || cmpTerm(a, b);
      });
    }
    // alpha / fav 는 이미 cmpTerm 순서
    shown = 0;
    el.termList.innerHTML = '';
    el.resultCount.textContent = view.length.toLocaleString('ko-KR') + '개';
    el.dictEmpty.hidden = view.length !== 0;
    renderMore();
  }

  /* ---------- 렌더 ---------- */
  function groupLabel(it) {
    return sort === 'topic' ? it.topic : it.initial;
  }

  function renderMore() {
    if (shown >= view.length) return;
    var end = Math.min(shown + PAGE, view.length);
    var html = '';
    var needle = q.trim();
    for (var i = shown; i < end; i++) {
      var it = view[i];
      var prev = i > 0 ? view[i - 1] : null;
      if (!prev || groupLabel(prev) !== groupLabel(it)) {
        html += '<li class="group-head">' + esc(groupLabel(it)) + '</li>';
      }
      var w = Store.wrongInfo(it.id);
      html += '<li class="term-item" data-id="' + it.id + '">' +
        '<div class="term-main">' +
          '<p class="term-name">' + highlight(it.term, needle) + '</p>' +
          '<p class="term-desc">' + highlight(snippet(it, needle), needle) + '</p>' +
        '</div>' +
        '<div class="term-side">' +
          '<span class="badge">' + esc(it.topic) + '</span>' +
          (w ? '<span class="badge bad">오답 ' + w.c + '</span>' : '') +
          '<span class="star' + (Store.isFav(it.id) ? ' is-on' : '') + '">' +
            (Store.isFav(it.id) ? '★' : '☆') + '</span>' +
        '</div>' +
      '</li>';
    }
    el.termList.insertAdjacentHTML('beforeend', html);
    shown = end;
  }

  function buildTopicChips() {
    var counts = {};
    all.forEach(function (it) { counts[it.topic] = (counts[it.topic] || 0) + 1; });
    var html = '<button type="button" class="chip is-active" data-topic="">전체 ' + all.length + '</button>';
    TOPIC_ORDER.forEach(function (t) {
      if (!counts[t]) return;
      html += '<button type="button" class="chip" data-topic="' + esc(t) + '">' +
              esc(t) + ' ' + counts[t] + '</button>';
    });
    el.topicChips.innerHTML = html;
  }

  function buildIndexRail() {
    var have = {};
    all.forEach(function (it) { have[it.initial] = true; });
    var keys = Object.keys(have).sort(function (a, b) { return groupRank(a) - groupRank(b); });
    var html = '<button type="button" class="is-active" data-initial="">전체</button>';
    keys.forEach(function (k) {
      html += '<button type="button" data-initial="' + esc(k) + '">' + esc(k) + '</button>';
    });
    el.indexRail.innerHTML = html;
  }

  /* ---------- 상세 시트 ---------- */
  function openDetail(id) {
    var it = byId[id];
    if (!it) return;
    current = it;
    el.detailTopic.textContent = it.topic;
    el.detailTerm.textContent = it.term;
    el.detailDef.textContent = it.def;
    syncFavButton();
    el.sheetBackdrop.hidden = false;
    el.detailSheet.hidden = false;
    el.detailSheet.scrollTop = 0;
    el.detailDef.scrollTop = 0;
  }
  function closeDetail() {
    el.sheetBackdrop.hidden = true;
    el.detailSheet.hidden = true;
    current = null;
  }
  function syncFavButton() {
    if (!current) return;
    var on = Store.isFav(current.id);
    el.detailFav.textContent = on ? '★' : '☆';
    el.detailFav.classList.toggle('is-on', on);
  }

  /* ---------- 초기화 ---------- */
  function init() {
    ['termList','resultCount','dictEmpty','topicChips','indexRail','searchInput',
     'searchClear','sortMode','listSentinel','sheetBackdrop','detailSheet',
     'detailTopic','detailTerm','detailDef','detailFav','detailClose']
      .forEach(function (k) { el[k] = document.getElementById(k); });

    load();
    buildTopicChips();
    buildIndexRail();
    compute();

    /* 검색(디바운스) */
    var timer = null;
    el.searchInput.addEventListener('input', function () {
      el.searchClear.classList.toggle('is-on', !!this.value);
      clearTimeout(timer);
      var v = this.value;
      timer = setTimeout(function () { q = v; compute(); }, 180);
    });
    el.searchClear.addEventListener('click', function () {
      el.searchInput.value = ''; q = '';
      el.searchClear.classList.remove('is-on');
      compute(); el.searchInput.focus();
    });

    /* 주제 필터 */
    el.topicChips.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      topic = b.dataset.topic;
      [].forEach.call(this.children, function (c) { c.classList.toggle('is-active', c === b); });
      compute();
    });

    /* 초성·알파벳 색인 */
    el.indexRail.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      initial = b.dataset.initial;
      [].forEach.call(this.children, function (c) { c.classList.toggle('is-active', c === b); });
      compute();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    /* 정렬 방식 */
    el.sortMode.addEventListener('click', function (e) {
      var b = e.target.closest('.seg'); if (!b) return;
      sort = b.dataset.sort;
      [].forEach.call(this.children, function (c) { c.classList.toggle('is-active', c === b); });
      el.indexRail.style.display = (sort === 'topic') ? 'none' : '';
      compute();
    });

    /* 목록 클릭: 별은 즐겨찾기 토글, 나머지는 상세 */
    el.termList.addEventListener('click', function (e) {
      var li = e.target.closest('.term-item'); if (!li) return;
      var id = Number(li.dataset.id);
      if (e.target.classList.contains('star')) {
        var on = Store.toggleFav(id);
        e.target.classList.toggle('is-on', on);
        e.target.textContent = on ? '★' : '☆';
        if (sort === 'fav' && !on) compute();
        return;
      }
      openDetail(id);
    });

    /* 무한 스크롤 */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) renderMore();
      }, { rootMargin: '400px' }).observe(el.listSentinel);
    } else {
      window.addEventListener('scroll', function () {
        if (window.innerHeight + window.scrollY > document.body.offsetHeight - 500) renderMore();
      });
    }

    /* 상세 시트 */
    el.detailFav.addEventListener('click', function () {
      if (!current) return;
      Store.toggleFav(current.id);
      syncFavButton();
      compute();
    });
    el.detailClose.addEventListener('click', closeDetail);
    el.sheetBackdrop.addEventListener('click', closeDetail);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDetail();
    });
  }

  global.Dict = {
    init: init,
    all: function () { return all; },
    get: function (id) { return byId[id]; },
    open: openDetail,
    refresh: compute,
    TOPIC_ORDER: TOPIC_ORDER,
    esc: esc
  };
})(window);
