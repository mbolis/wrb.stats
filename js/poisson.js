const P_WHITE = 1/3;
const P_RED = 0.5;
const P_BLACK = 2/3;

const CTX = {};
function Poisson(white, red, black) {
  const key = `${white},${red},${black}`;
  if (key in CTX) return CTX[key];

  const N = white + red + black;

  const p = [];
  for (let i = 0; i < white; i++) {
    p.push(P_WHITE);
  }
  for (let i = 0; i < red; i++) {
    p.push(P_RED);
  }
  for (let i = 0; i < black; i++) {
    p.push(P_BLACK);
  }

  const p0 = p[0];
  const _P = [[1-p0], [p0]];

  function P(k, n=N-1) {
    //if (k===N) debugger
    if (k in _P) {
      const Pk = _P[k];
      if (n in Pk) return Pk[n];
    } else {
      const Pk = _P[k] = [];
      for (let n = 0, K = k-1; n < K; n++) {
        Pk[n] = 0;
      }
    }

    let _p;
    const pn = p[n];
    if (k === 0) _p = (1-pn)*P(0, n-1);
    else if (k === N) _p = pn*P(N-1, n-1);
    else _p = pn*P(k-1, n-1) + (1-pn)*P(k, n-1);
    return _P[k][n] = _p;
  }

  return CTX[key] = P;
}

self.onmessage = ({data: {white, red, black, k}}) => {
  const P = Poisson(white, red, black);
  const p = P(k);
  self.postMessage({ p, k });
};
