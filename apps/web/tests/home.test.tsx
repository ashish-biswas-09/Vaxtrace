import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
// Splash and role selection were merged: `/` now lives in the (auth) group so it inherits the
// branded auth shell, and the wordmark moved to that shell. Same route, different file.
import Home from "../src/app/(auth)/page";

describe("Home", () => {
  it("offers both entry paths and the claim route", () => {
    render(<Home />);
    expect(screen.getByText("অভিভাবক")).toBeDefined();
    expect(screen.getByText("স্বাস্থ্যকর্মী ও কর্মকর্তা")).toBeDefined();
    expect(screen.getByText(/শিশু আইডি আছে/)).toBeDefined();
  });
});
