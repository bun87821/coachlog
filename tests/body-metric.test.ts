import test from "node:test";
import assert from "node:assert/strict";
import { bodyMetricInput } from "../lib/body-metric.ts";

test("身體數值保留 InBody 脂肪重量", () => {
  const formData = new FormData();
  formData.set("date", "2026-08-17");
  formData.set("weight", "62.4");
  formData.set("bodyFat", "23.1");
  formData.set("muscle", "45.2");
  formData.set("fatMass", "14.4");

  assert.deepEqual(bodyMetricInput(formData), {
    date: "2026-08-17",
    weight: 62.4,
    bodyFat: 23.1,
    muscle: 45.2,
    fatMass: 14.4,
  });
});

test("沒有量測的身體數值保持空值", () => {
  const formData = new FormData();
  formData.set("date", "2026-08-17");

  assert.deepEqual(bodyMetricInput(formData), {
    date: "2026-08-17",
    weight: null,
    bodyFat: null,
    muscle: null,
    fatMass: null,
  });
});
