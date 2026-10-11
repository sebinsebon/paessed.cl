import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_EXAM_EVENT,
  DEMO_EXAM_DURATION_SECONDS,
  DEMO_EXAM_QUESTION_COUNT,
  DEMO_EXAM_STORAGE_KEY,
  answeredDemoExamCount,
  clearDemoExamProgress,
  parseDemoExamProgress,
  readDemoExamProgress,
  writeDemoExamProgress,
} from "../lib/demo-exam-progress.ts";

const makeProgress = () => ({
  version: 1,
  questionIndex: 11,
  answers: Array.from({ length: DEMO_EXAM_QUESTION_COUNT }, (_, index) => index < 7 ? index % 4 : null),
  flagged: Array.from({ length: DEMO_EXAM_QUESTION_COUNT }, (_, index) => index === 2),
  secondsLeft: DEMO_EXAM_DURATION_SECONDS - 98,
  strokesByQuestion: { 11: [{ color: "#2563eb", points: [{ x: 0.2, y: 0.7 }] }] },
  savedAt: Date.now(),
});

test("accepts a valid resumable 65-question essay", () => {
  const saved = parseDemoExamProgress(makeProgress());
  assert.ok(saved);
  assert.equal(saved.questionIndex, 11);
  assert.equal(answeredDemoExamCount(saved), 7);
  assert.equal(saved.flagged[2], true);
  assert.equal(saved.secondsLeft, DEMO_EXAM_DURATION_SECONDS - 98);
  assert.equal(saved.strokesByQuestion[11][0].points[0].x, 0.2);
});

test("rejects invalid versions, missing answers and impossible timers", () => {
  assert.equal(parseDemoExamProgress(null), null);
  assert.equal(parseDemoExamProgress({ ...makeProgress(), version: 2 }), null);
  assert.equal(parseDemoExamProgress({ ...makeProgress(), answers: [] }), null);
  assert.equal(parseDemoExamProgress({ ...makeProgress(), questionIndex: 65 }), null);
  assert.equal(parseDemoExamProgress({ ...makeProgress(), secondsLeft: -1 }), null);
  assert.equal(parseDemoExamProgress({ ...makeProgress(), secondsLeft: DEMO_EXAM_DURATION_SECONDS + 1 }), null);
  assert.equal(parseDemoExamProgress({ ...makeProgress(), answers: Array(65).fill(99) }), null);
});

test("corrupt sketches never discard otherwise recoverable answers", () => {
  const progress = makeProgress();
  progress.strokesByQuestion[11] = [
    { color: "#2563eb", points: [{ x: 0.2, y: 0.7 }] },
    { color: "#2563eb", points: [{ x: -1, y: 10 }] },
  ];
  const saved = parseDemoExamProgress(progress);
  assert.ok(saved);
  assert.equal(saved.strokesByQuestion[11].length, 1);
});

test("local storage keeps progress until the attempt is explicitly cleared", () => {
  const entries = new Map();
  let eventCount = 0;
  const oldWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => entries.set(key, value),
      removeItem: (key) => entries.delete(key),
    },
    dispatchEvent: (event) => { if (event.type === DEMO_EXAM_EVENT) eventCount++; },
  };
  try {
    assert.equal(readDemoExamProgress(), null);
    assert.equal(writeDemoExamProgress(makeProgress()), true);
    assert.ok(entries.has(DEMO_EXAM_STORAGE_KEY));
    assert.equal(readDemoExamProgress().questionIndex, 11);
    assert.equal(answeredDemoExamCount(readDemoExamProgress()), 7);
    clearDemoExamProgress();
    assert.equal(readDemoExamProgress(), null);
    assert.equal(eventCount, 2);
  } finally {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
  }
});
