/** Give WebGL explicit pixels instead of Safari's cached SVG rasterization. */
export function rasterizeImage(image: HTMLImageElement): HTMLCanvasElement {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error("Image must be decoded first");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}
