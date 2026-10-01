/**
 * Fixed, pointer-transparent stack behind the whole UI, painted bottom to top:
 * drifting mesh-gradient blobs → perspective floor grid with light travelling along it →
 * flat grid that brightens around the cursor → cursor bloom → film grain → vignette.
 * Pure CSS (fx.css) driven by the `--cx/--cy/--px/--py` variables PointerFx writes.
 */
export default function AmbientBackdrop() {
  return (
    <div className="fx-ambient" aria-hidden="true">
      <div className="fx-blob fx-blob-a" />
      <div className="fx-blob fx-blob-b" />
      <div className="fx-blob fx-blob-c" />
      <div className="fx-floor">
        <div className="fx-floor-plane" />
      </div>
      <div className="fx-grid" />
      <div className="fx-grid fx-grid-lit" />
      <div className="fx-bloom" />
      <div className="fx-noise" />
      <div className="fx-vignette" />
    </div>
  );
}
