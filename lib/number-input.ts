import type { FocusEvent, KeyboardEvent, MouseEvent } from "react";

/**
 * 訓練中常常是「把 60 改成 65」，而不是在數字中間插字。
 * 點進欄位時整個選起來，直接輸入就取代，不用先刪掉舊的數字。
 * iOS 會在 focus 之後才擺放游標，所以延後一個影格再選取。
 */
const selectAll = (input: HTMLInputElement) => {
  requestAnimationFrame(() => {
    try { input.select(); } catch {}
  });
};

/** 手機鍵盤右下角顯示「下一個」，按下就跳到同一列的下一個欄位。 */
export const nextFieldOnEnter = {
  enterKeyHint: "next" as const,
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const form = event.currentTarget.form;
    if (!form) return;
    const fields = Array.from(form.querySelectorAll<HTMLInputElement>('input[type="number"]')).filter(field => !field.disabled);
    const next = fields[fields.indexOf(event.currentTarget) + 1];
    if (next) { next.focus(); next.select(); }
  },
};

export const selectOnFocus = {
  onFocus: (event: FocusEvent<HTMLInputElement>) => selectAll(event.currentTarget),
  onClick: (event: MouseEvent<HTMLInputElement>) => selectAll(event.currentTarget),
};
