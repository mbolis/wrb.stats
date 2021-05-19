import "./style.css";

import xs from "xstream";

import {run} from "@cycle/run";
import {makeDOMDriver} from "@cycle/dom";
import isolate from "@cycle/isolate";

import {all, compose, fromPairs, identity, map, tap} from "ramda";

import {makeCanvasDriver} from "./canvas.js";
import {makeWorkerDriver} from "./workers.js";

function NumberInput(sources) {
  const props$ = sources.props;

  const value$ = props$
    .map(props => sources.DOM
      .select(".field-input")
      .events("input")
      .map(e => +e.target.value)
      .startWith(props.value))
    .flatten();

  const valid$ = value$
    .map(v => !Number.isNaN(v))
    .debug("valid");

  const submit$ = value$
    .filter(v => !Number.isNaN(v))
    .map(value => sources.DOM
      .select(".field-input")
      .events("keydown")
      .filter(e => e.code === "Enter")
      .mapTo(value))
    .flatten();

  const id = ++NumberInput._id;

  const vdom$ = props$
    .map(({label, value}) =>
      <div className="field-wrapper">
        <label for={id} className="field-label">{label}</label>
        <input type="number" id={id} className="field-input" value={value} pattern="\d+" />
      </div>
    );

  return {
    DOM: vdom$,
    value: value$,
    valid: valid$,
    submit: submit$,
  };
}
NumberInput._id = 0;
NumberInput.isolate = function(...args) {
  return isolate(this)(...args);
};

function InputForm(sources) {
  const {DOM} = sources;

  const whiteInput = NumberInput.isolate({
    DOM,
    props: xs.of({
      label: "White (2)",
      value: 0,
    }),
  });
  const redInput = NumberInput.isolate({
    DOM,
    props: xs.of({
      label: "Red (3)",
      value: 0,
    }),
  });
  const blackInput = NumberInput.isolate({
    DOM,
    props: xs.of({
      label: "Black (4)",
      value: 0,
    }),
  });

  const enter$ = xs
    .merge(whiteInput.submit, redInput.submit, blackInput.submit);

  const click$ = sources.DOM
    .select(".form-submit")
    .events("click");
  
  const value$ = xs
    .combine(whiteInput.value, redInput.value, blackInput.value)
    .map(([white, red, black]) => ({ white, red, black }));

  const valid$ = xs
    .combine(whiteInput.valid, redInput.valid, blackInput.valid)
    .map(all(identity))
    .startWith(true)
    .map(valid => value$
      .map(({white, red, black}) => valid && (white || red || black)))
    .flatten();

  const submit$ = value$
    .map(value => xs
      .merge(enter$, click$)
      .mapTo(value))
    .flatten();

  const vdom$ = xs
    .combine(whiteInput.DOM, redInput.DOM, blackInput.DOM, valid$)
    .map(([white, red, black, valid]) =>
      <>
        <div className="form-row">
          {white} {red} {black}
        </div>
        <div className="form-row">
          <div className="field-wrapper">
            <button className="form-submit" disabled={!valid}>Avvia</button>
          </div>
        </div>
      </>
    );

  return {
    DOM: vdom$,
    submit: submit$,
  }
}

function Result(sources) {
  const sample$ = xs.create({
    start: (listener) => sources.jobs.addListener({
      next(data) {
        const {white, red, black} = data;
        const n = white + red + black;

        for (let k = 0; k <= n; k++) {
          listener.next({ k, n, white, red, black });
        }
      }
    }),
    stop() {},
  });

  const result$ = sample$
    .map(({n}) => sources.Poisson
      .fold((rs, {k, p}) => {
        rs[k] = [p, p];
        for (let i = 0; i < k; i++) {
          rs[i][1] += p;
        }
        return rs;
      }, Object.assign([], {n})))
    .flatten();

  const vdom$ = result$
    .startWith([])
    .map(results => !!results.length &&
      <div className="table-wrapper">
        <table>
          <tr>
            <th>k</th>
            <th className="table-header-eq">=k</th>
            <th className="table-header-ge">≥k</th>
          </tr>
          {results.map(([p, P], k) =>
          <tr>
            <td>{k}</td>
            <td>{p.toFixed(4)}</td>
            <td>{P.toFixed(4)}</td>
          </tr>
          )}
        </table>
      </div>
    );

  return {
    DOM: vdom$,
    jobs: sample$,
    output: result$,
  };
}

