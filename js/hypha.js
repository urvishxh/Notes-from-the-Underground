// Mycelium Lab · how a hyphal tip turns
// Real hyphae are fairly straight with gentle curves: a tip keeps its heading and changes it slowly.
// So the turn is a smooth, slowly drifting amount (a correlated random walk), not a fresh random jolt
// every step (which makes threads look wiggly, like worms). `w` is the Wander setting for the run.
function hyphaTurn(tp, w) {
  tp.turn = (tp.turn || 0) * 0.82 + (Math.random() * 2 - 1) * w * 0.35;
  return tp.turn + (Math.random() * 2 - 1) * w * 0.12;
}
