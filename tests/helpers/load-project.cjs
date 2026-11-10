'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const STATIC = path.resolve(process.env.CHESS_STATIC_DIR || path.join(__dirname, '../../static'));
const file = name => path.join(STATIC, name);

function makeContext({ tactics = true } = {}) {
  const window = { addEventListener() {}, matchMedia() { return { matches: false }; } };
  const fakeElement = () => ({
    classList: { add() {}, remove() {}, contains() { return true; } },
    dataset: {}, style: {}, children: [], innerHTML: '', textContent: '',
    addEventListener() {}, appendChild() {}, remove() {}, querySelector() {return null;},
    querySelectorAll() {return [];}, getBoundingClientRect() { return {width:560,height:560}; },
  });
  const document = {
    body: fakeElement(), documentElement: fakeElement(),
    getElementById() {return null;}, createElement: fakeElement,
    querySelector() {return null;}, querySelectorAll() {return [];},
  };
  const context = { window, document, console, Date, Math, Set, Map, JSON,
    history: {length:0, back() {}},
    requestAnimationFrame(fn) { fn(); },
    setTimeout() {}, clearTimeout() {},
  };
  vm.createContext(context);
  for (const name of ['vendor/chess.browser.js', ...(tactics ? ['tactics.js'] : []), 'ui.js']) {
    const filePath = file(name);
    assert(fs.existsSync(filePath), `Missing ${filePath}; point CHESS_STATIC_DIR at your project's static folder`);
    vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, {filename:name, timeout:10000});
  }
  const Chess = context.window.Chess || vm.runInContext('typeof Chess === "function" ? Chess : undefined',context);
  assert.equal(typeof Chess, 'function', 'vendor/chess.browser.js must provide a Chess constructor');
  if (tactics) assert.equal(typeof window.ChessTactics?.analyzeMove,'function');
  return { context, window, Chess, evalJS: s => vm.runInContext(s, context) };
}

function played(Chess, moves) {
  const board = new Chess();
  const fens = [board.fen()], uci_moves = [], sans = [];
  for (const move of moves) {
    const actual = board.move(move);
    assert(actual, `illegal test move ${move}`);
    sans.push(actual.san);
    uci_moves.push(actual.from+actual.to+(actual.promotion||''));
    fens.push(board.fen());
  }
  return {fens, moves:sans, uci_moves};
}
function fen4(fen) {return String(fen).trim().split(/\s+/).slice(0,4).join(' ');}
module.exports = {STATIC, file, makeContext, played, fen4};
