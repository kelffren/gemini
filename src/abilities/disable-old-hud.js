(function () {
  function wipeOldLoadout() {
    if (typeof STATE === 'undefined') return;
    STATE.equipped = [];
  }

  function stealActionBar() {
    if (typeof renderActionBar !== 'function') return;
    if (renderActionBar._keloOwned) return;
    renderActionBar = function () {
      wipeOldLoadout();
      const bar = document.getElementById('action-bar-container');
      if (!bar) return;
      if (!bar.dataset.keloStones && window.KeloAbilities) {
        bar.innerHTML = '';
      }
    };
    renderActionBar._keloOwned = true;
  }

  function stealCast() {
    if (typeof castStone === 'function' && !castStone._keloMuted) {
      var prev = castStone;
      castStone = function () { return; };
      castStone._keloMuted = true;
      castStone._prev = prev;
    }
  }

  function bootMute() {
    wipeOldLoadout();
    stealActionBar();
    stealCast();
  }

  bootMute();
  setTimeout(bootMute, 0);
  setTimeout(bootMute, 250);

  if (typeof updateSimulation === 'function') {
    var _u = updateSimulation;
    updateSimulation = function (dt) {
      wipeOldLoadout();
      _u(dt);
    };
  }
})();
