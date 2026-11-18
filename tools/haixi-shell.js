  const stage = document.getElementById('stage');
  const errorBox = document.getElementById('error');
  try {
    const island = createHaixiIsland(stage);
    window.__haixiIsland = island;
    island.enter();
  } catch (error) {
    console.error('Haixi standalone failed', error);
    if (errorBox) errorBox.hidden = false;
  }
