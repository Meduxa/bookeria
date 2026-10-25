import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import ka from "../../messages/ka.json";
import ru from "../../messages/ru.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

function placeholders(obj: object): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (o: object, p: string) => {
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === "object") walk(v, `${p}${k}.`);
      else
        out[`${p}${k}`] = [...String(v).matchAll(/\{(\w+)\}/g)]
          .map((m) => m[1])
          .sort()
          .join(",");
    }
  };
  walk(obj, "");
  return out;
}

describe("translations", () => {
  it.each([
    ["ka", ka],
    ["ru", ru],
  ])("%s has exactly the same keys as en", (_, messages) => {
    expect(keys(messages).sort()).toEqual(keys(en).sort());
  });

  it.each([
    ["ka", ka],
    ["ru", ru],
  ])("%s uses the same {placeholders} as en", (_, messages) => {
    expect(placeholders(messages)).toEqual(placeholders(en));
  });

  it("no empty strings", () => {
    for (const messages of [en, ka, ru]) {
      expect(Object.values(placeholders(messages)).length).toBeGreaterThan(0);
      for (const k of keys(messages)) {
        const value = k
          .split(".")
          .reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], messages);
        expect(String(value).trim(), k).not.toBe("");
      }
    }
  });
});