function Graph(sources) {
  const scene$ = xs
    .combine(sources.canvasSize, sources.result)
    .filter(([{graph}]) => graph)
    .map(([{graph}, result]) => sources.Canvas
      .updates()
      .map(tick => {
        const hLegend = graph.height / 32;
        const pLegend = hLegend / 4;

        const W = graph.width;
        const H = graph.height - hLegend;

        const N = result.n;

        const W_ = W - hLegend;
        const dx = W_ / N | 0;
        const w = dx * N;
        const px = (W-w) / 2 | 0;
        const mx = px - dx * (1 + px/dx |0);

        const dy = H / 20 | 0;
        const py = (H - 20*dy) / 2;
        const h = H - 2*py;

        const x0 = px;
        const y0 = py + h;
        const x1 = px + w;
        const y1 = py;

        const ps = result.map(([p], k) => [x0 + k*dx, y0 - h*p]);
        const psF = [[x0, y0], ...ps, [x1, y0]];
        const Ps = result.map(([, P], k) => [x0 + k*dx, y0 - h*P]);
        const PsF = [[x0, y0], ...Ps, [x1, y0]];

        return (
          <>
            <grid stroke="gainsboro" x={mx} y={py} w={W+dx} h={h} dx={dx} dy={dy} />
            <line stroke="silver" x={0} y={py+h/2} w={W} h={0} />
            <line stroke="silver" x={0} y={y1} w={W} h={0} />
            <line stroke="silver" x={x0} y={y1} w={0} h={h} />
            <line stroke="silver" x={x1} y={y1} w={0} h={h} />

            <poly fill="#fd5" alpha={.5} p={PsF} />
            <poly stroke="orangered" p={Ps} />
            <poly fill="lightgreen" p={psF} />
            <poly stroke="green" p={ps} />
            
            <line stroke="gray" x={0} y={y0} w={W} h={0} />
            <line stroke="gray" x={0} y={H+hLegend} w={W} h={0} />
            
            <group
              textAlign="center" textBaseline="top" font={`${hLegend |0}px monospace`}
              fill="darkblue" x={x0} y={y0+pLegend}>
              {result.map((_, k) => (
                <text text={k} x={k*dx} y={0} />
              ))}
            </group>
          </>
        )
      }))
    .flatten()
    .map(scene => ({
      ".graph": scene,
    }));

  return {
    Canvas: scene$,
  };
}

function main(sources) {
  const inputForm = InputForm(sources);
  const result = Result({
    Poisson: sources.Poisson,
    jobs: inputForm.submit,
  });

  const size$ = sources.DOM
    .select("window")
    .events("resize")
    .startWith(0)
    .map(() => sources.DOM
      .select("canvas")
      .elements()
      .map(compose(
        fromPairs,
        map(c => {
          const width = c.parentElement.offsetWidth;
          const height = width * 9/16 |0;
          return [ c.className, { width, height } ];
        }),
      )))
    .flatten();

  const vdom$ = xs
    .combine(inputForm.DOM, size$, result.DOM)
    .map(([inputForm, {graph={}}, result]) =>
      <div className="content">
        {inputForm}
        <div className="form-row">
          <canvas
            className="graph"
            width={graph.width}
            height={graph.height}>
          </canvas>
        </div>
        <div className="form-row">
          {result}
        </div>
      </div>
    );

  const graph = Graph({
    canvasSize: size$,
    result: result.output,
    Canvas: sources.Canvas,
  });

  return {
    DOM: vdom$,
    Canvas: graph.Canvas,
    Poisson: result.jobs,
  };
}

run(main, {
  DOM: makeDOMDriver("#app"),
  Canvas: makeCanvasDriver(),
  Poisson: makeWorkerDriver(1, "./js/poisson.js"),
});
