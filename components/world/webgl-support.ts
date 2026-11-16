/**
 * Whether this browser can run the world renderer at all (three.js needs WebGL2).
 * This is the only reason the world falls back to its static scene by design; runtime failures are errors with a retry.
 */
export function supportsWebGL2(): boolean {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    // Release the probe context right away: browsers cap live contexts per page.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return !!gl;
  } catch {
    return false;
  }
}
