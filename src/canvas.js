import xs from "xstream";
import {adapt} from "@cycle/run/lib/adapt";

import { __ as _, apply } from "ramda";

import MainLoop from "mainloop.js";

const jobs = [];
MainLoop
  .setDraw(() => {
    while (jobs.length) jobs.shift()();
  });

function drawSceneNode(ctx) {
  function setProps(props) {
    for (let [k, v] of Object.entries(props)) {
      if (k === "fill") ctx.fillStyle = v;
      else if (k === "stroke") ctx.strokeStyle = v;
      else if (k === "alpha") ctx.globalAlpha = v;
      else if (/^(line|miter|font|text|shadow)/.test(k)) ctx[k] = v;
    }
  }

  function drawNode(node, defaultProps={}) {
    if (!node) return;

    if (Array.isArray(node)) {
      const [, children] = node;
      children.forEach(c => drawNode(c, defaultProps));

    } else {
      const {sel, data:{attrs, props={}}={}, children} = node;
      Object.assign(props, attrs);

      ctx.save();
      setProps(props);

      const {
        fill, stroke,
        x=0, y=0,
        w=ctx.canvas.width, h=ctx.canvas.height,
        dx=32, dy=32, padx=0, pady=0,
        r,
        p,
        text,
      } = Object.assign({}, defaultProps, props);

      switch (sel) {
        case "rect":
          fill && ctx.fillRect(x, y, w, h);
          stroke && ctx.strokeRect(x, y, w, h);
          break;

        case "grid":
          fill && ctx.fillRect(x, y, w, h);

          const lw = w - 2*padx;
          const lh = h - 2*pady;
          ctx.beginPath();
          for (let lx = padx; lx < w; lx += dx) {
            ctx.moveTo(x+lx, y+pady);
            ctx.lineTo(x+lx, y+pady+lh);
          }
          for (let ly = pady; ly < h; ly += dy) {
            ctx.moveTo(x+padx, y+ly);
            ctx.lineTo(x+padx+lw, y+ly);
          }
          ctx.stroke();
          break;

        case "circle":
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI*2);
          fill && ctx.fill();
          stroke && ctx.stroke();
          break;

        case "line":
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x+w, y+h);
          stroke && ctx.stroke();
          break;

        case "poly":
          if (!p || !p.length) break;
          ctx.beginPath();
          ctx.moveTo(...p[0]);
          for (let n of p.slice(1)) {
            ctx.lineTo(...n);
          }
          fill && ctx.fill();
          stroke && ctx.stroke();
          break;

        case "text":
          fill && ctx.fillText(text, x, y);
          stroke && ctx.strokeText(text, x, y);
          break;

        case "group":
          defaultProps = props;
          break;
      }

      if (children) {
        ctx.translate(x, y);
        children.forEach(c => drawNode(c, defaultProps));
      }
      ctx.restore();
    }
  };

  return drawNode;
}

const _canvas = {};

function DrawJob(sel, scene) {
  return () => {
    let canvas = _canvas[sel] || (_canvas[sel] = document.querySelector(sel));
    if (!canvas) return;

    let ctx = canvas.getContext("2d");

    try {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawSceneNode(ctx)(scene);
    } catch (e) {
      console.error(e);
      MainLoop.stop();
    }
  };
}

export function makeCanvasDriver() {
  return (scenes$) => {
    scenes$.addListener({
      next(scenes) {
        Object.entries(scenes)
          .forEach(([sel, scene]) =>
            jobs.push(DrawJob(sel, scene)));
      },
      error(err) {
        console.error("scenes stream error", err);
      },
      complete() {
        console.log("scenes stream complete");
      },
    });

    return {
      updates: () => adapt(xs.create({
        start(listener) {
          MainLoop
            .setUpdate(delta => listener.next(delta))
            .start();
        },
        stop() {},
      }))
    };
  };
}
