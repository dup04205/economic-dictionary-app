/* ==========================================================================
   storage.js — 학습 기록 읽기/쓰기 계층
   localStorage 한 곳에만 의존한다. 안드로이드로 옮길 때 이 파일의
   함수 시그니처만 유지한 채 내부를 Room/DataStore 호출로 바꾸면 된다.
   ========================================================================== */
(function (global) {
  'use strict';

  var KEY = 'econdict.v1';
  var MASTER_STREAK = 2;           // 연속 정답 N회 → 오답노트 졸업

  var DEFAULTS = {
    favorites: [],                 // [termId]
    wrong: {},                     // termId -> {c:오답수, s:연속정답, t:마지막오답시각}
    mastered: [],                  // 졸업한 termId
    history: [],                   // 최근 세션 [{d:날짜, n:문항, k:정답}]
    topicStat: {},                 // 주제 -> {n:시도, k:정답}
    totalAsked: 0,
    totalCorrect: 0,
    theme: null                    // 'light' | 'dark' | null(시스템)
  };

  var state = load();

  function load() {
    var base = JSON.parse(JSON.stringify(DEFAULTS));
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return base;
      var saved = JSON.parse(raw);
      Object.keys(base).forEach(function (k) {
        if (saved[k] !== undefined && saved[k] !== null) base[k] = saved[k];
      });
    } catch (e) {
      console.warn('[storage] 불러오기 실패, 초기값 사용:', e);
    }
    return base;
  }

  function save() {
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[storage] 저장 실패:', e);   // 시크릿 모드 등에서도 앱은 계속 동작한다
    }
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  var Store = {
    MASTER_STREAK: MASTER_STREAK,

    /* ----- 즐겨찾기 ----- */
    isFav: function (id) { return state.favorites.indexOf(id) !== -1; },
    toggleFav: function (id) {
      var i = state.favorites.indexOf(id);
      if (i === -1) state.favorites.push(id); else state.favorites.splice(i, 1);
      save();
      return i === -1;
    },
    favIds: function () { return state.favorites.slice(); },

    /* ----- 오답노트 ----- */
    wrongIds: function () {
      return Object.keys(state.wrong).map(Number)
        .sort(function (a, b) { return (state.wrong[b].t || 0) - (state.wrong[a].t || 0); });
    },
    wrongInfo: function (id) { return state.wrong[id] || null; },
    wrongCount: function () { return Object.keys(state.wrong).length; },

    markWrong: function (id) {
      var w = state.wrong[id] || { c: 0, s: 0, t: 0 };
      w.c += 1;
      w.s = 0;
      w.t = Date.now();
      state.wrong[id] = w;
      var m = state.mastered.indexOf(id);
      if (m !== -1) state.mastered.splice(m, 1);
      save();
    },

    /** 정답 처리. 오답노트에 있던 항목이 졸업하면 true 반환 */
    markCorrect: function (id) {
      var w = state.wrong[id];
      if (!w) return false;
      w.s = (w.s || 0) + 1;
      if (w.s >= MASTER_STREAK) {
        delete state.wrong[id];
        if (state.mastered.indexOf(id) === -1) state.mastered.push(id);
        save();
        return true;
      }
      save();
      return false;
    },

    removeWrong: function (id) { delete state.wrong[id]; save(); },
    clearWrong: function () { state.wrong = {}; save(); },
    masteredCount: function () { return state.mastered.length; },

    /* ----- 통계 ----- */
    recordAnswer: function (topic, correct) {
      state.totalAsked += 1;
      if (correct) state.totalCorrect += 1;
      var t = state.topicStat[topic] || { n: 0, k: 0 };
      t.n += 1;
      if (correct) t.k += 1;
      state.topicStat[topic] = t;
      save();
    },

    recordSession: function (n, k) {
      state.history.unshift({ d: today(), n: n, k: k });
      state.history = state.history.slice(0, 60);
      save();
    },

    stats: function () {
      var days = {};
      state.history.forEach(function (h) { days[h.d] = true; });
      return {
        totalAsked: state.totalAsked,
        totalCorrect: state.totalCorrect,
        rate: state.totalAsked ? Math.round(state.totalCorrect / state.totalAsked * 100) : 0,
        sessions: state.history.length,
        studyDays: Object.keys(days).length,
        streak: streakDays(days),
        topicStat: state.topicStat,
        wrong: Object.keys(state.wrong).length,
        mastered: state.mastered.length,
        favorites: state.favorites.length
      };
    },

    /* ----- 테마 ----- */
    theme: function (v) {
      if (v === undefined) return state.theme;
      state.theme = v; save(); return v;
    },

    /* ----- 내보내기 / 초기화 ----- */
    exportJSON: function () { return JSON.stringify(state, null, 2); },
    resetAll: function () {
      state = JSON.parse(JSON.stringify(DEFAULTS));
      save();
    }
  };

  function streakDays(days) {
    var n = 0, d = new Date();
    for (;;) {
      var key = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      if (!days[key]) break;
      n += 1;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  global.Store = Store;
})(window);
