/* ==========================================================================
   app.js — 탭 전환, 테마, 오답노트/통계 화면, 부트스트랩
   ========================================================================== */
(function (global) {
  'use strict';

  var el = {};
  var toastTimer = null;

  function esc(s) { return global.Dict.esc(s); }

  /* ---------- 탭 라우팅 ---------- */
  var TITLES = { dict: '시사경제용어사전', quiz: '퀴즈', review: '오답노트', stats: '학습 통계' };

  function go(tab) {
    [].forEach.call(document.querySelectorAll('.view'), function (v) {
      v.classList.toggle('is-active', v.dataset.view === tab);
    });
    [].forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('is-active', t.dataset.tab === tab);
    });
    el.appbarTitle.textContent = TITLES[tab] || TITLES.dict;
    if (tab === 'review') renderReview();
    if (tab === 'stats') renderStats();
    if (tab === 'quiz') global.Quiz.refreshHint();
    window.scrollTo({ top: 0 });
  }

  /* ---------- 테마 ---------- */
  function applyTheme(mode) {
    var m = mode || (window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', m);
  }

  /* ---------- 토스트 ---------- */
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.hidden = true; }, 1900);
  }

  /* ---------- 오답노트 ---------- */
  function syncBadge() {
    var n = Store.wrongCount();
    el.tabReviewBadge.textContent = n > 99 ? '99+' : n;
    el.tabReviewBadge.hidden = n === 0;
  }

  function renderReview() {
    var ids = Store.wrongIds();
    el.reviewEmpty.hidden = ids.length !== 0;
    el.reviewStart.disabled = ids.length === 0;
    el.reviewList.innerHTML = ids.map(function (id) {
      var it = global.Dict.get(id);
      if (!it) return '';
      var w = Store.wrongInfo(id) || { c: 0, s: 0 };
      return '<li class="term-item" data-id="' + id + '">' +
        '<div class="term-main">' +
          '<p class="term-name">' + esc(it.term) + '</p>' +
          '<p class="term-desc">' + esc(it.def.replace(/\n+/g, ' ').slice(0, 110)) + '</p>' +
        '</div>' +
        '<div class="term-side">' +
          '<span class="badge">' + esc(it.topic) + '</span>' +
          '<span class="badge bad">오답 ' + w.c + '</span>' +
          '<span class="badge ok">연속정답 ' + (w.s || 0) + '/' + Store.MASTER_STREAK + '</span>' +
          '<button class="linkbtn js-del" type="button">삭제</button>' +
        '</div></li>';
    }).join('');
    syncBadge();
  }

  /* ---------- 통계 ---------- */
  function renderStats() {
    var s = Store.stats();
    var cards = [
      ['총 푼 문항', s.totalAsked.toLocaleString('ko-KR')],
      ['전체 정답률', s.rate + '%'],
      ['오답노트', s.wrong.toLocaleString('ko-KR')],
      ['졸업한 용어', s.mastered.toLocaleString('ko-KR')],
      ['즐겨찾기', s.favorites.toLocaleString('ko-KR')],
      ['푼 세션', s.sessions.toLocaleString('ko-KR')],
      ['학습한 날', s.studyDays + '일'],
      ['연속 학습', s.streak + '일']
    ];
    el.statGrid.innerHTML = cards.map(function (c) {
      return '<div class="stat"><div class="stat-num">' + c[1] +
             '</div><div class="stat-label">' + c[0] + '</div></div>';
    }).join('');

    var ts = s.topicStat;
    var rows = global.Dict.TOPIC_ORDER.filter(function (t) { return ts[t] && ts[t].n; });
    el.topicStats.innerHTML = rows.length ? rows.map(function (t) {
      var v = ts[t], pct = Math.round(v.k / v.n * 100);
      return '<div class="bar-row">' +
        '<div class="bar-top"><span>' + esc(t) + '</span><b>' + pct + '% (' + v.k + '/' + v.n + ')</b></div>' +
        '<div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></div>';
    }).join('') : '<p class="hint">아직 푼 문제가 없습니다.</p>';
  }

  /* ---------- 부트 ---------- */
  function boot() {
    ['appbarTitle','themeToggle','tabbar','toast','loading','tabReviewBadge',
     'reviewList','reviewEmpty','reviewStart','reviewClear','masterNeed',
     'statGrid','topicStats','exportBtn','resetBtn']
      .forEach(function (k) { el[k] = document.getElementById(k); });

    applyTheme(Store.theme());

    try {
      global.Dict.init();
      global.Quiz.init();
    } catch (e) {
      el.loading.textContent = '오류: ' + e.message;
      console.error(e);
      return;
    }

    el.masterNeed.textContent = Store.MASTER_STREAK;
    syncBadge();
    renderStats();

    el.tabbar.addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      go(b.dataset.tab);
    });

    el.themeToggle.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : 'dark';
      Store.theme(next);
      applyTheme(next);
    });

    el.reviewStart.addEventListener('click', global.Quiz.startWrongReview);
    el.reviewClear.addEventListener('click', function () {
      if (!Store.wrongCount()) return;
      if (!confirm('오답노트를 모두 비운다. 계속할까?')) return;
      Store.clearWrong();
      renderReview();
      global.Dict.refresh();
      toast('오답노트를 비웠다.');
    });
    el.reviewList.addEventListener('click', function (e) {
      var li = e.target.closest('.term-item'); if (!li) return;
      var id = Number(li.dataset.id);
      if (e.target.classList.contains('js-del')) {
        Store.removeWrong(id);
        renderReview();
        global.Dict.refresh();
        return;
      }
      global.Dict.open(id);
    });

    el.exportBtn.addEventListener('click', function () {
      var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'econdict-progress.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    el.resetBtn.addEventListener('click', function () {
      if (!confirm('학습기록(오답노트·즐겨찾기·통계)을 모두 지운다. 계속할까?')) return;
      Store.resetAll();
      applyTheme(Store.theme());
      renderReview(); renderStats(); syncBadge();
      global.Dict.refresh(); global.Quiz.reset();
      toast('초기화했다.');
    });

    el.loading.hidden = true;
  }

  global.App = {
    go: go,
    toast: toast,
    syncBadge: syncBadge,
    renderReview: renderReview,
    renderStats: renderStats
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
