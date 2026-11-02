declare module "bwip-js" {
  interface ToCanvasOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    padding?: number;
    includetext?: boolean;
    textxalign?: string;
  }
  function toCanvas(canvas: HTMLCanvasElement, options: ToCanvasOptions): HTMLCanvasElement;
  function toCanvas(options: ToCanvasOptions): Promise<HTMLCanvasElement>;
  const bwipjs: { toCanvas: typeof toCanvas };
  export default bwipjs;
}
