import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../src/app/page";

describe("Home", () => {
  it("renders the VaxTrace Bangla title", () => {
    render(<Home />);
    expect(screen.getByText("ভ্যাক্সট্রেস")).toBeDefined();
  });
});
