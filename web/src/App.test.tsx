import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App, { tickMs } from "./App";

describe("tickMs", () => {
  it("speeds up as the snake grows", () => {
    expect(tickMs(10, false)).toBeLessThan(tickMs(1, false));
  });

  it("is faster while a direction is held", () => {
    expect(tickMs(1, true)).toBeLessThan(tickMs(1, false));
  });

  it("never drops below the minimum interval", () => {
    expect(tickMs(500, true)).toBe(40);
  });
});

describe("best score", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("is restored from localStorage", () => {
    localStorage.setItem("snake2_best", "17");
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(1);
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    render(<App />);
    expect(screen.getByText("17")).toBeInTheDocument();
  });
});
