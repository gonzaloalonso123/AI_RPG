import { useEffect, useRef } from "react";
import { Application, Assets, Sprite } from "pixi.js";
export function Scene({ src, reduced }: { src: string; reduced: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reduced || !host.current) return;
    let disposed = false;
    const app = new Application();
    const el = host.current;
    async function start() {
      try {
        await app.init({
          resizeTo: el,
          backgroundAlpha: 0,
          antialias: true,
          preference: "webgl",
        });
        if (disposed) {
          app.destroy(true);
          return;
        }
        el.appendChild(app.canvas);
        const texture = await Assets.load(src);
        if (disposed) return;
        const sprite = new Sprite(texture);
        app.stage.addChild(sprite);
        let time = 0;
        app.ticker.add((t) => {
          if (document.hidden) return;
          time += t.deltaMS;
          const scale =
            Math.max(
              el.clientWidth / texture.width,
              el.clientHeight / texture.height,
            ) * 1.025;
          sprite.scale.set(scale);
          sprite.x =
            (el.clientWidth - sprite.width) / 2 + Math.sin(time / 16000) * 5;
          sprite.y = (el.clientHeight - sprite.height) / 2;
        });
      } catch {
        /* The accessible still image remains visible. */
      }
    }
    void start();
    return () => {
      disposed = true;
      if (app.renderer) app.destroy(true, { children: true });
    };
  }, [src, reduced]);
  return (
    <div className="scene-art">
      <img src={src} alt="" />
      <div aria-hidden="true" className="pixi-layer" ref={host} />
    </div>
  );
}
