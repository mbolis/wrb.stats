import xs from "xstream";
import {adapt} from "@cycle/run/lib/adapt";

export function makeWorkerDriver(cores, script) {
  const workers = [];
  for (let i = 0; i < cores; i++) {
    const worker = new Worker(new URL(script, location));
    workers.push(worker);
  }

  return (jobs$) => {
    jobs$.addListener({
      next(data) {
        const worker = workers.shift();
        worker.postMessage(data);
        workers.push(worker);
      }
    });

    return adapt(xs.create({
      start(listener) {
        workers.forEach(w => {
          w.onmessage = ({data}) => listener.next(data);
          w.onerror = w.onmessageerror = err => listener.error(err);
        });
      },
      stop() {},
    }));
  };
}
