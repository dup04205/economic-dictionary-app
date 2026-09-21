/* ==========================================================================
   quiz.js — 4지선다 퀴즈 엔진 + 오답 기록
   문제 유형: def2term(설명→용어), term2def(용어→설명), mixed
   ========================================================================== */
(function (global) {
  'use strict';

  var SENTINEL = '@@BLANK@@';       // 정답 가림 자리표시자
  var OPT_KEYS = ['1', '2', '3', '4'];

  var cfg = { scope: 'all', topic: '', type: 'def2term', count: 10 };
  var qs = [], idx = 0, correct = 0, missed = [], answered = false;
  var el = {};

  /* ---------- 유틸 ---------- */
  function esc(s) { return global.Dict.esc(s); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function sample(arr, n, exceptId) {
    var p = arr.filter(function (x) { return x.id !== exceptId; });
    shuffle(p);
    return p.slice(0, n);
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /**
   * 가릴 문자열 후보. 용어 전체와 "한글명(영문명)" 병기 형태만 대상으로 한다.
   * 공백 단위로 쪼개면 '옵션', '금리' 같은 일반어까지 지워져 설명이 읽히지 않는다.
   */
  function variants(term) {
    var v = [term];
    var m = term.match(/^([^()（）]+)[(（]([^)）]+)[)）]\s*$/);
    if (m) { v.push(m[1].trim()); v.push(m[2].trim()); }
    return v.filter(function (t) { return t.length >= 2; })
            .sort(function (a, b) { return b.length - a.length; });
  }

  var PAREN = '(?:\\s*[(（][^)）]{0,40}[)）])?';   // 괄호 병기 허용

  /**
   * 설명 속에 답이 그대로 노출되지 않도록 용어를 가린다.
   * '알키미스트 프로젝트' 가 본문에 '알키미스트(Alchemist) 프로젝트' 로 적혀도
   * 걸리도록 어절 사이와 끝에 괄호 병기를 허용한 정규식을 만든다.
   */
  function maskTerm(text, term) {
    var out = text;
    variants(term).forEach(function (t) {
      var core = t.split(/\s+/).map(escRe).join(PAREN + '\\s*');
      try {
        out = out.replace(new RegExp(core + PAREN, 'gi'), SENTINEL);
      } catch (e) { /* 정규식 생성 실패 시 해당 후보는 건너뛴다 */ }
    });
    return out;
  }
  function renderMasked(text) {
    return esc(text).split(SENTINEL).join('<span class="blank">○○○</span>');
  }
  function cut(s, n) {
    s = String(s).replace(/\n+/g, ' ');
    return s.length > n ? s.slice(0, n) + '…' : s;
  }

  /* ---------- 출제 풀 ---------- */
  function pool() {
    var all = global.Dict.all();
    if (cfg.scope === 'topic' && cfg.topic) {
      return all.filter(function (x) { return x.topic === cfg.topic; });
    }
    if (cfg.scope === 'fav') {
      return Store.favIds().map(function (id) { return global.Dict.get(id); }).filter(Boolean);
    }
    if (cfg.scope === 'wrong') {
      return Store.wrongIds().map(function (id) { return global.Dict.get(id); }).filter(Boolean);
    }
    return all;
  }

  function build(items, type, count) {
    var all = global.Dict.all();
    var picked = sample(items, Math.min(count, items.length), -1);
    return picked.map(function (item) {
      var t = (type === 'mixed') ? (Math.random() < 0.5 ? 'def2term' : 'term2def') : type;
      var same = all.filter(function (x) { return x.topic === item.topic; });
      var distract = sample(same.length >= 8 ? same : all, 3, item.id);
      var opts = shuffle([item].concat(distract));
      return { item: item, type: t, options: opts, answer: opts.indexOf(item) };
    });
  }

  /* ---------- 화면 ---------- */
  function show(which) {
    el.quizSetup.hidden = which !== 'setup';
    el.quizPlay.hidden = which !== 'play';
    el.quizResult.hidden = which !== 'result';
  }

  function start(items) {
    if (!items.length) { App.toast('출제할 용어가 없다.'); return; }
    qs = build(items, cfg.type, cfg.count);
    idx = 0; correct = 0; missed = [];
    show('play');
    paint();
  }

  function paint() {
    var q = qs[idx];
    answered = false;
    el.quizProgress.style.width = (idx / qs.length * 100) + '%';
    el.quizStep.textContent = (idx + 1) + ' / ' + qs.length;
    el.quizScore.textContent = '정답 ' + correct;
    el.quizFeedback.hidden = true;
    el.quizNext.hidden = true;
    el.quizNext.textContent = (idx === qs.length - 1) ? '결과 보기' : '다음 문제';

    if (q.type === 'def2term') {
      el.quizPrompt.textContent = '다음 설명에 해당하는 용어는? (' + q.item.topic + ')';
      el.quizQuestion.className = 'quiz-question';
      el.quizQuestion.innerHTML = renderMasked(maskTerm(q.item.def, q.item.term));
    } else {
      el.quizPrompt.textContent = '다음 용어의 설명으로 옳은 것은? (' + q.item.topic + ')';
      el.quizQuestion.className = 'quiz-question is-term';
      el.quizQuestion.textContent = q.item.term;
    }

    el.quizOptions.innerHTML = q.options.map(function (o, i) {
      var body = (q.type === 'def2term')
        ? esc(o.term)
        : renderMasked(maskTerm(cut(o.def, 110), o.term));
      return '<li><button type="button" class="option" data-i="' + i + '">' +
             '<span class="option-key">' + OPT_KEYS[i] + '</span><span>' + body + '</span>' +
             '</button></li>';
    }).join('');
    el.quizQuestion.scrollTop = 0;
  }

  function answer(i) {
    if (answered) return;
    answered = true;
    var q = qs[idx];
    var ok = (i === q.answer);

    [].forEach.call(el.quizOptions.querySelectorAll('.option'), function (b, bi) {
      b.disabled = true;
      if (bi === q.answer) b.classList.add('is-correct');
      else if (bi === i) b.classList.add('is-wrong');
    });

    Store.recordAnswer(q.item.topic, ok);
    if (ok) {
      correct += 1;
      if (Store.markCorrect(q.item.id)) App.toast('"' + q.item.term + '" 오답노트 졸업');
    } else {
      Store.markWrong(q.item.id);
      missed.push(q.item);
    }

    el.quizFeedback.className = 'feedback ' + (ok ? 'ok' : 'bad');
    el.feedbackTitle.textContent = ok ? '정답' : '오답 — 정답은 ' + q.item.term;
    el.feedbackBody.textContent = cut(q.item.def, 400);
    el.quizFeedback.hidden = false;
    el.quizNext.hidden = false;
    el.quizScore.textContent = '정답 ' + correct;
    el.quizProgress.style.width = ((idx + 1) / qs.length * 100) + '%';
    App.syncBadge();
  }

  function next() {
    if (idx < qs.length - 1) { idx += 1; paint(); } else { finish(); }
  }

  function finish() {
    Store.recordSession(qs.length, correct);
    el.resultScore.textContent = Math.round(correct / qs.length * 100) + '%';
    el.resultSub.textContent = qs.length + '문항 중 ' + correct + '문항 정답';
    el.resultWrongTitle.hidden = missed.length === 0;
    el.resultReviewWrong.disabled = missed.length === 0;
    el.resultWrongList.innerHTML = missed.map(function (it) {
      return '<li class="term-item" data-id="' + it.id + '">' +
        '<div class="term-main"><p class="term-name">' + esc(it.term) + '</p>' +
        '<p class="term-desc">' + esc(cut(it.def, 110)) + '</p></div>' +
        '<div class="term-side"><span class="badge">' + esc(it.topic) + '</span></div></li>';
    }).join('');
    show('result');
    App.syncBadge();
    App.renderStats();
    App.renderReview();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function poolHint() {
    var n = pool().length;
    el.quizPoolHint.textContent = n
      ? '출제 대상 ' + n.toLocaleString('ko-KR') + '개 중 ' + Math.min(cfg.count, n) + '문항을 무작위로 출제'
      : '해당 범위에 용어가 없다.';
    el.quizStart.disabled = !n;
  }

  /* ---------- 초기화 ---------- */
  function init() {
    ['quizSetup','quizPlay','quizResult','quizScope','quizTopicField','quizTopics',
     'quizType','quizCount','quizPoolHint','quizStart','quizProgress','quizStep',
     'quizScore','quizAbort','quizPrompt','quizQuestion','quizOptions','quizFeedback',
     'feedbackTitle','feedbackBody','quizNext','resultScore','resultSub',
     'resultWrongTitle','resultWrongList','resultAgain','resultReviewWrong','resultHome']
      .forEach(function (k) { el[k] = document.getElementById(k); });

    el.quizTopics.innerHTML = global.Dict.TOPIC_ORDER.map(function (t, i) {
      return '<button type="button" class="chip' + (i === 0 ? ' is-active' : '') +
             '" data-topic="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('');
    cfg.topic = global.Dict.TOPIC_ORDER[0];

    function pickOne(container, attr, onPick) {
      container.addEventListener('click', function (e) {
        var b = e.target.closest('.chip'); if (!b) return;
        [].forEach.call(this.children, function (c) { c.classList.toggle('is-active', c === b); });
        onPick(b.dataset[attr]);
        poolHint();
      });
    }
    pickOne(el.quizScope, 'scope', function (v) {
      cfg.scope = v;
      el.quizTopicField.hidden = (v !== 'topic');
    });
    pickOne(el.quizTopics, 'topic', function (v) { cfg.topic = v; });
    pickOne(el.quizType, 'type', function (v) { cfg.type = v; });
    pickOne(el.quizCount, 'count', function (v) { cfg.count = Number(v); });

    el.quizStart.addEventListener('click', function () { start(pool()); });
    el.quizOptions.addEventListener('click', function (e) {
      var b = e.target.closest('.option'); if (!b || b.disabled) return;
      answer(Number(b.dataset.i));
    });
    el.quizNext.addEventListener('click', next);
    el.quizAbort.addEventListener('click', function () { show('setup'); poolHint(); });
    el.resultAgain.addEventListener('click', function () { start(pool()); });
    el.resultReviewWrong.addEventListener('click', function () {
      if (missed.length) start(missed.slice());
    });
    el.resultHome.addEventListener('click', function () { show('setup'); poolHint(); });
    el.resultWrongList.addEventListener('click', function (e) {
      var li = e.target.closest('.term-item'); if (!li) return;
      global.Dict.open(Number(li.dataset.id));
    });

    /* 숫자키 1~4로 선택, Enter로 다음 */
    document.addEventListener('keydown', function (e) {
      if (el.quizPlay.hidden) return;
      if (OPT_KEYS.indexOf(e.key) !== -1) {
        var b = el.quizOptions.querySelector('.option[data-i="' + (Number(e.key) - 1) + '"]');
        if (b && !b.disabled) answer(Number(e.key) - 1);
      } else if (e.key === 'Enter' && !el.quizNext.hidden) {
        next();
      }
    });

    poolHint();
  }

  global.Quiz = {
    init: init,
    refreshHint: poolHint,
    reset: function () { show('setup'); poolHint(); },
    /** 오답노트 탭에서 바로 복습 퀴즈 시작 */
    startWrongReview: function () {
      var items = Store.wrongIds().map(function (id) { return global.Dict.get(id); }).filter(Boolean);
      if (!items.length) { App.toast('오답노트가 비어 있다.'); return; }
      cfg.scope = 'wrong';
      cfg.count = Math.min(items.length, Math.max(cfg.count, 10));
      App.go('quiz');
      start(items);
    }
  };
})(window);
